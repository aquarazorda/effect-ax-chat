# Headroom Multi-Agent Migration Plan

## 1. Prompt & Instruction Porting

- Catalogue `docs/Poke/Poke_p*.txt` plus `Poke-agent.txt`, annotate sections that need Headroom-specific branding, product surface, and policy updates.
- Produce modular prompt bundles (`HeadroomFrontAgent`, `HeadroomExecutionAgent`, `HeadroomSafety`), trimming legacy references (Palo Alto, Poke URLs) while preserving behavioral constraints (confirmation before send, no fabrication, tool visibility rules).
- Define Ax signatures for each prompt component (e.g. `conversation:string -> response:string`) so Ax programs can load, compose, and version prompts declaratively.

## 2. Effect Context & Configuration

- Model runtime dependencies as Effect services: `HeadroomEnv` (feature flags, endpoints), `Toolbelt` (tool clients), `TriggerRegistry` (schedule/email metadata).
- Provide Layers that hydrate these services from configuration files or environment variables, using schema validation to guard against missing values.
- Integrate prompt resources via a filesystem or KV-backed Layer, returning typed prompt payloads for Ax invocations.

## 3. Conversation Orchestrator

- Implement a `HeadroomOrchestrator` Effect module mirroring the Poke front-agent → execution-agent pipeline, routing user messages to the front agent Ax program and delegations to the execution Ax program.
- Enforce confirmation workflows (e.g. email drafts shown before send) within the orchestrator using Effect control flow and guard Effects.
- Maintain compatibility with Headroom’s conversation summary and memory feeds by injecting them as part of the Effect environment prior to each Ax run.

## 4. Tooling & Parallelism

- Wrap Headroom integrations (email, calendar, browser automation, CRM, etc.) in Effect services exposing minimal, typed interfaces.
- Expose these services to Ax via tool-call bindings or side-effecting functions, ensuring Ax programs can request parallel execution when allowed.
- Implement concurrency patterns with `Effect.all` / `Effect.allPar` and `Effect.race` to satisfy the original “launch parallel tasks when possible” requirement.

## 5. Triggers & Notifications

- Translate trigger semantics into Effect-managed jobs: cron triggers, email triggers, and notification-only flows with enforced action specificity.
- Build Ax programs responsible for drafting trigger actions while keeping communication phrasing hidden behind Headroom terminology.
- Add safety checks that cancel or defer inappropriate notifications via Effect guards (akin to Poke’s `wait` tool behavior).

## 6. Memory & Context Handling

- Consume conversation summaries and persistent memory through a dedicated Effect data source that feeds context into Ax signatures without leaking implementation details to the user.
- Add prompt clauses reinforcing “never mention memory retrieval” while still leveraging the supplied context for continuity.
- Provide tests ensuring fallback behavior when memory data is missing or incomplete.

## 7. Safety, Compliance & Testing

- Codify “never fabricate” and visibility policies as runtime assertions using `Effect.flatMap` validation steps on Ax outputs.
- Add property/vitest tests covering messaging flows (draft confirmation, privacy toggles, unsubscribe instructions) and trigger creation logic.
- Document incident handling (e.g. external data gaps) so agents escalate to Headroom operators instead of guessing.

## 8. Deployment & Ops

- Wire the new Ax programs through the existing wrapper utilities in `index.ts`, exporting convenience helpers for downstream Headroom services.
- Produce smoke-test scripts invoking sample conversations, trigger setups, and parallel tool calls to verify orchestration.
- Update `AGENTS.md` with Headroom operational specifics (support channels, privacy messaging) and maintain version tracking for prompt bundles.
