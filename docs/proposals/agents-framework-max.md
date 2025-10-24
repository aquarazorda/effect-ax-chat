# Proposal: Agents Framework and “Max” Assistant (Effect‑AX)

This proposal defines an agent framework for Effect‑AX and the first assistant, “Max”. It aligns with our Agent Charter: schema‑first validation, Tag/Layer DI, no casts, reproducible configs, and safe streaming. It also incorporates AX agent/signature patterns (Context7: /ax-llm/ax) for tool use and streaming responses.

## Goals

- Conversational agent (“Max”) with a clear system prompt and tone.
- Tool use via typed functions (Effect Schema) backed by our permissioned services.
- Fast, low‑latency responses with streaming and early acks; Telegram demo first.
- Safety: deny‑by‑default, validated inputs/outputs, and explicit guards for side effects.
- DI and reproducibility: all configs via Layers; no hard‑coded secrets.

## Architecture Overview

- Runtime
  - Session orchestration via `SessionRegistry` + `Mailbox` (already in repo) for per‑user conversations and backpressure.
  - Chat transport via `ChatClient` (Telegram first) with `incoming` stream and `send` effect.
- Agent core
  - Ax signature defines desired outcomes; Ax Agent provides streaming and tool use.
  - Tools (Ax functions) call typed services: `PermissionEngineTag`, `EntityQueryServiceTag`, `ActionServiceTag`.
  - All tool parameters/results validated with Effect Schema; no `as`/non‑null assertions.
- Streaming
  - Use AX `streamingForward(...)` and wrap deltas in Effect `Stream` for typed backpressure.
  - Telegram connector adapts streamed chunks into incremental edits/partials for perceived speed.
- Safety and permissions
  - All reads/writes go through service tags; no raw DB handles in agent code.
  - Deny‑by‑default on planning errors; link token grants restricted to field groups.

## “Max” System Prompt and Tone

Max is Headroom’s fast, crisp assistant. Tone and interaction rules:

- Be quick, concise, and helpful; default to tight bullet points and short sentences.
- Proactively summarize and propose the next action; avoid verbosity and small talk.
- Always use available tools for factual data (entities/actions); never guess.
- Respect permissions and privacy; escalate risky operations and ask before executing.
- Stream partial results when available; acknowledge long operations immediately.
- Prefer declarative goals (Ax signatures) over prompt tweaks; reflect constraints back succinctly.

Example system preamble (summarized):

“You are Max, Headroom’s assistant. Be fast, crisp, and reliable. Use tools for entity search, summaries, and actions. Stream partial results. Respect permissions and privacy. Ask before risky changes. Prefer short answers with clear next steps.”

## Ax Signatures (Declarative Outcomes)

- Conversation signature (baseline)
  - `ax("message:string -> reply:string, toolPlan?:string, actionsTaken:string[], citations?:string[]")`
  - Purpose: produce a final reply, optionally describe planned tool use, and return executed actions for logging.
- Entity Q&A signature
  - `ax("question:string, entityRef?:string, orgId:string -> answer:string, supportingEntities?:string[], fieldGroupsUsed?:string[]")`
- Action execution signature (guarded)
  - `ax("intent:string, entityId:string, actionId:string -> confirmation:string, dryRunPlan:string")` — must run in dry‑run first; tool decides if execution is permitted and requests confirmation.

Use `setDescription`, `setDemos`, and `setExamples` to ground the agent; use `streamingForward` for response streaming (Context7 AX docs).

## Tools (Ax Functions) and Safety Guards

All tools use Effect Schema input/output shapes, call typed services, and return Either‑like results for error surfaces. Representative tools:

- searchEntities
  - Params: `{ orgId, versionType, entityTypeId, query: string, limit?: number }`.
  - Behavior: uses `PermissionEngineTag` + `EntityQueryServiceTag` with pushdown filters; returns minimal display payloads and ids.
- getEntitySummary
  - Params: `{ orgId, versionType, entityId }`.
  - Behavior: fetch authorized fields; optionally call a summarizer Ax signature (LLM) to format a crisp summary with citations.
- listAvailableActions
  - Params: `{ orgId, versionType, entityId }`.
  - Behavior: uses `ActionServiceTag` + PermissionEngine to return allowed actions.
- executeAction
  - Params: `{ orgId, versionType, entityId, actionId, args }`.
  - Guards: requires prior confirmation; validates args; logs a dry‑run plan; denies on planner error.

