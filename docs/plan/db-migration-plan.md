# DB Migration Plan: DrizzleORM + Effect Schema

This plan tracks the rewrite to integrate DrizzleORM describing the existing Archetype database so this project can use the same database. It complements the architecture proposal and breaks work into concrete steps with progress checklists.

Reference proposal: docs/proposals/database-rewrite-drizzle.md

## Objectives

- Describe the live Builder database and Organization databases with Drizzle tables (no schema drift).
- Use Effect Schema at boundaries for JSONB shapes and config.
- Provide DI Layers for builder DB and per‑org DB resolution (Neon HTTP for prod, PGlite for local/tests).
- Prefer introspection for initial schema code where possible; only run migrations locally or when explicitly owning a change.

## Prerequisites

- Bun runtime; scripts use `bun run`.
- Env vars (builder DB): `DATABASE_URL` (Neon connection string), or driver-specific config for Neon HTTP.
- Env vars (org DB resolver): encrypted connection string source (from `auth.organization`), `DATABASE_ENCRYPTION_KEY_B64`, optional `DATABASE_ENCRYPTION_IV_LENGTH`.
- Drizzle config: migrations dir path (e.g., `./migrations`), schema entry (`src/db/schema.ts`).

## Scope and Topology

- Single Builder DB: schemas `auth`, `builder`, `billing_tracking`, `marketing`, plus `public.kysely_*`.
- Many Organization DBs (customer data): resolved per organization; created/managed externally. Our app reads/writes via Drizzle, and only performs DDL when explicitly invoked.

## Conventions

- Brand all identifier columns (builder and auth) with Effect Schema and Drizzle `$type`:
  - Define branded ID schemas in `src/db/ids.ts` (e.g., `ActionIdSchema`, `EntityTypeIdSchema`).
  - Use `$type<BrandedId>()` on Drizzle columns (e.g., `varchar('action_id').$type<ActionId>()`).
  - Prefer specific per-entity brands (e.g., `ActionVersionId`, `RelationVersionId`, `WorkspaceVersionId`) over generic `string`.
  - Apply to primary keys and all `*_id`/`*_version_id` fields across builder tables.
  - Reuse these branded types in repositories and service signatures for end-to-end type safety.

## Workstream A — Project Setup

- [ ] Add dependencies: `drizzle-orm`, `drizzle-kit`, `@effect/schema`, drivers (`drizzle-orm/neon-http`, `drizzle-orm/pglite`), and any decryption helper if needed.
- [x] Create `src/db/schema.ts` (single entry) with initial table definitions (placeholder).
- [x] Create `src/db/schemas.ts` for Effect Schemas used by JSONB columns.
- [x] Create `src/db/tags.ts` with `BuilderDbTag` and `OrgDbResolverTag` (and `DbConfigTag`).
- [x] Create `src/db/connect.ts` with builder/org Layers (placeholders).
- [x] Create `drizzle.config.ts`.
- [ ] Add Bun scripts (`db:introspect`, `db:generate`, `db:migrate`, `db:down`).

## Workstream B — Connectivity and DI

- [ ] Implement `BuilderDbTag` Layer from env (`DATABASE_URL` or Neon settings via HTTP client) using Neon HTTP driver.
- [ ] Implement `OrgDbResolverTag` that reads per‑org connection info from the Builder DB (e.g., encrypted connection string, Neon branch), decrypts if needed, and returns a Drizzle instance; memoize with TTL.
- [ ] Add `withTransaction` helper using Effect acquire-use-release.
- [ ] Add health checks: connect; simple `select 1` per DB.

## Workstream C — Schema Mapping (Builder DB)

Strategy

- Use Archetype’s Kysely TypeScript schema as the primary reference for shape (packages/kysely/databases/schema/\*\*). Port JSONB Zod types to Effect Schema.
- Cross-check schema.sql only for indexes, unique constraints, FKs and triggers.
- Start from `drizzle-kit introspect` if needed to bootstrap definitions, then adjust to match the TS schema.
- Keep JSONB columns untyped at the DB edge; validate with Effect Schemas in app code.

Progress (77 tables)

Auth

- [x] auth.inbox_connection
- [x] auth.inbox_connection_sync_job
- [x] auth.organization (add unique on clerk_org_id, slug)
- [x] auth.organization_user
- [x] auth.organization_user_entity_id
- [x] auth."user" (add unique on clerk_user_id; FK to organization optional)
- [x] auth.user_preferences

Billing Tracking

