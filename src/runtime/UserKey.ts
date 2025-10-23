import * as S from "effect/Schema";

// Schema-first definition of a cross-channel user identity
export const UserKeySchema = S.Struct({
  platform: S.Union(
    S.Literal("sms"),
    S.Literal("imessage"),
    S.Literal("whatsapp"),
    S.Literal("telegram"),
    // Fallback for future/unknown platforms
    S.String,
  ),
  id: S.String.pipe(S.minLength(1)),
});

export type UserKey = typeof UserKeySchema.Type;

