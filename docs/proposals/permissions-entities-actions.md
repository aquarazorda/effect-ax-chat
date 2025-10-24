# Proposal: Permissions, Entity Fetching, and Actions (Effect‑AX)

This proposal defines how agents will fetch entity types, entities, and actions with a first‑class permissions model. It aligns with our Agent Charter: schema‑first validation, Tag/Layer DI, no `any`/casts, reproducibility via env layers, and safe streaming.

## Goals

- Unified, typesafe APIs to fetch entity types, entities, and actions.
- Declarative, relation‑path based authorization compatible with Archetype.
- Pluggable data sources via Layers (Builder DB + Org DB) with caching.
- Runtime validation at boundaries with Effect Schema; no type assertions.
- Clear migration path from Archetype stores and tables.

## Sources of Truth (migrating from Archetype)

- Builder metadata (static, shared):
  - Tables: `builder.data_model_entity_type`, `builder.data_model_entity_type_version`, `builder.data_model_entity_relation`, `builder.field_group`, `builder.data_model_action`, `builder.data_model_authorization`, `builder.category*`, `builder.state_machine_*`, etc. These are already mirrored in `src/db/schema.ts`.
  - Stores to mirror: `EntityTypeStore`, `RelationStore`, `ActionStore`, `AuthorizationStore`.
- Customer/org data (dynamic, per‑org):
  - Dynamic tables per entity type and derived views. Archetype implements these behind a “customer data connector” and the `getEntities` pipeline with authorization.
  - We will port incrementally: start with read/query paths, then add write paths.

## Authorization Model (compatible with Archetype)

- Policy shape (ported to Effect Schema):
  - Relation‑path policy: authorize a subject (user entity) to a target entity by traversing relations along a path. Optional `startingEntityType` override with filters.
  - Scopes:
    - Read on entities of entity type version (optionally per field group).
    - Execute action (by action version).
    - Read activity log.
    - Anyone‑with‑link (entity type field group only).
  - Storage: `builder.data_model_authorization` rows with columns mirroring the above (already present in Drizzle schema).

Evaluation semantics

- For a given request, we compute whether a user is authorized via:
  - Related path authorizations: there exists a relation path from the user entity to the target entity meeting filters.
  - Unrelated (any‑state) grants where applicable (e.g., some field groups/actions may be granted without a relation for a support entity type).
  - Field‑group granularity: read access yields full or restricted field groups; action execution checks are separate.
  - “Anyone with link” bypass applies to entity type field groups only.

## Effect Services and DI

We expose tightly scoped Effect services with Tag/Layer DI. No global singletons and no direct `process.env` access; use `src/env.ts` and Layers.

- `SchemaReaderTag` (Builder DB)
  - Loads the latest schema for an organization and version type.
  - Provides maps: `entityTypeById`, `relationsByEntityTypeId`, `actionById` and helpers like `actionsByEntityTypeIds`.
  - Caches per `(organizationId, versionType)` with an LRU and TTL; invalidates from edit history tables.

- `EntityTypeServiceTag`
  - `getByVersionId(entityTypeId, versionId)` → entity type with columns, field groups, authorizations.
  - `getByIds(ids, versionType)` and `getByOrganization(organizationId, versionType)`.
  - `getRelated(entityTypeIds, versionType)` to support query planning.
  - Backed by `SchemaReaderTag` and direct Drizzle fetch for versioned lookups.

- `ActionServiceTag`
  - `getByIds(ids, versionType)`; `getByEntityTypeIds(entityTypeIds, versionType)`; `getAllInOrg(organizationId, versionType)`.
  - Includes authorizations from `builder.data_model_authorization` for execution.

- `PermissionEngineTag`
  - Inputs: subject context `{ userId?, organizationId, versionType }` and a target scope:
    - `read(entityTypeId[, fieldGroupId])`
    - `execute(actionId)`
    - `activityLog(entityTypeId)`
  - Resolves the user entity id (via Builder DB mapping) and evaluates relation‑path authorizations using `relationsByEntityTypeId` and precompiled adjacency indices.
  - Returns structured decisions with derivations used (for observability): full access, field‑group set, actions set, or denied.

