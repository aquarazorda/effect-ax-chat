# Max Agent: Minimal Tooling Plan

## Goals

- Two or three small, fast tools that expose only the data the agent needs to reason and act.
- Always operate on the latest version (no version IDs in inputs/outputs).
- Include system entity types (People/Company/Meetings) in listings — system types appear first.
- Enforce permissions via our existing services and plans; deny-by-default on errors.
- Keep responses tiny and deterministic to minimize token/computation usage.

## Principles

- Use Effect programs with DI; no raw DB handles in agent/tool code.
- Runtime validation with Effect Schema; avoid casts and non-null assertions.
- All configuration via `src/env.ts` layers (never read envs directly elsewhere).
- Permission planning gates every data read; tools never bypass enforcement.
- Tests must never be skipped; failures surface and are fixed at the root cause.

## Tool Set (Surface Area)

- listEntityTypes
  - Purpose: discover “what exists?”
  - Behavior: returns all entity types for the org, with system types ordered first; latest versions only.
  - Output: minimal list — `{ id, name, pluralName }[]`.

- listColumnsForType (optional but recommended)
  - Purpose: reveal identifiers for reasoning (e.g., phone/email/name) without extra metadata.
  - Behavior: resolves the latest version for the type; returns only stable identifiers. Supports an optional filter to minimize payload.
  - Input (extended): `{ organizationId, entityTypeId, filter?: { nameContains?: string[], max?: number } }`
  - Output: minimal list — `{ id, name }[]`.

- findEntities
  - Purpose: fast, precise lookups to anchor user context or answer questions.
  - Inputs: `{ entityTypeId, filters: [{ columnId, op: "eq" | "ilike", value }], limit?: number, cursorEntityId?: string, selectColumns?: string[] }`.
  - Behavior: pushes projection into SQL; returns only display basics by default; optionally includes a small set of requested columns; keyset pagination via `cursorEntityId`.
  - Output: `{ total, entities: [{ entityId, displayName?, status?, columns?: Record<string, unknown> }], nextCursorEntityId? }`.

## Signatures (Ax)

- listEntityTypes
  - input: `{ organizationId }`
  - output: `{ entityTypes: [{ id, name, pluralName }] }`

- listColumnsForType
  - input: `{ organizationId, entityTypeId, filter?: { nameContains?: string[], max?: number } }`
  - output: `{ columns: [{ id, name }] }`

- findEntities
  - input: `{ organizationId, entityTypeId, filters: [{ columnId, op, value }], limit?: number, cursorEntityId?: string, selectColumns?: string[] }`
  - output: `{ total, entities: [{ entityId, displayName?, status?, columns?: Record<string, unknown> }], nextCursorEntityId? }`

Notes

- Organization id is provided by environment/layer; the agent never infers it.
- Version type is fixed to `prod` for the demo; the store resolves the latest version internally.

## Permissions & Enforcement

- Entry point is `EntityQueryServiceTag`; it consumes `PermissionEngineTag` and produces a filter plan.
- `OrgEntityStoreTag` executes the filter; deny-by-default behavior is preserved.
- No “get all” escape hatches; every query must be filterable and paginated.

## Versioning (Latest Only)

- Catalog/store resolve the single latest version for entity and relation types:
  - Prefer org-mapped versions via `builder.version_refs`.
  - Fall back to the latest workspace version for system/unmapped cases.
- Tools never accept or return version IDs.

## Output Constraints

- listEntityTypes: only id/name/pluralName; system first.
- listColumnsForType: only id/name.
- findEntities: only `{ entityId, displayName?, status? }` plus counts; optionally selected columns if explicitly requested.
- No raw field dumps to keep outputs small and reduce LLM exposure.

## Agent Flow (Recommended)

- First turn (anchoring):
  - Call `listEntityTypes` → select People (system-first ordering helps).
  - Call `listColumnsForType` to discover likely identifier columns (phone/email/name) if needed; use `filter.nameContains` and `max` to fetch a tiny subset.
  - Call `findEntities` with an `eq` filter on phone/email to resolve the user anchor; persist in session.

