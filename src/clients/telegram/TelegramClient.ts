import { Effect, Layer, Queue, Runtime, Stream } from "effect";
import { Telegraf, type Context } from "telegraf";
import { message } from "telegraf/filters";
import type { Update } from "telegraf/types";
import {
  type ChatClient,
  ChatClientTag,
  makeChatClientError,
  type IncomingMessage,
  type OutgoingMessage,
} from "../ChatClient";

export interface TelegramClientConfig {
  readonly botToken: string;
  readonly launchOptions?: Telegraf.LaunchOptions;
  readonly debugEcho?: boolean;
}

const parseIncomingMessage = (
  ctx: Context<Update>,
): IncomingMessage | undefined => {
  const message = ctx.message;
  if (
    message === undefined ||
    !("text" in message) ||
    message.text === undefined
  ) {
    return undefined;
  }

  const chatId = message.chat.id.toString();
  const senderId =
    message.from?.id !== undefined ? message.from.id.toString() : chatId;

  return {
    chatId,
    senderId,
    text: message.text,
    receivedAt: new Date(message.date * 1000),
    metadata: {
      messageId: message.message_id,
    },
  };
};

export const makeTelegramClientLayer = (
  config: TelegramClientConfig,
): Layer.Layer<ChatClientTag> =>
  Layer.effect(
    ChatClientTag,
    Effect.gen(function* () {
      const queue = yield* Queue.unbounded<IncomingMessage>();
      const runtime = yield* Effect.runtime<never>();
      const bot = new Telegraf(config.botToken);
      let launched = false;

      type SendMessageExtra = Parameters<typeof bot.telegram.sendMessage>[2];

      const buildReplyOptions = (
        replyTo: string | undefined,
      ): SendMessageExtra => {
        if (replyTo === undefined) {
          return undefined;
        }
        const numericId = Number(replyTo);
        if (!Number.isInteger(numericId)) {
          return undefined;
        }
        return {
          reply_parameters: {
            message_id: numericId,
          },
        } satisfies SendMessageExtra;
      };

      bot.catch((err) => {
        Runtime.runFork(
          runtime,
          Effect.logError("error", err).pipe(
            Effect.annotateLogs({ component: "Telegram" }),
          ),
        );
      });

      bot.on(message("text"), (ctx) => {
        const incoming = parseIncomingMessage(ctx);
        if (incoming === undefined) {
          return;
        }
        // Log and enqueue synchronously to avoid depending on a runtime here
        Runtime.runFork(
          runtime,
          Effect.logInfo("incoming", incoming.text).pipe(
            Effect.annotateLogs({
              component: "Telegram",
              chatId: incoming.chatId,
              senderId: incoming.senderId,
            }),
          ),
        );
        queue.unsafeOffer(incoming);
        Runtime.runFork(
          runtime,
          Effect.logInfo("enqueued").pipe(
            Effect.annotateLogs({
              component: "Telegram",
              chatId: incoming.chatId,
              senderId: incoming.senderId,
            }),
          ),
        );

        if (config.debugEcho === true) {
          Runtime.runFork(
            runtime,
            Effect.tryPromise({
              try: async () => {
                await bot.telegram.sendMessage(
                  incoming.chatId,
                  `You said: ${incoming.text}`,
                );
              },
              catch: (error) =>
                makeChatClientError(
                  "Failed to send Telegram debug echo",
                  error,
                ),
            }).pipe(
              Effect.annotateLogs({
                component: "Telegram",
                chatId: incoming.chatId,
                senderId: incoming.senderId,
              }),
              Effect.tap(() => Effect.logInfo("debug echo sent")),
              Effect.withLogSpan("telegram.debugEcho"),
            ),
          );
        }
      });

      const connect = Effect.tryPromise({
        try: async () => {
          if (launched) {
            return;
          }
          if (config.launchOptions !== undefined) {
            await bot.launch(config.launchOptions);
          } else {
            await bot.launch();
          }
          launched = true;
        },
        catch: (error) =>
          makeChatClientError("Failed to connect to Telegram", error),
      }).pipe(Effect.tap(() => Effect.logInfo("telegram connected")));

      const disconnect = Effect.sync(() => {
        if (!launched) {
          return;
        }
        bot.stop("disconnect");
        launched = false;
      }).pipe(Effect.tap(() => Effect.logInfo("telegram disconnected")));

      const incoming = Stream.fromQueue(queue);

      const send = (message: OutgoingMessage) =>
        Effect.tryPromise({
          try: async () => {
            const res = await bot.telegram.sendMessage(
              message.chatId,
              message.text,
              buildReplyOptions(message.replyToMessageId),
            );
            return res;
          },
          catch: (error) =>
            makeChatClientError("Failed to send Telegram message", error),
        }).pipe(
          Effect.annotateLogs({
            component: "Telegram",
            chatId: message.chatId,
          }),
          Effect.tap(() => Effect.logDebug("send", message.text)),
          Effect.withLogSpan("telegram.send"),
          Effect.asVoid,
        );

      const client: ChatClient = {
        platform: "telegram",
        connect,
        disconnect,
        incoming,
        send,
      };

      return client;
    }),
  );