- `EntityQueryServiceTag` (Org DB)
  - Declarative query API inspired by Archetype’s `getEntities`:
    - Entry: by `entityTypeId` or by join traversal `{ relation, direction, startingEntities }`.
    - Filters: per‑column ANDed conditions; specific relations; state filter.
    - Selection: specific columns, relations to preload, counts‑only mode.
    - Pagination and ordering.
  - Enforces permission via `PermissionEngineTag`, returning field‑group filtered entities when needed.
  - Phase 1: adapter backed by existing “derived”/index tables (where available) or stubs to unblock agents.
  - Phase 2: dynamic per‑entity‑type tables with JSONB validation via Effect Schema; reuse Archetype’s DSL shapes.

All services derive their static types from Effect Schemas; results are validated at boundaries (DB rows → schemas → domain types).

## Data Shapes (Effect Schema)

Port key Zod schemas to Effect Schema for runtime validation and type inference:

- Authorization schema
  - `RelationPathNodeSchema`: `{ relationId, direction }`.
  - `AuthorizingRelationPathSchema`: `{ startingEntityType?: { id, filters? }, path: RelationPathNode[] }`.
  - `AuthorizationSchema`: `{ authorizedByRelationPath, authorizedForAnyoneWithLink?: boolean }`.

- Query inputs
  - `DataLoadingQuerySchema`: entry (`entityTypeId` or `joinTraversal`), filters, relations, pagination.
  - `IndexDataLoadingConfigSchema`: specific columns, relations to load, countsOnly, etc.

- Result types
  - `EntityTypeSchema`, `ActionSchema` synced with builder tables.
  - `EntitySchema`: validated per entity type using derived column schemas; restrict unknowns to prevent leaks.

## Fetching Workflows

1. Fetch entity types

- Prefer cached `SchemaReaderTag` for versionType‑scoped reads.
- Fall back to direct Drizzle queries for versioned detail (`getByVersionId`).
- Include authorizations grouped by: read, activityLog, perFieldGroupId.

2. Fetch actions

- Read from `SchemaReaderTag` by id(s), by entityTypeIds, or organization‑wide.
- Join with execution authorizations from `data_model_authorization` where `authorize_execute_on_action_version_id` is set.

3. Query entities

- Build a typed plan from the declarative query: resolve target entity type, traverse relations, collect filters.
- Use `PermissionEngineTag` to compute field group/action access for the subject.
- Query Org DB through a `CustomerDataConnector` Layer to avoid coupling to a specific driver. Validate rows and apply field‑group filtering before returning.
- When preloading relations, issue additional queries for the related entity type’s minimal display fields only; respect authorization on related entities as well.

## Caching, Safety, and Streaming

- Caching: LRU caches for schema snapshots keyed by `(organizationId, versionType)`; effect‑scoped caches for per‑request authorization derivations.
- Safety: all external calls (DB, webhooks) go through Effects with explicit error channels and typed errors (`DbError`, `AuthzError`).
- Streaming: for large queries, expose a `Stream` of entities; downstream agents can transform or throttle. Backpressure respected.

## Mapping to Archetype Code

- Authorization storage and grouping mirrors `packages/backend/src/store/builder/authorizationStore.ts` and consumer logic in `dataStore.ts`.
- Entity type loading mirrors `EntityTypeStore.getByVersionIds/getByOrganizationId` with column/validation/field group joins.
- Action loading mirrors `ActionStore.getByVersionType*` and lateral‑join authorization aggregation.
- Entity querying and permission filtering mirrors `store/customerData/getEntities.ts` and `logic/dataStore.ts` (phased port).

## Environment and Layers

- Builder DB: Drizzle instance via `BuilderDbTag` (driver injected; default Neon HTTP/PGlite) using `src/db/schema.ts`.
- Org DB: per‑org Drizzle via `OrgDbResolverTag` looked up from Builder DB connection material (never hard‑code secrets; decrypt via a small Effect service layer).
- App env: use `AppEnvTag` + `makeEnvLayer` from `src/env.ts`; never read `process.env` directly.

## Testing Discipline

