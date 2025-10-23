import { Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { DbConfigTag } from "./db/config";

// Define the required/optional environment variables for this project.
export const AppEnvSchema = S.Struct({
  // Required: builder database URL (Neon or Postgres HTTP connection string)
  DATABASE_URL: S.String,

  // Optional: telegram token for chat transport
  TELEGRAM_TOKEN: S.optional(S.String),

  // Optional: used for decrypting per‑org connection strings
  DATABASE_ENCRYPTION_KEY_B64: S.optional(S.String),
  DATABASE_ENCRYPTION_IV_LENGTH: S.optional(S.String),
});
export type AppEnv = typeof AppEnvSchema.Type;

export class AppEnvTag extends Context.Tag("effect-ax/AppEnv")<
  AppEnvTag,
  AppEnv
>() {}

// Parse Bun.env with Effect Schema; fails if required vars are missing.
const parseEnv = S.decodeUnknown(AppEnvSchema);

export const makeEnvLayer: Layer.Layer<AppEnvTag> = Layer.effect(
  AppEnvTag,
  parseEnv({
    DATABASE_URL: Bun.env.DATABASE_URL,
    TELEGRAM_TOKEN: Bun.env.TELEGRAM_TOKEN,
    DATABASE_ENCRYPTION_KEY_B64: Bun.env.DATABASE_ENCRYPTION_KEY_B64,
    DATABASE_ENCRYPTION_IV_LENGTH: Bun.env.DATABASE_ENCRYPTION_IV_LENGTH,
  }).pipe(Effect.orDie),
);

// Convenience: build DbConfigTag from validated env
export const makeDbConfigFromEnvLayer: Layer.Layer<
  DbConfigTag,
  never,
  AppEnvTag
> = Layer.effect(
  DbConfigTag,
  Effect.gen(function* () {
    const env = yield* AppEnvTag;
    return { databaseUrl: env.DATABASE_URL };
  }),
);
