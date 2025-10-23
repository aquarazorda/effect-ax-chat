# Proposal: Per‑User Session Fibers and Multi‑Channel Routing

This document proposes how to ensure each unique user (e.g., phone number) is handled by its own dedicated fiber (actor-like session), while keeping transports (SMS, iMessage, WhatsApp, Telegram, etc.) interchangeable. It also outlines the developer experience for building, testing, and operating this system using Effect + Bun, with Effect Schema for runtime validation and Tag/Layer-based DI for pluggable memory/persistence.

## Goals

- One session per unique user with sequential handling (no races per user) and concurrent handling across users.
- Decouple transports from runtime; reuse the same session/agent logic for SMS, iMessage, WhatsApp, Telegram, Slack, Web, etc.
- Declarative, typesafe APIs that integrate with Ax for agent behaviors.
- Stream-friendly processing with backpressure and safe boundaries for IO.
- Clear lifecycle (spawn, idle timeout, shutdown) with optional durability.
- Pluggable persistence (in-memory by default, `bun:sqlite` and `Bun.redis` as options).

## Key Concepts

- UserKey: a stable, cross-channel user identity (e.g., E.164 phone number for SMS; platform user id for Telegram), plus the platform for disambiguation.
- Session: an actor-like fiber per UserKey that processes a mailbox sequentially. It owns agent state and is the place to keep conversation context.
- SessionRegistry: a keyed registry that creates/fetches sessions on demand, pushes messages to their mailbox, and reaps idle sessions.
- Router: subscribes to client `incoming` stream and forwards messages to the right Session.
- Transport Client: a `ChatClient` implementation for each platform; provides normalized `IncomingMessage` and `OutgoingMessage`.
- Agent Adapter: a function that, given a `UserContext`, returns an Effect program (or Ax signature) to process messages.

Schema-first shapes
- All externally shaped data must be defined with Effect Schema. Derive static types from schemas; validate inputs at boundaries (webhooks, SDK callbacks) and encode outputs when crossing process boundaries.

## Message Model (existing)

The repo already defines `IncomingMessage` and `OutgoingMessage` in `src/clients/ChatClient.ts`. We’ll extend in a backward‑compatible way by adding a computed `userKey` in the router layer (no breaking changes required):

- `userKey.platform`: literal union like `"sms" | "imessage" | "whatsapp" | "telegram" | ...` (fallback `string` allowed)
- `userKey.id`: stable external id for the user on that platform

For SMS/WhatsApp via Twilio, `userKey.id` is the E.164 phone number. For Telegram, it is `senderId`.

## Architecture Options

1) In‑Memory Session Registry (default)
- Mechanism: a `Map<UserKey, Session>` where each `Session` has a `Queue<IncomingMessage>` (mailbox) and a dedicated fiber that loops `Queue.take`, handling messages sequentially.
- Lifecycle: sessions spawn on first message; an inactivity timer (e.g., 5–15 minutes) reaps idle sessions; capacity strategy configurable (`unbounded`, `bounded`, `sliding`, `dropping`).
- Pros: simplest to ship; great local DX; predictable ordering per user; no external deps.
- Cons: not durable across process restarts; single instance only.

2) Redis‑Backed Mailboxes (horizontal scale)
- Mechanism: per‑user Redis Stream or Pub/Sub channel (`Bun.redis`). A pool of workers (instances) claims users via consumer groups. Only one worker owns a given user at a time → preserves per‑user ordering.
- Lifecycle: leases expire on crash; workers resume from last acked id.
- Pros: horizontal scale; replay/durability; failover.
- Cons: operational overhead; requires Redis.

3) Durable Local Sessions (SQLite)
- Mechanism: persist mailbox and checkpoints to `bun:sqlite`. A single instance can recover sessions after restart. Useful for simple deployments without Redis.
- Pros: durable without network dep; simple ops.
- Cons: single writer; not horizontally scalable without additional coordination.

The system should default to Option 1, with interfaces that allow swapping to Options 2 or 3 without changing app/agent code.

## Types and Interfaces (proposed, Schema-first)

