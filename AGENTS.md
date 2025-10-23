# Agent Charter

- Maintain shared context: update `AGENTS.md` whenever expectations or processes change so every agent inherits the same source of truth.
- Coordinate via effects: prefer composing new capabilities as `Effect` programs so they can be reused, tested, or provided via layers without side effects.
- Try to never cast and never use any, everything should be typesafe
- Favor declarative Ax signatures: define desired outcomes in Ax signatures first, then refine with assertions or optimizers instead of manual prompt tweaks.
- Preserve reproducibility: keep configuration (API keys, model selections, optimization strategies) injectable via layers or environment tags—never hard-code secrets.
- Validate safety first: add assertion guards for risky operations (external tool calls, system commands, data mutations) before enabling autonomous execution.
- Stream responsibly: when exposing streaming outputs, wrap them in `Stream` utilities so downstream agents can backpressure, transform, or log incrementally.
- Communicate deltas: summarize code or prompt changes succinctly in pull requests or handoffs, highlighting behavioral shifts, new dependencies, and validation steps.
- Exercise test discipline: integrate effect-based property tests or replayable transcripts whenever behavior could regress silently.
- Close feature-sized tasks with a typecheck pass (`bun typecheck`) and resolve any surfaced issues before handoff.
- Escalate anomalies: if production data, secrets, or policy conflicts surface, halt execution and request explicit human guidance before proceeding.
- Prefer Effect Schema for runtime validation and type inference when shaping external data; re-evaluate existing code paths and adopt schemas where the added safety outweighs the overhead.
- Bias toward simple, readable implementations that avoid duplication and favor performance where it matters—clarity first, DRY second, efficiency third.

## Bun Workflow Standards

- Default to Bun for execution, bundling, installs, tests, and scripting (e.g. `bun <file>`, `bun run <script>`, `bun test`, `bun install`, `bun build <entry>`); avoid Node, npm, yarn, pnpm, ts-node, webpack, or esbuild equivalents.
- Leverage Bun platform APIs instead of third-party stand-ins: `Bun.serve` (never `express`) with HTTPS/WebSocket routes, `bun:sqlite` (no `better-sqlite3`), `Bun.redis` (no `ioredis`), `Bun.sql` (no `pg`/`postgres.js`), built-in `WebSocket` (no `ws`), `Bun.file` (prefer over `node:fs`), and template literals via `Bun.$` (no `execa`).
- Skip dotenv loading; Bun auto-loads `.env`.
- For frontend needs, serve HTML imports through `Bun.serve`, letting Bun bundle React, CSS, Tailwind, and related assets without Vite/Webpack.
- Exercise testing via `bun test` with the `bun:test` runner and avoid Jest/Vitest equivalents.
- Use Bun’s dev ergonomics (`bun --hot`, etc.) when hot reload or live bundling is desired.
- Before spelunking through vendored `.d.ts` files, consult the freshest package documentation via Context7; only fall back to local type exploration if the docs lack the needed information.
- AX documentation for a LLM can be found at https://axllm.dev/llm.txt