General rules

- Validate inputs at boundaries; decode brand ids with Effect Schema.
- No raw SQL or direct Org DB handles; use `OrgDbResolverTag`/`OrgEntityStoreTag` via services.
- Deny‑by‑default; on errors, reply with a concise explanation and suggested next step.

## Streaming and Performance

- Immediate ack
  - Send a short acknowledgment within 100–200ms (“On it… fetching entities”) while tools run.
- Streaming
  - Use AX `streamingForward` to emit `delta`+`value` updates; adapt to Telegram via message edits or chunked sends.
  - Provide a `Stream` facade so downstream consumers can backpressure or log.
- Timeouts and aborts
  - Use AbortSignal to cancel slow model/tool calls; surface partial results.
- Caching
  - Warm `SchemaReaderTag` caches; memoize frequent entity type lookups; reuse org connections.
- Model selection
  - Prefer fast, inexpensive models for routing and listings; escalate to larger models only for complex summarization.

## Telegram Demo (MVP)

- Flow
  - User: “Find the customer named Acme and show open tickets.”
  - Max: quick ack; calls `searchEntities` for Customer, then for Tickets via relation traversal; streams a crisp summary.
  - If user asks to execute an action (e.g., “Close ticket T‑123”), Max presents a dry‑run plan and asks for confirmation.
- Implementation sketch
  - Agent factory: `src/app/agents/MaxAgent.ts` — wraps Ax agent with Max’s system prompt, signatures, and functions above.
  - Example entrypoint: `src/app/examples/telegram-max.ts` — mirrors `telegram-echo.ts` but wires `makeMaxAgent`.
  - Reuse `SessionRegistry` with policy `{ idleTtlMillis: 10 * 60_000, mailbox: { capacity: 1024, strategy: 'bounded' } }`.
  - Environment via `src/env.ts` (AppEnvTag + makeEnvLayer). No direct env access.

## Data Flow

1. Telegram → `ChatClient.incoming` → `SessionRegistry.route` enqueues message.
2. Session mailbox → `MaxAgent` handler.
3. Ax signature `streamingForward` starts; early ack sent via `ctx.send`.
4. Tools run through typed services (permission enforced); results streamed back.
5. Final `reply` and `actionsTaken` emitted; session stays warm until idle TTL.

## Layers and DI

- Use Layers to assemble: Telegram client + Mailbox factory + Session index + Session registry + Max agent.
- Tool Layers depend on: `PermissionEngineTag`, `EntityQueryServiceTag`, `ActionServiceTag`.
- All configuration via `AppEnvTag` and derived config layers; no hard‑coded secrets.

## Observability and Safety

- Structured logs with spans: `session.route`, `session.handle`, `telegram.send`, `tools.searchEntities`, `tools.executeAction`.
- Redact PII in logs; annotate with `orgId`, `entityTypeId`, and request ids.
- Metrics: latency per tool call, model token usage, error rates, and abort counts.

## Open Questions

- Memory: Should Max retain short‑term conversation notes per session or rely on tool state only? Start stateless; add Ax memory later if needed.
- Tool surfacing: How should Max expose field‑group restrictions in replies (inline vs. footnote)? Start with concise footnotes.
- Action safeguards: Should some actions require multi‑step confirmation or reviewer approval? Default to single confirmation; extendable.

## Implementation Plan

1. Define Max’s Ax signatures and system prompt; set description/demos/examples.
2. Implement tools with Effect Schema validation and service calls; add dry‑run guard for `executeAction`.
3. Create `makeMaxAgent(ctx)` using Ax `streamingForward` and tool set; send early acks.
4. Add `src/app/examples/telegram-max.ts`; wire through existing layers; reuse `.env` `TELEGRAM_TOKEN`.
5. Typecheck + tests: `bun typecheck`, `bun test` for tool schemas and planner guards.
6. Iterate on streaming UX and tone tuning; measure latency and adjust model selection.

## Appendix: AX Fit (Context7 snippets)

- Streaming agents: `streamingForward(parentAi, values, options)` yields incremental `AxGenStreamingOut` updates.
- ReAct/tool use: define `functions: [{ name, parameters, func }]` and let Ax plan calls.
- Prompt ergonomics: use `setDescription`, `setDemos`, `setExamples` to ground behavior over manual prompt hacks.