```ts
// src/runtime/UserKey.ts (Schema)
import * as S from "@effect/schema/Schema";

export const UserKeySchema = S.struct({
  platform: S.union(
    S.literal("sms"),
    S.literal("imessage"),
    S.literal("whatsapp"),
    S.literal("telegram"),
    S.string // fallback for future platforms
  ),
  id: S.string.pipe(S.minLength(1)) // E.164 for SMS, sender id for Telegram
});
// type UserKey = S.TypeOf<typeof UserKeySchema>

// src/clients/MessageSchemas.ts (Schema for existing message model)
export const IncomingMessageSchema = S.struct({
  chatId: S.string,
  senderId: S.string,
  text: S.string,
  receivedAt: S.Date, // internal model uses Date
  metadata: S.optional(S.record(S.string, S.unknown))
});
export const OutgoingMessageSchema = S.struct({
  chatId: S.string,
  text: S.string,
  replyToMessageId: S.optional(S.string),
  metadata: S.optional(S.record(S.string, S.unknown))
});

// src/runtime/Session.ts (interfaces remain, but rely on schemas at the edges)
import { Effect, Queue } from "effect";

export interface UserContext {
  readonly key: S.TypeOf<typeof UserKeySchema>;
  readonly send: (message: S.TypeOf<typeof OutgoingMessageSchema>) => Effect.Effect<void, never>;
}

export interface Session {
  readonly key: S.TypeOf<typeof UserKeySchema>;
  readonly mailbox: Queue.Queue<S.TypeOf<typeof IncomingMessageSchema>>;
  readonly fiber: Effect.Fiber.RuntimeFiber<void, never>;
}

export interface SessionPolicy {
  readonly idleTtl: Duration;    // e.g., 10 minutes
  readonly mailbox: {
    readonly capacity: number;   // 0 => unbounded
    readonly strategy: "unbounded" | "bounded" | "sliding" | "dropping";
  };
}

export type AgentFactory<R, E = never> = (
  ctx: UserContext
) => (
  message: S.TypeOf<typeof IncomingMessageSchema>
) => Effect.Effect<void, E, R>;
```

## Pluggable Memory via DI

Introduce DI services to abstract memory/persistence and mailbox semantics. Default implementations are in‑memory; others (Redis, SQLite) can be provided via Layers without changing agent or app code.

```ts
// src/runtime/Mailbox.ts
import { Context, Effect } from "effect";

export interface Mailbox<A> {
  readonly offer: (a: A) => Effect.Effect<void, never>;
  readonly take: Effect.Effect<A, never>;
  readonly shutdown: Effect.Effect<void, never>;
}

export interface MailboxFactory<A> {
  readonly create: (
    key: S.TypeOf<typeof UserKeySchema>,
    policy: SessionPolicy["mailbox"]
  ) => Effect.Effect<Mailbox<A>, never>;
}

export class MailboxFactoryTag extends Context.Tag("effect-ax/MailboxFactory")<
  MailboxFactoryTag,
  MailboxFactory<S.TypeOf<typeof IncomingMessageSchema>>
>() {}

// src/runtime/SessionIndex.ts (tracks active sessions)
export interface SessionIndex<V> {
  readonly get: (k: string) => Effect.Effect<V | undefined, never>;
  readonly set: (k: string, v: V) => Effect.Effect<void, never>;
  readonly delete: (k: string) => Effect.Effect<void, never>;
}

export class SessionIndexTag extends Context.Tag("effect-ax/SessionIndex")<
  SessionIndexTag,
  SessionIndex<Session>
>() {}

// Default in-memory layers (swappable)
export const makeInMemoryMailboxFactoryLayer: Layer.Layer<MailboxFactoryTag> = ...
export const makeInMemorySessionIndexLayer: Layer.Layer<SessionIndexTag> = ...
```

Registry depends only on these interfaces; alternate implementations (Redis Streams, SQLite) can be injected by changing Layers.

## Router and Registry (proposed)