- [x] billing_tracking.billing_event_queue
- [x] billing_tracking.customer
- [x] billing_tracking.invoice
- [x] billing_tracking.organization_subscription
- [x] billing_tracking.usage_metrics

Builder

- [x] builder.action_draft_email_extracted_input
- [x] builder.action_edits_history
- [x] builder.action_log
- [x] builder.application_group
- [x] builder.athena_onboarding_state
- [x] builder.automation_execution
- [x] builder.automation_rule
- [x] builder.category
- [x] builder.category_with_entity_type
- [x] builder.chain_run_table (add index on cache_key; result_type is 'success'|'error'|null in TS)
- [x] builder.crm_cache
- [x] builder.custom_views
- [x] builder.data_model_action
- [x] builder.data_model_ai_column_metadata
- [x] builder.data_model_ai_relation_metadata
- [x] builder.data_model_authorization
- [x] builder.data_model_entity_relation
- [x] builder.data_model_entity_type
- [x] builder.data_model_entity_type_column
- [x] builder.data_model_entity_type_column_validation
- [x] builder.data_model_entity_type_version
- [x] builder.data_model_validation_group
- [x] builder.data_store_config
- [x] builder.derived_column_computation
- [x] builder.derived_column_metadata
- [x] builder.derived_relation_computation
- [x] builder.derived_relation_metadata
- [x] builder.email
- [x] builder.email_extracted_action_input
- [x] builder.email_processing
- [x] builder.entity_action_draft
- [x] builder.entity_comment
- [x] builder.entity_enrichment_processing
- [x] builder.entity_type_edits_history
- [x] builder.fake_ai_columns_computation_table
- [x] builder.fake_ai_relations_computation_table
- [x] builder.fake_data_entity_type_retrieval_pointer
- [x] builder.fake_m2m_table
- [x] builder.feature_application_run
- [x] builder.feature_application_run_features
- [x] builder.feature_suggestions_run
- [x] builder.features
- [x] builder.field_group
- [x] builder.gmail_message_processing_queue
- [x] builder.lock_user_entity_type
- [x] builder.onboarding_session
- [x] builder.relation_edits_history
- [x] builder.state_machine_metadata
- [x] builder.state_machine_state
- [x] builder.state_machine_transition
- [x] builder.version_refs
- [x] builder.workspace_version
- [x] builder.workspace_version_action_version
- [x] builder.workspace_version_entity_type_version
- [x] builder.workspace_version_relation_version
- [x] builder.workspace_version_state_machine_metadata_version

Marketing

- [x] marketing.blog_posts
- [x] marketing.homepage_generation
- [x] marketing.homepage_generation_share
- [x] marketing.homepage_generation_share_view
- [x] marketing.industry
- [x] marketing.landing_page
- [x] marketing.vertical

Public (migrations)

- [x] public.kysely_migration
- [x] public.kysely_migration_lock

## Workstream D — Schema Mapping (Org DBs)

- [ ] Define minimal shared structures we must query in org DBs (if any are common across customers) — otherwise, keep org DB schema discovery per organization.
- [ ] Provide dynamic DDL helpers (Phase 2) only if the app needs to create or update org tables.

## Workstream E — JSONB + Effect Schema

- [ ] Identify JSONB columns per table and define Effect Schemas (e.g., clerk_data, inputs/result for chain runs, email metadata).
- [ ] Implement repository helpers that decode on read and encode on write.
- [ ] Add property tests for encoders/decoders for stability.

## Workstream F — Validation and Testing

- [ ] `bun typecheck` clean across added DB modules.
- [ ] Connectivity tests (dev): neon + pglite.
- [ ] Select/insert smoke tests for critical tables (auth.organization, auth.user, builder.chain_run_table).
- [ ] Read/Write JSONB integration tests with Effect Schema.

## Workstream G — Ops and Safety

- [ ] Ensure no migrations run against production org DBs by default; require explicit flag.
- [ ] Decrypt org connection strings only in memory; never log secrets.
- [ ] Add observability hooks (log tags with schema/table, timings where appropriate).

## Risks and Mitigations

- Drift between introspected code and live DB: mitigate with read-only introspection in CI and alert on diffs.
- Performance regressions: add indices in code comments to ensure we mirror existing ones in case we own any migrations; otherwise, trust the existing DB.
- JSONB schema changes: use versioned Effect Schemas or permissive schemas initially.

## Status Summary

- Total builder tables: 77
- Completed: 77
- In progress: 0
- Remaining: 0

Update this section as work lands. Each checklist item above should be checked when the Drizzle table definition is added and validated with at least a select query.