- Subsequent turns:
  - Choose target entity type by name from `listEntityTypes`.
  - If needed, fetch columns to select the right identifier/display column (use `filter.nameContains`).
  - Call `findEntities` with `eq`/`ilike` as appropriate. Use `selectColumns` for at most a few extra fields needed to answer. Use small `limit` and paginate with `cursorEntityId`.
  - If 0 results, ask for refinement; if >1, ask to disambiguate.

## Performance

- Use Drizzle with prepared statements; push projection to SQL.
- Cache `listEntityTypes` per org for 30–60s in-memory.
- Default `findEntities.limit` small (e.g., 5); support keyset pagination.
- Trace spans for each tool (tookMs, counts). Log in DEBUG only.

## Error Handling & Safety

- Validate inputs with Effect Schema; reject malformed filters early.
- Sanitize filter values and column identifiers; resolve physical names safely.
- Deny-by-default on permission errors; return empty results instead of leaking information.
- Enforce a small cap on `selectColumns` (e.g., max 5) and on `filter.max` to prevent large payloads.

## Implementation Checklist

- Catalog
  - Ensure `listEntityTypes` includes system ETs first; dedupe per type (latest only).
  - Ensure `listColumnsForType` resolves latest version when no mapping exists.

- Store
  - Confirm latest-version fallback for entity/relation resolution.
  - Ensure projection-only selects (entityId, displayName?, status?).
  - Implement `eq` and `ilike` filters with safe literals and keyset pagination.
  - Add optional projection of requested `selectColumns` into a `columns` JSON object.

- Agent
  - Replace ad hoc calls with the three tools only; remove filler replies.
  - Persist anchor (People entityId) in session.
  - When extra fields are needed, prefer `listColumnsForType` with `filter.nameContains` and then `findEntities.selectColumns` to retrieve exactly those fields.

- Telemetry
  - Add spans: tool name, org, tookMs, total, entity count (no raw data).

- Tests (no skips)
  - Catalog returns >0 types and includes system at the top.
  - Columns return >0 for People.
  - findEntities returns correct shape; respects counts and pagination; denies when no anchor; returns `columns` only when requested.

## Files/Services

- Catalog: `src/services/EntityTypeCatalog.ts`
- Store: `src/services/OrgEntityStore.ts`
- Query: `src/services/EntityQueryService.ts`
- Env: `src/env.ts`
- Permissions: `src/permissions/*`
- Agent: `src/app/agents/MaxAgent.ts`

## Notes

- Keep tool outputs intentionally minimal to reduce tokens and ambiguity.
- This minimal set is sufficient for initial discovery, anchoring, and targeted lookups across the org datasets.

## Conversation UX (Language & Tone)

- Never mention implementation details: do not say “entity”, “id”, “column”, “table”, “filter”, or internal names.
- Prefer natural, human language: describe things as “people”, “companies”, “meetings”, “notes”, etc.
- Show only useful, understandable fields: names, statuses, dates — not internal identifiers.
- Be concise and friendly; avoid filler like “On it…”. Acknowledge, act, and report results with next steps.
- Ask clarifying questions when queries are ambiguous (e.g., multiple matches or missing identifiers).
- Summarize results:
  - 0 results: say you didn’t find it and propose exact next steps.
  - 1 result: present the match clearly.
  - Many results: show the top few by name and ask the user to narrow down.
- Privacy: don’t reveal information the user isn’t authorized to see; if restricted, say you don’t have access rather than exposing system terms.
- Latency: keep replies short; only expand when the user asks.

### Prompt Contract for Max (excerpt)

- You are a helpful assistant. Speak plainly without technical jargon.
- Never mention internal terms like “entity”, “id”, “column”, or “database”.
- When I ask about a person or company, show only their name and a brief status or date if relevant.
- If there are multiple possible matches, list a few names and ask me to choose.
- If you lack permission or data, say so plainly and offer how to proceed.
