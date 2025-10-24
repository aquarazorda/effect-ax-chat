# Proposal: Authorized Org Entity Pushdown (Effect‑AX)

This document describes how we execute permission‑aware entity queries against organization (customer) databases, mapping the Archetype dynamic table layout into a typesafe, DI‑driven pipeline. It extends the current PermissionEngine and EntityQueryService with a concrete OrgEntityStore provider that performs SQL pushdown and returns only authorized entities.

## Goals

- Enforce Archetype‑style permissions for every entity read via pushdown filters derived from relation‑path authorizations.
- Support one‑hop traversal initially; evolve to multi‑hop with recursive CTEs.
- Keep DI clean: no raw DB handles in app/agent code — use Tags/Layers only.
- Avoid casts in service layers; confine unavoidable driver bridging to a small execution boundary.
- Preserve safety: deny‑by‑default; errors map to empty results rather than leaking data.

## Current Building Blocks

- Permission planning
  - PermissionEngineTag produces EntityReadPlan:
    - `mode`: `denyAll | filter | allowAll`
    - `fieldGroupPolicy`: grants for field groups/actions
    - `traversal`: steps `{ relationId, direction: 'aToB' | 'bToA' }`, optional `startingEntityTypeId`
    - `anchorUserEntityId`: subject’s user entity id when available
    - Optional link token support via LinkTokenVerifierTag
- Query boundary
  - EntityQueryServiceTag consults PermissionEngine, derives a `OneHopFilterPlan` and calls OrgEntityStoreTag.
  - OrgEntityStoreTag is the only place that executes organization DB reads.
- Builder metadata
  - Latest entity type and relation versions: `builder.data_model_entity_type_version`, `builder.data_model_entity_relation` (ordered by `created_at`).

## Org DB Table Layout (Archetype mapping)

Archetype creates per‑version tables:

- Entity table: `entity_${versionType}_${entityTypeVersionIdNormalized}`
  - Columns: `__entity_id`, `__updated_at`, `__is_deleted`, `__in_status_since`, plus `col_*` for entity fields
- Relation table: `relation_${versionType}_${relationVersionIdNormalized}`
  - Columns: `__record_id`, `__relation_id`, `__updated_at`, `__is_deleted`, and
    - `a_entity_${entityTypeAIdNormalized}`
    - `b_entity_${entityTypeBIdNormalized}`

We mirrored the name builders in `src/orgdb/sqlNames.ts` so the provider can compute the table/column names from IDs.

## One‑Hop Traversal Pushdown

Given `OneHopFilterPlan { targetEntityTypeId, relationId, direction, anchorUserEntityId }`:

1. Resolve latest versions (Builder DB)

- `relationVersionId` = latest `version_id` for `data_model_entity_relation` where `id = relationId`.
- Fetch `entity_type_id_a` and `entity_type_id_b` to compute relation table column names.
- `targetEntityTypeVersionId` = latest `version_id` for `data_model_entity_type_version` where `id = targetEntityTypeId`.

2. Compute SQL identifiers (Org DB)

- `relTable = relation_${versionType}_${normalize(relationVersionId)}`
- `aCol = a_entity_${normalize(entityTypeIdA)}`
- `bCol = b_entity_${normalize(entityTypeIdB)}`
- `entTable = entity_${versionType}_${normalize(targetEntityTypeVersionId)}`

3. Build parameterized SQL (directional)

- For `aToB`: anchor on `aCol`, select distinct `bCol` as target entity ids.
- For `bToA`: anchor on `bCol`, select distinct `aCol` as target entity ids.
- Always filter `relTable.__is_deleted = false` and `entTable.__is_deleted = false`.
- Join `entTable` by entity id to ensure the target entity exists and is not deleted.
- Return rows and a `COUNT(*) OVER()` or a separate `COUNT(*)` query for totals.

4. Pagination

- Start with offset/limit using `ORDER BY ent.__entity_id` (deterministic).
- Consider keyset pagination later if needed for performance.

5. Projection and field pruning

- Minimal projection for now: `__entity_id` (and optionally display name/status columns if needed later).
- Prune returned fields/actions in memory using `fieldGroupPolicy` (when returning richer payloads).

## Multi‑Hop Traversal (Later)

- Compose recursive CTEs for repeated joins:

```
WITH RECURSIVE reachable(entity_id, depth) AS (
  SELECT anchor_id, 0
  UNION ALL
  SELECT next.entity_id, reachable.depth + 1
  FROM reachable
  JOIN relation_X ON ...
)
SELECT ... FROM reachable JOIN entity_Y ON ... WHERE depth = N;
```

- Ensure cycle prevention (track visited), and bound depth by traversal length.
- Index relation a/b columns; ensure entity `__entity_id` is indexed.

## Execution Boundary and Type Safety

