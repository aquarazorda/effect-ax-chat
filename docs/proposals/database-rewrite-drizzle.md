# Proposal: Database Structure Rewrite with DrizzleORM + Effect Schema

This proposal outlines how to mirror the Archetype database structure in this project using DrizzleORM, integrated with Effect and Effect Schema. It focuses on a schema-first, typesafe design, pluggable connectivity, and DX aligned with our Agent Charter.

## Goals

- Replicate Archetype’s logical structure (schemas, tables, relationships) while modernizing with DrizzleORM.
- Schema-first runtime validation using Effect Schema at all external boundaries and for JSONB.
- Tag/Layer-based DI for DB connectivity, migrations, and transactions.
- Support local dev and production (Neon/remote) without code changes — swap Layers.
- Clear migration discipline via drizzle-kit, with reproducible, auto-generated SQL.

## Archetype Structure (Summary)

Archetype organizes tables across multiple Postgres schemas. Based on ../archetype/packages/kysely/schema.sql and backend stores, key schemas are:

- auth: organizations, users, org-user mapping, inbox connections, preferences
- builder: data model entities and versions, categories, actions, automation rules, chain run logs, CRM cache, emails, chats
- billing_tracking: subscriptions, invoices, usage metrics, event queue
- marketing: landing pages, blog posts, homepage generations

There is also a dynamic “customer data” layer managed by code (table-per-entity-type with metadata columns, indexes, materialized FTS view). For the initial rewrite, we will map static schemas (auth, builder, billing_tracking, marketing). “Customer data” dynamic tables will be considered in a second phase (design notes included below).

## Minimal Layout (no barrels)

Keep it simple to avoid barrel-file pitfalls and deep trees. A single schema module that defines all tables by schema, plus a tiny DI layer:

- src/db/
  - schema.ts        // Drizzle table definitions for all schemas (auth, builder, billing_tracking, marketing)
  - schemas.ts       // Effect Schemas for JSONB columns (grouped here)
  - tags.ts          // DbConfigTag, DrizzleDbTag
  - connect.ts       // makeDbLayer(driver) returning Drizzle instance via DI
  - tx.ts            // withTransaction helper (optional)
- drizzle.config.ts  // drizzle-kit config (introspect/generate/migrate)

Notes
- Do not create barrel re-exports. Import tables directly from `src/db/schema.ts` where needed.
- If the schema grows unwieldy, split into a few files per Postgres schema (e.g., `schema.auth.ts`), but still import them into `schema.ts` without re-exporting wildcards.

## Drivers and Connectivity (DI)

To satisfy “no pg/postgres.js” while supporting Postgres:
- Production: Neon HTTP driver (`drizzle-orm/neon-http`), uses fetch — no node pg/postgres.js runtime.
- Local dev: PGlite (`@electric-sql/pglite`) via `drizzle-orm/pglite` for an embedded, fast Postgres-compatible environment; or Neon local branch.
- Tests: PGlite for hermetic tests.

We model DI with Effect Tags/Layers:
- DbConfigTag: connection strings, schema defaults, migrations dir
- DrizzleDbTag: typed Drizzle instance created from config

One Layer per driver:
- makeNeonDbLayer(config): uses `drizzle-orm/neon-http`
- makePgliteDbLayer(config): uses `drizzle-orm/pglite`

Swapping drivers requires only Layer changes, not code changes.

## Migrations

- Use drizzle-kit for codegen and migrations.
- Working against an existing DB (preferred): use `drizzle-kit introspect` to generate starter table definitions, then refine types by hand as needed. Keep our migrations minimal or disabled in environments where Archetype owns migrations.
- Bun scripts:
  - `bun run db:introspect` → drizzle-kit introspect (read-only; no schema changes)
  - `bun run db:generate` → drizzle-kit generate (when we own diffs locally)
  - `bun run db:migrate` → drizzle-kit up (only for dev/local or when explicitly owning a change)
  - `bun run db:down` → drizzle-kit down (avoid on shared/production DB)

## Effect Schema Integration

- All externally shaped data must have Effect Schemas (e.g., jsonb columns such as clerk_data, emails metadata, action inputs/outputs).
- At read time: decode jsonb via Effect Schema (`Schema.decodeUnknownSync` or `Effect.try` with async decode) into typed structures.
- At write time: encode via Effect Schema to ensure valid payloads and to protect against drift.
- Prefer module-local schemas colocated with the defining table file, re-exported from schema/schemas.ts for reuse.

## Example: auth.organization

Drizzle (simplified)

