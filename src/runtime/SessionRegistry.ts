import { Context, Effect, Layer, Runtime } from "effect";
import * as S from "effect/Schema";
import { ChatClientTag } from "../clients/ChatClient";
import {
  IncomingMessageSchema,
  OutgoingMessageSchema,
} from "../clients/MessageSchemas";
import { UserKeySchema } from "./UserKey";
import type {
  AgentFactory,
  Session,
  SessionPolicy,
  UserContext,
} from "./Session";
import { MailboxFactoryTag } from "./Mailbox";
import { SessionIndexTag } from "./SessionIndex";

export interface SessionRegistryConfig {
  readonly policy: SessionPolicy;
  readonly getUserKey: (
    m: typeof IncomingMessageSchema.Type,
  ) => typeof UserKeySchema.Type;
}

export interface SessionRegistry {
  readonly route: (m: typeof IncomingMessageSchema.Type) => Effect.Effect<void>;
}

export class SessionRegistryTag extends Context.Tag(
  "effect-ax/SessionRegistry",
)<SessionRegistryTag, SessionRegistry>() {}

const keyOf = (k: typeof UserKeySchema.Type): string => `${k.platform}:${k.id}`;

export const makeSessionRegistryLayer = <R, E>(
  config: SessionRegistryConfig,
  makeAgent: AgentFactory<R, E>,
  agentLayer: Layer.Layer<R>,
): Layer.Layer<
  SessionRegistryTag,
  never,
  ChatClientTag | MailboxFactoryTag | SessionIndexTag
> =>
  Layer.effect(
    SessionRegistryTag,
    Effect.gen(function* () {
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
            client.send(m).pipe(
              Effect.annotateLogs({
                component: "Session",
                sessionKey: keyOf(key),
                platform: key.platform,
                userId: key.id,
              }),
              Effect.tapError((e) => Effect.logError("send error", e)),
              Effect.catchAll(() => Effect.succeed<void>(undefined)),
              Effect.asVoid,
            );

          const ctx: UserContext = { key, send };
          const handle = makeAgent(ctx);

          const loop = Effect.forever(
            mailbox.take.pipe(
              Effect.annotateLogs({
                component: "Session",
                sessionKey: keyOf(key),
                platform: key.platform,
                userId: key.id,
              }),
              Effect.tap((m) => Effect.logInfo("handle", m.text)),
              Effect.withLogSpan("session.handle"),
              Effect.flatMap((m) =>
                handle(m)
                  .pipe(Effect.provide(agentLayer))
                  .pipe(
                    Effect.catchAll((e) =>
                      Effect.logError("handler error", e).pipe(Effect.asVoid),
                    ),
                  ),
              ),
            ),
          );

          // Spawn daemon fiber within current environment
          yield* Effect.forkDaemon(loop);
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
        }).pipe(
          Effect.annotateLogs({
            component: "SessionRegistry",
            chatId: m.chatId,
            senderId: m.senderId,
            text: m.text,
          }),
          Effect.tap(() => Effect.logInfo("route")),
          Effect.withLogSpan("session.route"),
          Effect.catchAll(() => Effect.succeed(undefined)),
        );

      return { route } satisfies SessionRegistry;
    }),
  );