- Property tests for authorization: per‑path grants, unrelated grants, field‑group filtering, action permission checks.
- Replayable transcripts for query pipelines to catch silent regressions.
- Run `bun typecheck` and `bun test` before handoff; fail fast on schema decode errors.

## Phased Implementation Plan

Phase 1 (Builder‑centric, unblock agents)

- Implement `SchemaReaderTag`, `EntityTypeServiceTag`, `ActionServiceTag` with Drizzle reads and Effect Schema decoding.
- Implement `PermissionEngineTag` for read/action/activityLog using relation paths and anyone‑with‑link.
- Implement `EntityQueryServiceTag` minimal read path backed by existing derived/index tables where available; validate shapes; apply field‑group filtering.

Phase 2 (Customer data port)

- Port customer data connector and `getEntities` equivalents; add per‑entity‑type table registry and JSONB column schemas.
- Add relation preloading with minimal display payloads and per‑entity authorization checks.

Phase 3 (DX and streaming)

- Add streaming variants of entity queries and long‑running action executions. Integrate with Ax signatures for declarative goals over manual prompts.

## Open Questions

- Organization/user identity resolution: unify user→userEntity mapping behind a service with caching and typed fallbacks.
- Multi‑tenant caching: define invalidation signals from edit history tables to refresh `SchemaReaderTag`.
- “Anyone with link” scope: maintain as field‑group only or extend? Keep parity with Archetype for now.
- Entity writes/mutations: scope and sequencing for permission checks before side effects; not covered here.

## Next Steps

- Approve service boundaries and DI Tags.
- I can scaffold the Tags/Layer interfaces with Effect Schema types and add placeholder implementations under `src/runtime` and `src/db` that query our existing Drizzle schema. Once approved, I’ll wire minimal routes for agents to consume and add tests.

---

## Implementation Status and TODOs

Implemented (code)

- Authorization loading: `src/permissions/Authorization.ts` with Effect Schema decoding; branded IDs; Drizzle queries.
- Permission planning: `src/permissions/PermissionEngine.ts` returns mode, fieldGroupPolicy, traversal (RelationId + direction), and anchorUserEntityId; includes link-token support (`src/permissions/LinkToken.ts`).
- Entity query boundary: `src/services/EntityQueryService.ts` enforces planning; prefers multi-hop when present, falls back to one-hop, else denies; countsOnly mode; pruning hook for display/status.
- Org store queries: `src/services/OrgEntityStore.ts` implements allowAll, one-hop, and multi-hop via fixed-length chained CTEs. Dynamic naming via `src/orgdb/sqlNames.ts`.
- Workspace version mapping: entity/relation version resolution uses `builder.workspace_version_*` joined with `builder.version_refs` filtered by `(organizationId, versionType)`; replaces latest-by-created_at.
- Column pushdown: display/status are only selected when included by allowed ColumnIds computed from field groups (still pruned defensively in service).
- Brands and validation: `src/db/ids.ts` brands used end-to-end; DB outputs decoded with Effect Schema.

Open work

- Field-group → columns mapping: finalize robust extraction of ColumnIds from `builder.field_group.fields`, including complex nested shapes and derived column references; expand SQL projection beyond id/display/status.
- Multi-hop generalization: add optional recursive CTE generator for variable-length traversals; current approach handles known fixed lengths.
- Action execution and activity log: wire enforcement plans to concrete execution paths (mirroring Archetype semantics).
- Observability: structured logs, timings around plan derivation and OrgEntityStore execution; normalize identifiers.
- Performance: keyset pagination and required indexes on relation edges and entity `__entity_id`.
- Tests: cover permission planning (including link-token behavior), deriveOneHop/deriveMultiHop, SQL generation for both directions and countsOnly, and pruning logic.

## Keyset Pagination and Indexes

- Keyset pagination is available via `QueryConfig.cursorEntityId` and optional `order` (`asc` | `desc`).
- Recommended indexes in org DBs:
  - Entities: index on `(__entity_id)`; if ordering by status/display is desired later, consider additional indexes.
  - Relations: indexes on `(a_entity_*)` and `(b_entity_*)` columns, plus partial `WHERE __is_deleted = false` when supported.