```ts
// src/runtime/SessionRegistry.ts
import { Effect, Layer, Queue, Ref, Runtime } from "effect";
import { ChatClientTag } from "../clients/ChatClient";
import type { AgentFactory } from "./Session";
import type { Mailbox } from "./Mailbox";

export interface SessionRegistryConfig {
  readonly policy: SessionPolicy;
  readonly getUserKey: (
    m: S.TypeOf<typeof IncomingMessageSchema>
  ) => S.TypeOf<typeof UserKeySchema>;
}

export interface SessionRegistry {
  readonly route: (
    m: S.TypeOf<typeof IncomingMessageSchema>
  ) => Effect.Effect<void, never>;
}

export const makeSessionRegistryLayer = <R, E>(
  config: SessionRegistryConfig,
  makeAgent: AgentFactory<R, E>
) => Layer.effect(
  SessionRegistryTag,
  Effect.gen(function* () {
    const runtime = yield* Effect.runtime<R>();
    const index = yield* SessionIndexTag; // DI: session index
    const mailboxFactory = yield* MailboxFactoryTag; // DI: mailbox provider

    const keyOf = (k: UserKey) => `${k.platform}:${k.id}`;

    const ensureSession = (
      key: S.TypeOf<typeof UserKeySchema>
    ) =>
      Effect.gen(function* () {
        const k = keyOf(key);
        const existing = yield* index.get(k);
        if (existing) return existing;

        const mailbox = yield* mailboxFactory.create(
          key,
          config.policy.mailbox
        );

        const send = (m: OutgoingMessage) =>
          Effect.flatMap(ChatClientTag, (client) => client.send(m));

        const ctx: UserContext = { key, send };
        const handle = makeAgent(ctx);

        const loop = Effect.scoped(
          Effect.forever(
            Effect.race(
              Queue.take(mailbox).pipe(Effect.flatMap(handle)),
              Effect.sleep(config.policy.idleTtl).pipe(
                Effect.andThen(Effect.fail("idle-timeout" as const))
              )
            )
          )
        );

        const fiber = Runtime.runFork(runtime, loop).pipe(
          Effect.catchAll(() => Effect.unit)
        );

        const session: Session = { key, mailbox, fiber };
        yield* index.set(k, session);
        return session;
      });

    const route = (m: S.TypeOf<typeof IncomingMessageSchema>) =>
      Effect.gen(function* () {
        const key = config.getUserKey(m);
        const s = yield* ensureSession(key);
        yield* s.mailbox.offer(m);
      }).pipe(
        // if a session times out, remove from map
        Effect.catchAll(() => Effect.unit)
      );

    return { route } satisfies SessionRegistry;
  })
);

// src/runtime/Router.ts (unchanged, but schemas used at boundaries)
import { Effect, Stream } from "effect";
import { ChatClientTag } from "../clients/ChatClient";

export const makeRouter = (
  registry: SessionRegistry
) => Effect.gen(function* () {
  const client = yield* ChatClientTag;
  yield* Stream.runForEach(client.incoming, registry.route);
});
```

Notes
- The registry is intentionally transport‑agnostic; it uses only `IncomingMessage` and a `getUserKey` function.
- The session loop enforces per‑user sequential processing via `Queue.take` and processes messages in order. Idle TTL is implemented by a timed race.
- To avoid dropped timeouts between messages, you can reset sleep with a small helper or implement `takeOrTimeout(ttl)` using `Effect.race` each iteration (shown above).
- Replace the in‑memory map with Redis/SQLite variants by swapping the `MailboxFactoryTag` and `SessionIndexTag` Layers; no agent or app code changes required.

## Multi‑Channel Interchangeability

- Transports implement `ChatClient` (already present). Add new clients such as Twilio SMS/WhatsApp, iMessage (Business Chat or future provider), Slack, etc.
- The Router uses `getUserKey` to normalize identity per transport. For example:

```ts
const getUserKeyFromTelegram = (m: IncomingMessage): UserKey => ({
  platform: "telegram",
  id: m.senderId
});

const getUserKeyFromSms = (m: IncomingMessage): UserKey => ({
  platform: "sms",
  id: (m.metadata?.fromNumber as string) // validated via Schema
});
```

- Because `SessionRegistry` only needs `getUserKey`, any new transport is drop‑in: provide a `ChatClient` and choose the right `getUserKey`.

## Agent Integration (Effect + Ax)

- Define agent logic as an `AgentFactory` returning an Effect handler. For Ax usage, favor declarative signatures and wrap them in Effect for safety and streaming.

```ts
import { Effect } from "effect";
import type { AgentFactory } from "./runtime/Session";
import { Ax } from "@ax-llm/ax"; // example, keep configs injected

export const makeSimpleAgent: AgentFactory<never, never> = (ctx) => (m) =>
  Effect.gen(function* () {
    // Example: echo with platform awareness
    yield* ctx.send({ chatId: m.chatId, text: `You said: ${m.text}` });
  });
```

- For streaming LLM outputs, wrap Ax streams with `Stream` and send incrementally with backpressure. Validate all external IO with Effect Schema at the edges.

