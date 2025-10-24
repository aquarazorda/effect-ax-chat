import { Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { DbConfigTag } from "./db/config";

// Define the required/optional environment variables for this project.
export const AppEnvSchema = S.Struct({
  // Required: builder database URL (Neon or Postgres HTTP connection string)
  DATABASE_URL: S.String,

  // Optional: local Postgres URL (for Bun.sql driver)
  LOCAL_DATABASE_URL: S.optional(S.String),

  // Optional: telegram token for chat transport
  TELEGRAM_TOKEN: S.String,

  // Demo helpers for Max agent
  DEMO_ORG_ID: S.String,
  DEMO_VERSION_TYPE: S.Union(S.Literal("dev"), S.Literal("prod")),
  DEMO_TRUST_MODE: S.optional(S.String), // "true"|"false" (parsed at use-site)

  // LLM provider keys (optional; choose one)
  OPENAI_API_KEY: S.String,

  // Demo configuration for People lookups
  DEMO_PEOPLE_ENTITY_TYPE_ID: S.optional(S.String),
  DEMO_PHONE_COLUMN_ID: S.optional(S.String),

  // Optional: used for decrypting per‑org connection strings
  DATABASE_ENCRYPTION_KEY_B64: S.optional(S.String),
  DATABASE_ENCRYPTION_IV_LENGTH: S.optional(S.String),

  // Choose DB driver for Builder DB connection: "neon" (default) or Node Postgres ("pg" | "node" | "node-pg")
  DB_DRIVER: S.optional(
    S.Union(
      S.Literal("neon"),
      S.Literal("pg"),
      S.Literal("node"),
      S.Literal("node-pg"),
    ),
  ),

  // Deprecated: pglite options (unused when DB_DRIVER != 'pglite')
  PGLITE_DATA_DIR: S.optional(S.String),
  PGLITE_RESTORE_PATH: S.optional(S.String),
});
export type AppEnv = typeof AppEnvSchema.Type;

export class AppEnvTag extends Context.Tag("effect-ax/AppEnv")<
  AppEnvTag,
  AppEnv
>() {}

// Parse Bun.env with Effect Schema; fails if required vars are missing.
const parseEnv = S.decodeUnknown(AppEnvSchema);

const normalizeVersionType = (v: string | undefined): string | undefined => {
  if (v === "published") return "prod";
  if (v === "draft") return "dev";
  return v;
};

export const makeEnvLayer: Layer.Layer<AppEnvTag> = Layer.effect(
  AppEnvTag,
  parseEnv({
    DATABASE_URL: Bun.env.DATABASE_URL,
    LOCAL_DATABASE_URL: Bun.env.LOCAL_DATABASE_URL,
    TELEGRAM_TOKEN: Bun.env.TELEGRAM_TOKEN,
    DEMO_ORG_ID: Bun.env.DEMO_ORG_ID,
    DEMO_VERSION_TYPE: normalizeVersionType(Bun.env.DEMO_VERSION_TYPE),
    DEMO_TRUST_MODE: Bun.env.DEMO_TRUST_MODE,
    OPENAI_API_KEY: Bun.env.OPENAI_API_KEY,
    DEMO_PEOPLE_ENTITY_TYPE_ID: Bun.env.DEMO_PEOPLE_ENTITY_TYPE_ID,
    DEMO_PHONE_COLUMN_ID: Bun.env.DEMO_PHONE_COLUMN_ID,
    DATABASE_ENCRYPTION_KEY_B64: Bun.env.DATABASE_ENCRYPTION_KEY_B64,
    DATABASE_ENCRYPTION_IV_LENGTH: Bun.env.DATABASE_ENCRYPTION_IV_LENGTH,
    DB_DRIVER: Bun.env.DB_DRIVER,
    PGLITE_DATA_DIR: Bun.env.PGLITE_DATA_DIR,
    PGLITE_RESTORE_PATH: Bun.env.PGLITE_RESTORE_PATH,
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
