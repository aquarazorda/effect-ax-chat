import { Context, Effect, Stream } from "effect";

export interface IncomingMessage {
  readonly chatId: string;
  readonly senderId: string;
  readonly text: string;
  readonly receivedAt: Date;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface OutgoingMessage {
  readonly chatId: string;
  readonly text: string;
  readonly replyToMessageId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ChatClientError {
  readonly _tag: "ChatClientError";
  readonly message: string;
  readonly cause?: unknown;
}

export const makeChatClientError = (
  message: string,
  cause?: unknown,
): ChatClientError => ({
  _tag: "ChatClientError",
  message,
  cause,
});

export interface ChatClient {
  readonly platform: string;
  readonly connect: Effect.Effect<void, ChatClientError>;
  readonly disconnect: Effect.Effect<void, never>;
  readonly incoming: Stream.Stream<IncomingMessage, ChatClientError>;
  readonly send: (
    message: OutgoingMessage,
  ) => Effect.Effect<void, ChatClientError>;
}

export class ChatClientTag extends Context.Tag("effect-ax/ChatClient")<
  ChatClientTag,
  ChatClient
>() {}