```ts
// packages/db/src/schema/auth/organization.ts
import { pgSchema, varchar, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import * as S from "@effect/schema/Schema";

export const Auth = pgSchema("auth");

export const ClerkDataSchema = S.struct({
  // shape mirrors archetype usage, keep permissive at first
}).pipe(S.optional);

export const organization = Auth.table("organization", {
  id: varchar("id").primaryKey().defaultRandom(),
  clerkOrgId: varchar("clerk_org_id").notNull(),
  name: varchar("name").notNull(),
  slug: varchar("slug").notNull(),
  imageUrl: varchar("image_url").notNull(),
  clerkData: jsonb("clerk_data"),
  storeBranchName: varchar("store_branch_name"),
  storeConnectionStringEncrypted: varchar("store_connection_string_encrypted"),
  socialMediaTwitter: varchar("social_media_twitter"),
  socialMediaLinkedin: varchar("social_media_linkedin"),
  socialMediaFacebook: varchar("social_media_facebook"),
  socialMediaInstagram: varchar("social_media_instagram"),
  backgroundImageHorizontalUrl: varchar("background_image_horizontal_url"),
  backgroundImageVerticalUrl: varchar("background_image_vertical_url"),
  description: text("description"),
});

// Unique indexes and FKs are added in migration files via drizzle-kit or builder helpers.
```

Effect Schema use at boundaries

```ts
// packages/db/src/schema/schemas.ts
import * as S from "@effect/schema/Schema";

export const ClerkDataSchema = S.record(S.string, S.unknown); // refine later
```

Read/Write helpers

```ts
// packages/db/src/tags.ts
import { Context, Effect, Layer } from "effect";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

export class DrizzleDbTag extends Context.Tag("effect-ax/DrizzleDb")<DrizzleDbTag, NeonHttpDatabase>() {}

// packages/db/src/client/drizzle.ts
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { DrizzleDbTag } from "../tags";

export const makeDrizzleLayer = Layer.effect(DrizzleDbTag, Effect.sync(() => {
  // construct neon client from injected config (DbConfigTag)
  // return drizzleNeon(neonClient, { schema: { ... } });
}));
```

## Example: builder.chain_run_table

Key columns (based on archetype): inputs jsonb, context_inputs jsonb, formatted_prompt text, result jsonb, error text, model, tokens, cache fields. We mirror with Drizzle types and Effect Schema for jsonb.

```ts
// packages/db/src/schema/builder/chainRun.ts
import { pgSchema, uuid, text, jsonb, numeric, integer, timestamp, boolean, varchar } from "drizzle-orm/pg-core";
import * as S from "@effect/schema/Schema";

export const Builder = pgSchema("builder");

export const ChainInputsSchema = S.record(S.string, S.unknown);
export const ChainResultSchema = S.record(S.string, S.unknown);

export const chainRun = Builder.table("chain_run_table", {
  id: uuid("id").primaryKey().defaultRandom(),
  threadId: text("thread_id").notNull(),
  threadName: text("thread_name").notNull(),
  chainName: text("chain_name").notNull(),
  inputs: jsonb("inputs").notNull(),
  contextInputs: jsonb("context_inputs"),
  formattedPrompt: text("formatted_prompt"),
  duration: numeric("duration"),
  resultType: text("result_type"),
  result: jsonb("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  totalTokens: integer("total_tokens"),
  autohealed: boolean("autohealed"),
  organizationId: varchar("organization_id"),
  userId: varchar("user_id"),
  applicationGroupId: varchar("application_group_id"),
  entityTypeId: varchar("entity_type_id"),
  entityId: varchar("entity_id"),
  columnId: varchar("column_id"),
  relationId: varchar("relation_id"),
  model: varchar("model"),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  cacheKey: text("cache_key"),
  wasCached: boolean("was_cached").default(false),
  cachedInputTokens: integer("cached_input_tokens").default(0),
});
```

## Transactions and Effect

- Provide `withTransaction: <R,E,A>(fa: Effect.Effect<A,E,DrizzleDbTag>) => Effect.Effect<A,E,DrizzleDbTag>` which starts a transaction, runs `fa`, commits/rollbacks using `Effect.acquireUseRelease`.
- For concurrent workloads, expose a connection pool via driver Layer and pass transaction-scoped DB into Effects.

## Topology: Builder DB + Many Customer DBs

Archetype operates with a single Builder database and many customer/organization databases.

- Builder DB: contains platform metadata (auth, builder, billing_tracking, marketing). We connect via `BuilderDbTag` using a single connection/config.
- Customer/Org DBs: per-organization databases holding customer data; connections are derived per org (e.g., Neon branch) and opened on demand.

Integration plan with Drizzle + Effect:
- BuilderDbTag: Drizzle instance connected to the builder DB.
- OrgDbResolverTag: Effect service to resolve a Drizzle instance for a given `organizationId`.
- Optional LRU cache with TTL for org Drizzle instances to avoid churn; release on scope shutdown.

Tags and interfaces

```ts
// src/db/tags.ts
import { Context } from "effect";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

export class BuilderDbTag extends Context.Tag("effect-ax/BuilderDb")<BuilderDbTag, NeonHttpDatabase>() {}

export interface OrgDbResolver {
  readonly get: (organizationId: string) => Effect.Effect<NeonHttpDatabase, DbError, BuilderDbTag | DbConfigTag>;
}
export class OrgDbResolverTag extends Context.Tag("effect-ax/OrgDbResolver")<OrgDbResolverTag, OrgDbResolver>() {}
```