## Putting It Together (DX)

Minimal program wiring with Telegram (others analogous):

```ts
import { Effect, Layer, Duration } from "effect";
import { makeChatApp, ChatHandlerTag } from "effect-ax"; // existing exports
import { makeTelegramClientLayer } from "effect-ax";
import { makeSessionRegistryLayer } from "./runtime/SessionRegistry";

const app = makeChatApp();

const layer = Layer.mergeAll(
  makeTelegramClientLayer({ botToken: process.env.TELEGRAM_TOKEN! }),
  // DI: choose memory implementation by Layer
  makeInMemoryMailboxFactoryLayer,
  makeInMemorySessionIndexLayer,
  makeSessionRegistryLayer(
    {
      policy: {
        idleTtl: Duration.minutes(10),
        mailbox: { capacity: 1024, strategy: "bounded" }
      },
      getUserKey: (m) => ({ platform: "telegram", id: m.senderId })
    },
    makeSimpleAgent
  )
);

const program = app.start.pipe(
  // Plug the registry’s router in as the Chat handler
  Effect.provideService(
    ChatHandlerTag,
    (message) => SessionRegistryTag.pipe(Effect.flatMap((r) => r.route(message)))
  ),
  Effect.provide(layer)
);

Effect.runFork(program);
```

- Add another transport (e.g., Twilio SMS/WhatsApp): simply merge an additional `Layer` and adjust `getUserKey` if the same process serves multiple transports. Alternatively, run one process per transport for isolation.

## Safety and Config

- Config via layers/env only; never hard‑code secrets. For example, `TELEGRAM_TOKEN`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`.
- Add assertion guards around external calls (send/receive). Convert unknowns to typed errors via `makeChatClientError`.
- Use Effect Schema to validate inbound webhook payloads before constructing `IncomingMessage`.
- Wrap streaming in `Stream` and respect backpressure to avoid memory pressure or API rate limit spikes.

## Testing Discipline

- Property tests: per‑user sequencing is preserved; cross‑user concurrency is allowed. Example: send A1,A2 for user A and B1,B2 for user B; assert A1<A2 is preserved, while B’s messages interleave freely with A’s.
- Replay tests: capture transcripts per session; verify agents are idempotent for replays.
- Use `bun test` with `bun:test` runner.

## Production Considerations

- Backpressure: choose bounded queues for sessions under load; decide on `sliding` vs `dropping` per product needs.
- Idle reaping: pick a TTL that won’t interrupt normal conversations; consider heartbeats for long‑running tasks.
- Horizontal scale: prefer Redis‑backed mailboxes for multi‑instance. Keep the Session API identical.
- Observability: tag logs with `userKey` and `platform`; expose metrics for active sessions, queue depths, errors.
- Persistence: store transcripts and agent state snapshots (if any) in `bun:sqlite` or an external DB; keep the session memory footprint small.

## Developer Experience Summary

- One unified handler interface; per‑user sessions managed for you.
- Add/replace transports without touching agent logic.
- Configure sessions with a small `SessionPolicy` object; reasonable defaults.
- Effects + Schemas all the way down: no `any`, no casts, schemas at boundaries, and safe IO.
- Stream‑first design: incremental outputs supported where desired.
- Simple local dev (in‑memory), clear path to durability/scale (SQLite/Redis).

## Open Questions

- Do we need cross‑session coordination (e.g., group chats) and how does that affect the routing key? Consider `ConversationKey` in addition to `UserKey` for group contexts.
- Should we prefer `Stream.groupByKey` for session fan‑out instead of explicit mailboxes? It’s elegant for pure routing but less convenient for idle TTL; the explicit mailbox approach keeps lifecycle explicit and configurable.
- Default persistence: is lightweight SQLite persistence desired for day 1, or do we keep the default purely in‑memory and add persistence as a layer later?

## Next Steps

- Implement `src/runtime/UserKey.ts`, `src/runtime/Session.ts`, `src/runtime/SessionRegistry.ts`, `src/runtime/Router.ts` as above.
- Add Twilio SMS/WhatsApp client(s) mirroring `TelegramClient`.
- Integrate optional persistence layers and a Redis variant behind the same `SessionRegistry` interface.
- Add tests for message ordering, idle TTL reaping, and multi‑transport routing.
- Run `bun typecheck` and `bun test` before handoff.
