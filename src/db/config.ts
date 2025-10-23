import * as S from "effect/Schema";
import { Context } from "effect";

/**
 * Builder DB + Drizzle config injected via Layers.
 * Do not hardcode secrets; Bun auto-loads .env for runtime.
 */
export const DbConfigSchema = S.Struct({
  databaseUrl: S.String, // e.g., Neon Postgres connection string (serverless HTTP or DSN wrapper)
  drizzleMigrationsDir: S.optional(S.String),
});
export type DbConfig = typeof DbConfigSchema.Type;

/**
 * Organization DB connection material (encrypted or resolvable data)
 * that OrgDbResolver can use to build a connection.
 */
export const OrgConnectionSecretSchema = S.Struct({
  organizationId: S.String,
  connectionStringEncrypted: S.optional(S.String),
  neonBranchName: S.optional(S.String),
});
export type OrgConnectionSecret = typeof OrgConnectionSecretSchema.Type;

export const DecryptionConfigSchema = S.Struct({
  keyB64: S.String, // DATABASE_ENCRYPTION_KEY_B64
  ivLength: S.optional(S.Number), // default 12
});
export type DecryptionConfig = typeof DecryptionConfigSchema.Type;

export class DbConfigTag extends Context.Tag("effect-ax/DbConfig")<
  DbConfigTag,
  DbConfig
>() {}
