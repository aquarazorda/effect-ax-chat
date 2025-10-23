import { Context, Effect, Layer, Runtime } from "effect";
import * as S from "effect/Schema";
import { ChatClientTag } from "../clients/ChatClient";
import {
  IncomingMessageSchema,
  OutgoingMessageSchema,
} from "../clients/MessageSchemas";
import { UserKeySchema } from "./UserKey";
import type { AgentFactory, Session, SessionPolicy, UserContext } from "./Session";
import { MailboxFactoryTag } from "./Mailbox";
import { SessionIndexTag } from "./SessionIndex";

export interface SessionRegistryConfig {
  readonly policy: SessionPolicy;
  readonly getUserKey: (m: typeof IncomingMessageSchema.Type) => typeof UserKeySchema.Type;
}

export interface SessionRegistry {
  readonly route: (m: typeof IncomingMessageSchema.Type) => Effect.Effect<void>;
}

export class SessionRegistryTag extends Context.Tag("effect-ax/SessionRegistry")<
  SessionRegistryTag,
  SessionRegistry
>() {}

const keyOf = (k: typeof UserKeySchema.Type): string => `${k.platform}:${k.id}`;

export const makeSessionRegistryLayer = <R, E>(
  config: SessionRegistryConfig,
  makeAgent: AgentFactory<R, E>,
): Layer.Layer<
  SessionRegistryTag,
  never,
  ChatClientTag | MailboxFactoryTag | SessionIndexTag | R
> =>
  Layer.effect(
    SessionRegistryTag,
    Effect.gen(function* () {
      const runtime = yield* Effect.runtime<R>();
      const client = yield* ChatClientTag;
      const index = yield* SessionIndexTag;
      const mailboxFactory = yield* MailboxFactoryTag;

      const ensureSession = (key: typeof UserKeySchema.Type) =>
        Effect.gen(function* () {
          const k = keyOf(key);
          const existing = yield* index.get(k);
          if (existing !== undefined) {
            return existing;
          }

          const mailbox = yield* mailboxFactory.create(
            key,
            config.policy.mailbox,
          );

          const send = (m: typeof OutgoingMessageSchema.Type) =>
            client
              .send(m)
              .pipe(
                Effect.asVoid,
                Effect.catchAll(() => Effect.succeed(true)),
                Effect.asVoid,
              );

          const ctx: UserContext = { key, send };
          const handle = makeAgent(ctx);

          const loop = Effect.scoped(
            Effect.forever(
              Effect.race(
                mailbox.take.pipe(Effect.flatMap(handle)),
                Effect.sleep(config.policy.idleTtlMillis).pipe(
                  Effect.andThen(Effect.fail("idle-timeout" as const)),
                ),
              ),
            ),
          );

          // Spawn and ignore fiber handle (not required for routing API)
          Runtime.runFork(runtime, loop);
          const session: Session = { key, mailbox };

          // Store lightweight session reference (we hold mailbox via closure)
          yield* index.set(k, session);
          return session;
        });

      const route = (m: typeof IncomingMessageSchema.Type) =>
        Effect.gen(function* () {
          const key = config.getUserKey(m);
          const s = yield* ensureSession(key);
          yield* s.mailbox.offer(m);
        }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

      return { route } satisfies SessionRegistry;
    }),
  );
