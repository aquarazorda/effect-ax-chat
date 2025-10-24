# Agent Charter

- Maintain shared context: update `AGENTS.md` whenever expectations or processes change so every agent inherits the same source of truth.
- Coordinate via effects: prefer composing new capabilities as `Effect` programs so they can be reused, tested, or provided via layers without side effects.
- Try to never cast and never use any, everything should be typesafe
- Avoid type assertions (`as ...`) and non-null assertions (`!`). Prefer Effect Schema validation, Option/Either, and well-typed constructors over assertions.
- Favor declarative Ax signatures: define desired outcomes in Ax signatures first, then refine with assertions or optimizers instead of manual prompt tweaks.
- Preserve reproducibility: keep configuration (API keys, model selections, optimization strategies) injectable via layers or environment tags—never hard-code secrets.
- Validate safety first: add assertion guards for risky operations (external tool calls, system commands, data mutations) before enabling autonomous execution.
- Stream responsibly: when exposing streaming outputs, wrap them in `Stream` utilities so downstream agents can backpressure, transform, or log incrementally.
- Communicate deltas: summarize code or prompt changes succinctly in pull requests or handoffs, highlighting behavioral shifts, new dependencies, and validation steps.
- Exercise test discipline: integrate effect-based property tests or replayable transcripts whenever behavior could regress silently.
- Close feature-sized tasks with a typecheck pass (`bun typecheck`) and resolve any surfaced issues before handoff.
- Escalate anomalies: if production data, secrets, or policy conflicts surface, halt execution and request explicit human guidance before proceeding.
- Prefer Effect Schema for runtime validation and type inference when shaping external data; re-evaluate existing code paths and adopt schemas where the added safety outweighs the overhead.
- Model all externally shaped data (webhooks, SDK payloads, configs) with Effect Schema and derive types from schemas; validate at boundaries, avoid interface-only types.
- Keep memory/persistence pluggable via Tag/Layer DI (e.g., mailbox factories, session indexes); avoid global singletons or hard-wired in-memory maps.
- Bias toward simple, readable implementations that avoid duplication and favor performance where it matters—clarity first, DRY second, efficiency third.

## Permissions Architecture (Shared Context)

- All reads/mutations involving entity types, entities, actions must go through typed services with DI, never raw DB handles from app/agent code.
- Builder DB (metadata):
  - AuthorizationServiceTag: loads grouped relation‑path authorizations (read, per‑field‑group, action execute, activity log) from `builder.data_model_authorization`.
  - EntityTypeServiceTag, ActionServiceTag: fetch entity types/actions along with their authorizations, using Drizzle + Effect Schema decoding.
- Permission planning (enforcement):
  - PermissionEngineTag: produces plans for entity read and action execution.
    - EntityReadPlan includes mode (`denyAll` | `filter` | `allowAll`), field‑group policy, relation traversal steps, and subject anchor (user entity id).
    - Deny‑by‑default on errors. “Anyone‑with‑link” scopes are only granted when a `LinkTokenVerifierTag` validates the token.
- Org data (customer DB):
  - OrgDbResolverTag: resolves per‑org Drizzle connections; no raw access in app code.
  - OrgEntityStoreTag: executes authorized queries based on a filter plan. Supports allowAll, one‑hop and multi‑hop traversal (fixed‑length chained CTEs) with workspace‑bound version mapping. Column projection is pushed down for display/status based on granted field‑groups.
- Query endpoint:
  - EntityQueryServiceTag: the only entry point for fetching entities. It consumes PermissionEngine, derives a (currently) one‑hop filter, and delegates to OrgEntityStore. No “get all” escape hatches.

Notes

- Avoid `as`/non‑null assertions. Use Effect Schema decoding for branded ids (e.g., `S.decodeUnknownSync(FieldGroupIdSchema)`), Option/Either for control flow, and typed constructors.
- Streaming results should be wrapped with `Stream` when added, to support backpressure and incremental processing.
- Workspace version mapping (via `workspace_version_*` + `version_refs`) replaces latest‑by‑created_at for entity and relation versions.

Known Exceptions

- `src/db/connect.ts` uses narrow `as any` casts for driver‑specific Drizzle transaction/execute health checks due to upstream type surface. Keep these localized and do not propagate casts into service layers.

## Bun Workflow Standards

- Default to Bun for execution, bundling, installs, tests, and scripting (e.g. `bun <file>`, `bun run <script>`, `bun test`, `bun install`, `bun build <entry>`); avoid Node, npm, yarn, pnpm, ts-node, webpack, or esbuild equivalents.
- Leverage Bun platform APIs instead of third-party stand-ins: `Bun.serve` (never `express`) with HTTPS/WebSocket routes, `bun:sqlite` (no `better-sqlite3`), `Bun.redis` (no `ioredis`), `Bun.sql` (no `pg`/`postgres.js`), built-in `WebSocket` (no `ws`), `Bun.file` (prefer over `node:fs`), and template literals via `Bun.$` (no `execa`).
- Skip dotenv loading; Bun auto-loads `.env`.
- For frontend needs, serve HTML imports through `Bun.serve`, letting Bun bundle React, CSS, Tailwind, and related assets without Vite/Webpack.
- Exercise testing via `bun test` with the `bun:test` runner and avoid Jest/Vitest equivalents.
- Use Bun’s dev ergonomics (`bun --hot`, etc.) when hot reload or live bundling is desired.
- Before spelunking through vendored `.d.ts` files, consult the freshest package documentation via Context7; only fall back to local type exploration if the docs lack the needed information.
- AX documentation for a LLM can be found at https://axllm.dev/llm.txt

## Module Structure Guidelines

- Avoid barrel files (index.ts that re-export entire folders). Import only what you need from concrete modules so tree‑shaking remains effective and bundle size stays minimal.
- Place all imports at the top of the file. Do not add imports inside functions or mid‑file; prefer static ESM imports at module scope and keep side‑effect imports explicit.

## Environment Configuration

- Read environment variables via `src/env.ts` (AppEnvTag + makeEnvLayer). Do not access `process.env` or `Bun.env` directly in application code.
- Validate required envs with Effect Schema; fail fast on startup. Inject derived configs (e.g., DbConfigTag) via Layers.