Resolution strategy
- Read connection material from the Builder DB (e.g., `auth.organization.store_connection_string_encrypted` or derive Neon branch naming). Decrypt using env-provided key (`DATABASE_ENCRYPTION_KEY_B64`) via a small Effect service.
- Construct a Neon HTTP client for the org and wrap with Drizzle; memoize by `organizationId`.
- In tests/local, map `organizationId` to a PGlite database (file-backed or in-memory) via the PGlite Layer.

Usage patterns

```ts
// With builder DB
Effect.flatMap(BuilderDbTag, (db) => db.select().from(organization).where(...))

// With org DB
Effect.flatMap(OrgDbResolverTag, (r) => r.get(orgId)).pipe(
  Effect.flatMap((orgDb) => orgDb.select().from(customerSpecificTable).where(...))
);
```

Migration policy
- Builder DB: managed via drizzle-kit in this repo (generate/migrate scripts). Changes are explicit and reviewed.
- Org DBs: no global migrations run from this app unless explicitly invoked; dynamic DDL (e.g., per-entity-type tables, FTS) can be provided behind a separate Effect service and invoked in controlled flows.

## JSONB and Effect Schema

- Always decode JSONB values into well-typed structures using Effect Schema at read time; on write, encode using the same schema.
- Consider thin repositories that encode/decode around Drizzle queries, so the rest of the app only sees validated types.

## Indexes, Constraints, and Triggers

- Recreate unique constraints and FKs defined in Archetype’s schema.sql with drizzle-kit migrations.
- Timestamp triggers in Archetype (`public.trigger_set_timestamp`) can be replaced with application-level `updatedAt` defaults plus explicit updates, or reproduced via raw SQL in migrations if needed.

## Compatibility Requirements (use the same DB)

- Match schema and table names exactly using `pgSchema('name').table('table')`.
- Match column names exactly; avoid renaming to camelCase in Drizzle definitions. Use snake_case identifiers and map them 1:1.
- Enums: define via `pgEnum` with the exact enum name and values present in the DB.
- Arrays: use `.array()` on base types (e.g., `text('labels').array()`).
- Composite PK/UK: use `primaryKey()` and `unique()` builders to mirror constraints for type-level safety; if the DB owns constraints already, reflect them in code without reapplying migrations.
- Foreign keys: add `references(() => ...)` for correctness in code, but avoid applying FKs if the DB already has them (controlled via environment-specific migrate policy).
- JSONB: keep Drizzle `jsonb()` columns untyped at the DB edge; decode/encode via Effect Schema in app code.

## Multi-Tenancy and “Customer Data” (Phase 2)

Archetype dynamically creates per-entity-type tables, metadata columns, and a materialized FTS view with trigram indexes. Porting that behavior:

- Table-per-entity-type: implement via migration helpers that emit `CREATE TABLE` based on DSL inputs and register indexes. Use advisory locks if concurrency is a concern.
- Metadata columns: (updated_at, is_deleted, in_status_since) as standardized helpers.
- FTS: create a materialized view that unions all entity tables; add GIN indexes for tsvector and trigram for text/display_name. Provide a refresh function.
- DI: put these builders behind an Effect service (e.g., `CustomerDataMigratorTag`) so they can be reused and tested.

This phase is optional for initial chat-focused needs; we can prioritize the core static schemas first.

## Environment and Config

- Bun auto-loads `.env` — inject connection config via `DbConfigTag` (e.g., `DATABASE_URL`, `NEON_API_KEY`, `DRIZZLE_MIGRATIONS_DIR`).
- No secrets in code; all credentials via env + Layers.
- Provide per-env Layers: Dev (PGlite), Preview (Neon branch), Prod (Neon main/branch), Test (PGlite).

## Developer Experience

- Single import for the DB service; tables co-located with Effect Schemas.
- Swap drivers by changing the provided Layer; same code works locally and in prod.
- `bun run db:generate`, `bun run db:migrate`, `bun run db:down` wired to drizzle-kit.
- `bun typecheck` and `bun test` before feature handoff.

## Next Steps

1) Scaffold packages/db with schema folders for auth, builder, billing_tracking, marketing.
2) Add drizzle.config.ts and Bun scripts for generate/migrate.
3) Implement DI layers for Neon/PGlite; wire `DrizzleDbTag` and `withTransaction` helper.
4) Port core tables (auth.organization, auth.user, builder.chain_run_table, billing_tracking.usage_metrics) and a couple of essential FKs/indexes.
5) Integrate Effect Schema for jsonb columns; add minimal decoding/encoding helpers.
6) Validate by generating migrations and diffing with a subset of Archetype’s schema.sql where applicable.
