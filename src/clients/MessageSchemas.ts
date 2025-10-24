import * as S from "effect/Schema";

export const IncomingMessageSchema = S.Struct({
  chatId: S.String,
  senderId: S.String,
  text: S.String,
  receivedAt: S.Date,
  metadata: S.optional(S.Record({ key: S.String, value: S.Unknown })),
});
export type IncomingMessage = typeof IncomingMessageSchema.Type;

export const OutgoingMessageSchema = S.Struct({
  chatId: S.String,
  text: S.String,
  replyToMessageId: S.optional(S.String),
  metadata: S.optional(S.Record({ key: S.String, value: S.Unknown })),
});
export type OutgoingMessage = typeof OutgoingMessageSchema.Type;