- Introduce `RawOrgSqlTag` (or extend OrgDbResolverTag) to expose a minimal “execute SELECT” interface:
  - Accepts parameterized SQL with a whitelist of operations used by OrgEntityStore (SELECT only).
  - Minimal, localized bridging to the driver, implemented once; no casts leak into service layers.
- OrgEntityStorePostgres implementation will use this executor and the name builders to produce and run SQL.
- Errors are caught and returned as empty results; logs include plan metadata for observability.

## Link‑Based Access (Field Groups)

- `PermissionEngine.planEntityRead` grants per‑field‑group access if:
  - There’s a direct relation‑path authorization, or
  - There’s an `authorizedForAnyoneWithLink` grant AND a `LinkTokenVerifierTag.verify(token)` returns true.
- Action execution is never granted via link; only field groups.

## DI and Layers

- Builder DB: `BuilderDbTag` for version resolutions.
- Org DB: `OrgDbResolverTag` for per‑org connections; `RawOrgSqlTag` for raw execution.
- Planning: `PermissionEngineTag` + `LinkTokenVerifierTag` + `UserEntityResolverTag`.
- Query boundary: `EntityQueryServiceTag` → `OrgEntityStoreTag`.

## Safety and Observability

- Deny‑by‑default: if planning or SQL execution fails, results are empty.
- Log plan metadata (orgId, versionType, relationId, direction, anchor) and normalize PII.
- Limit raw SQL to a small execution boundary; parameterize inputs strictly.

## Implementation Plan

1. Add `RawOrgSqlTag` with a single method:
   - `execute(orgId, sqlText, params) => Promise<{ rows: any[] }>` — implemented with the org Neon client or Drizzle’s `sql` and `.execute` under the hood, localized casts only here.
2. Implement `OrgEntityStorePostgres`:
   - Resolve latest versions (relation/entity type) via `BuilderDbTag`.
   - Build table and column names using `src/orgdb/sqlNames.ts`.
   - Build parameterized SQL for one‑hop aToB/bToA.
   - Execute via `RawOrgSqlTag`; map to `QueryEntitiesResult`.
3. Wire `EntityQueryService` to use `OrgEntityStorePostgres` layer.
4. Add field‑group pruning when we expand projections.
5. Extend to multi‑hop with recursive CTEs.
6. Typecheck (`bun typecheck`) and add unit tests for one‑hop planning and SQL generation.

## Open Questions

- Version selection: We currently pick “latest by created*at”. If a workspace/version map is needed, we should consult workspace version refs (builder.workspace_version*\* tables).
- Projections: Which fields are minimally required for downstream agents (display name, status)? We can add them once the column mapping is defined.
- Performance: For large orgs, consider keyset pagination and pre‑computed relation edges. Indexes on relation a/b columns and entity `__entity_id` are required.
- Raw execution: Prefer using the underlying Neon `sql` client for Org DBs to avoid Drizzle schema coupling; we can expose it via the resolver.

## References

- Archetype entity and relation table creation and naming: `packages/backend/src/store/customerData/utils/sql.ts`, `utils/tables.ts`.
- Constants for metadata columns: `packages/backend/src/store/customerData/constants.ts`.

---

## Implementation Status (in repo)

- `src/services/OrgEntityStore.ts` (Drizzle‑based)
  - AllowAll, one‑hop, and multi‑hop queries (fixed‑length chained CTEs) implemented using dynamic table/column names via `src/orgdb/sqlNames.ts`.
  - Workspace version mapping used for both entity and relation versions via `builder.workspace_version_*` + `builder.version_refs` filtered by `(organizationId, versionType)`.
  - Multi‑hop generalized with recursive CTEs bounded by traversal length, selecting only depth == N results.
  - Column pushdown for display/status and arbitrary allowed columns (via JSON object projection) based on field‑group grants; countsOnly supported.
  - Keyset pagination via `cursorEntityId` and `order`.
- Integrated with PermissionEngine and EntityQueryService
  - `src/services/EntityQueryService.ts` prefers multi‑hop when available; otherwise one‑hop; still prunes `displayName`/`status` defensively.
- Type‑safe and DI‑driven
  - Branded IDs throughout; Effect Schema decoders for DB results; no raw unparameterized SQL.

## TODOs / Next Phases

- Generalize to recursive CTEs for variable‑length traversals where beneficial.
- Expand projection pushdown to arbitrary columns once FieldGroup → ColumnId mapping is finalized.
- Add structured logs/metrics for plan and OrgEntityStore execution timings.
- Add keyset pagination + required indexes.
- Unit tests for SQL generation (both directions, countsOnly) and multi‑hop chains; integration tests with fixtures.

## Indexing Guidance (Org DB)

- Entity tables: BTREE index on `(__entity_id)` to support pagination and joins.
- Relation tables: BTREE indexes on `(a_entity_*)` and `(b_entity_*)`; consider partial indexes with `WHERE __is_deleted = false`.
- Foreign key constraints are not enforced across dynamic tables; ensure referential integrity via ETL/process discipline.
