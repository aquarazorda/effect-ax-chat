import { Context, Effect, Layer } from "effect";
import { ChatHandlerTag, type ChatMessageHandler } from "../app/ChatApp";
import { SessionRegistryTag } from "./SessionRegistry";
import type { IncomingMessage } from "../clients/ChatClient";

/**
 * Convenience layer: provides ChatHandlerTag using the SessionRegistry.
 * One-liner wiring to route all incoming messages through the registry.
 */
export const makeChatHandlerFromRegistryLayer: Layer.Layer<
  ChatHandlerTag,
  never,
  SessionRegistryTag
> = Layer.effect(
  ChatHandlerTag,
  Effect.gen(function* () {
    const registry = yield* SessionRegistryTag;
    const handler: ChatMessageHandler<never, never> = (
      message: IncomingMessage,
    ) =>
      registry
        .route({
          chatId: message.chatId,
          senderId: message.senderId,
          text: message.text,
          receivedAt: message.receivedAt,
          metadata: message.metadata,
        })
        .pipe(
          Effect.annotateLogs({
            component: "ChatHandler",
            chatId: message.chatId,
            senderId: message.senderId,
          }),
          Effect.tap(() => Effect.logInfo("routed")),
          Effect.withLogSpan("handler.route"),
          Effect.asVoid,
        );
    return handler;
  }),
);
