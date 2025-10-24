import { Context, Effect, Stream } from "effect";
import {
  ChatClientTag,
  type ChatClientError,
  type IncomingMessage,
  type OutgoingMessage,
} from "../clients/ChatClient";

/**
 * Defines the contract for message handlers used by the chat application.
 */
export type ChatMessageHandler<R, E = never> = (
  message: IncomingMessage,
) => Effect.Effect<void, E, R>;

export class ChatHandlerTag extends Context.Tag("effect-ax/ChatHandler")<
  ChatHandlerTag,
  ChatMessageHandler<never, never>
>() {}

export type ChatAppDependencies = ChatClientTag | ChatHandlerTag;

export interface ChatApp {
  readonly start: Effect.Effect<void, ChatClientError, ChatAppDependencies>;
  readonly send: (
    message: OutgoingMessage,
  ) => Effect.Effect<void, ChatClientError, ChatClientTag>;
}

export const makeChatApp = (
  options: {
    readonly handler?: ChatMessageHandler<never, never>;
  } = {},
): ChatApp => {
  const start: Effect.Effect<void, ChatClientError, ChatAppDependencies> =
    Effect.gen(function* () {
      const client = yield* ChatClientTag;
      const handler = options.handler ?? (yield* ChatHandlerTag);

      yield* Effect.acquireUseRelease(
        client.connect.pipe(
          Effect.annotateLogs({ component: "ChatApp" }),
          Effect.tap(() => Effect.logInfo("chat client connect")),
          Effect.withLogSpan("chat.connect"),
        ),
        () =>
          Stream.runForEach(client.incoming, (message) =>
            handler(message).pipe(
              Effect.annotateLogs({
                component: "ChatApp",
                chatId: message.chatId,
                senderId: message.senderId,
              }),
              Effect.tap(() => Effect.logInfo("handle message")),
              Effect.withLogSpan("chat.handle"),
            ),
          ),
        () =>
          client.disconnect.pipe(
            Effect.annotateLogs({ component: "ChatApp" }),
            Effect.tap(() => Effect.logInfo("chat client disconnect")),
            Effect.withLogSpan("chat.disconnect"),
          ),
      );
    });

  const send = (
    message: OutgoingMessage,
  ): Effect.Effect<void, ChatClientError, ChatClientTag> =>
    Effect.flatMap(ChatClientTag, (client) => client.send(message));

  return {
    start,
    send,
  };
};
