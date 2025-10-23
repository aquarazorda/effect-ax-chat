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
- Start from `drizzle-kit introspect` against the Builder DB to generate a baseline.
- Replace/adjust definitions to exactly match existing names (schemas, tables, snake_case columns, enums, arrays, PK/UK/FKs). Do not camelCase columns.
- Keep JSONB columns untyped at the DB edge; define Effect Schemas and encode/decode at repository boundaries.

Progress (77 tables)

Auth
- [ ] auth.inbox_connection
- [ ] auth.inbox_connection_sync_job
- [ ] auth.organization
- [ ] auth.organization_user
- [ ] auth.organization_user_entity_id
- [ ] auth."user"
- [ ] auth.user_preferences

Billing Tracking
- [ ] billing_tracking.billing_event_queue
- [ ] billing_tracking.customer
- [ ] billing_tracking.invoice
- [ ] billing_tracking.organization_subscription
- [ ] billing_tracking.usage_metrics

Builder
- [ ] builder.action_draft_email_extracted_input
- [ ] builder.action_edits_history
- [ ] builder.action_log
- [ ] builder.application_group
- [ ] builder.athena_onboarding_state
- [ ] builder.automation_execution
- [ ] builder.automation_rule
- [ ] builder.category
- [ ] builder.category_with_entity_type
- [ ] builder.chain_run_table
- [ ] builder.crm_cache
- [ ] builder.custom_views
- [ ] builder.data_model_action
- [ ] builder.data_model_ai_column_metadata
- [ ] builder.data_model_ai_relation_metadata
- [ ] builder.data_model_authorization
- [ ] builder.data_model_entity_relation
- [ ] builder.data_model_entity_type
- [ ] builder.data_model_entity_type_column
- [ ] builder.data_model_entity_type_column_validation
- [ ] builder.data_model_entity_type_version
- [ ] builder.data_model_validation_group
- [ ] builder.data_store_config
- [ ] builder.derived_column_computation
- [ ] builder.derived_column_metadata
- [ ] builder.derived_relation_computation
- [ ] builder.derived_relation_metadata
- [ ] builder.email
- [ ] builder.email_extracted_action_input
- [ ] builder.email_processing
- [ ] builder.entity_action_draft
- [ ] builder.entity_comment
- [ ] builder.entity_enrichment_processing
- [ ] builder.entity_type_edits_history
- [ ] builder.fake_ai_columns_computation_table
- [ ] builder.fake_ai_relations_computation_table
- [ ] builder.fake_data_entity_type_retrieval_pointer
- [ ] builder.fake_m2m_table
- [ ] builder.feature_application_run
- [ ] builder.feature_application_run_features
- [ ] builder.feature_suggestions_run
- [ ] builder.features
- [ ] builder.field_group
- [ ] builder.gmail_message_processing_queue
- [ ] builder.lock_user_entity_type
- [ ] builder.onboarding_session
- [ ] builder.relation_edits_history
- [ ] builder.state_machine_metadata
- [ ] builder.state_machine_state
- [ ] builder.state_machine_transition
- [ ] builder.version_refs
- [ ] builder.workspace_version
- [ ] builder.workspace_version_action_version
- [ ] builder.workspace_version_entity_type_version
- [ ] builder.workspace_version_relation_version
- [ ] builder.workspace_version_state_machine_metadata_version

Marketing
- [ ] marketing.blog_posts
- [ ] marketing.homepage_generation
- [ ] marketing.homepage_generation_share
- [ ] marketing.homepage_generation_share_view
- [ ] marketing.industry
- [ ] marketing.landing_page
- [ ] marketing.vertical

Public (migrations)
- [ ] public.kysely_migration
- [ ] public.kysely_migration_lock

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
- Completed: 0
- In progress: 0
- Remaining: 77

Update this section as work lands. Each checklist item above should be checked when the Drizzle table definition is added and validated with at least a select query.
