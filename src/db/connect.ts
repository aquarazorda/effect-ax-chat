import { Effect, Layer } from "effect";
import { BuilderDbTag, OrgDbResolverTag, makeDbError } from "./tags";
import type { OrgDbResolver, DbError } from "./tags";
import { DbConfigTag } from "./config";
import type { DbConfig } from "./config";
import {
  drizzle as drizzleNeon,
  type NeonHttpDatabase,
} from "drizzle-orm/neon-http";
import {
  drizzle as drizzlePglite,
  type PgliteDatabase,
} from "drizzle-orm/pglite";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { dbSchema } from "./schema";
import { eq } from "drizzle-orm";
import { createDecipheriv } from "crypto";
import { AppEnvTag } from "../env";
import type { AppEnv } from "../env";
import { sql } from "drizzle-orm";
import { DbHealthTag } from "./health";
import type { BuilderDatabase } from "./tags";
import * as S from "effect/Schema";
import { OrganizationIdSchema } from "./ids";

/**
 * Placeholder creator for a Drizzle DB handle.
 * Replace internals with actual drizzle-orm (neon-http/pglite) when wiring drivers.
 */
const makeNeonDb = (cfg: DbConfig): NeonHttpDatabase<typeof dbSchema> => {
  const sql = neon(cfg.databaseUrl);
  return drizzleNeon(sql, { schema: dbSchema });
};

const makePgliteDb = (): PgliteDatabase<typeof dbSchema> => {
  const client = new PGlite();
  return drizzlePglite(client, { schema: dbSchema });
};

/**
 * Builder DB (single) layer. Uses DbConfigTag for connection info.
 * Swap internals with neon-http drizzle connection when packages are available.
 */
export const makeBuilderDbLayer: Layer.Layer<
  BuilderDbTag,
  never,
  DbConfigTag | AppEnvTag
> = Layer.effect(
  BuilderDbTag,
  Effect.gen(function* () {
    const cfg: DbConfig = yield* DbConfigTag;
    const env: AppEnv = yield* AppEnvTag;
    const driver = env.DB_DRIVER ?? "neon";
    const db: BuilderDatabase =
      driver === "pglite" ? makePgliteDb() : makeNeonDb(cfg);
    return db;
  }),
);

/**
 * Org DB resolver. Implementation strategy:
 * - Look up org connection material in the builder DB (outside this module)
 * - Decrypt to DSN if needed
 * - Create drizzle client using neon-http (or pglite for local)
 * - Memoize per org with TTL
 */
export const makeOrgDbResolverLayer: Layer.Layer<
  OrgDbResolverTag,
  never,
  BuilderDbTag | AppEnvTag
> = Layer.effect(
  OrgDbResolverTag,
  Effect.gen(function* () {
    const builderDb = yield* BuilderDbTag;
    const env: AppEnv = yield* AppEnvTag;

    const cache = new Map<string, NeonHttpDatabase<typeof dbSchema>>();

    const decrypt = (encryptedText: string): string => {
      const keyB64 = env.DATABASE_ENCRYPTION_KEY_B64;
      const ivLenStr = env.DATABASE_ENCRYPTION_IV_LENGTH;
      if (!keyB64 || !ivLenStr) {
        throw new Error(
          "Missing DATABASE_ENCRYPTION_KEY_B64 or DATABASE_ENCRYPTION_IV_LENGTH env for decryption",
        );
      }
      const ivLength = parseInt(ivLenStr, 10);
      const encryptionKey = Buffer.from(keyB64, "base64");
      const data = Buffer.from(encryptedText, "base64");
      const iv = data.subarray(0, ivLength);
      const authTag = data.subarray(ivLength, ivLength + 16);
      const encrypted = data.subarray(ivLength + 16);
      const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
      decipher.setAuthTag(authTag);
      return (
        decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8")
      );
    };

    const get: OrgDbResolver["get"] = (organizationId) =>
      Effect.tryPromise({
        try: async () => {
          if (cache.has(organizationId)) {
            const cached = cache.get(organizationId);
            if (cached !== undefined) return cached;
          }
          const orgIdBranded =
            S.decodeUnknownSync(OrganizationIdSchema)(organizationId);

          const rows = await builderDb
            .select()
            .from(dbSchema.organization)
            .where(eq(dbSchema.organization.id, orgIdBranded))
            .limit(1);
          const org = rows[0];
          if (!org) {
            throw new Error(`Organization ${organizationId} not found`);
          }

          const encrypted = org.store_connection_string_encrypted;
          if (!encrypted) {
            throw new Error(
              "Missing encrypted connection string; ensure org DB was provisioned and stored",
            );
          }

          const url = decrypt(encrypted);
          const sql = neon(url);
          const orgDb = drizzleNeon(sql, { schema: dbSchema });
          cache.set(organizationId, orgDb);
          return orgDb;
        },
        catch: (cause) => makeDbError("Failed to resolve org DB", cause),
      });

    return { get } satisfies OrgDbResolver;
  }),
);

/**
 * Optional helper for withTransaction to be implemented when drivers are wired.
 */
export const withTransaction = <E, A>(
  use: (tx: BuilderDatabase) => Effect.Effect<A, E, never>,
): Effect.Effect<A, E | DbError, BuilderDbTag> =>
  Effect.gen(function* () {
    const db = yield* BuilderDbTag;
    const result = yield* Effect.tryPromise({
      try: async () =>
        await (db as any).transaction(async (tx: BuilderDatabase) =>
          Effect.runPromise(use(tx)),
        ),
      catch: (cause) => makeDbError("DB transaction failed", cause),
    });
    return result as A;
  });

// Health layer
export const makeDbHealthLayer: Layer.Layer<
  DbHealthTag,
  never,
  BuilderDbTag | OrgDbResolverTag
> = Layer.effect(
  DbHealthTag,
  Effect.gen(function* () {
    const builder = yield* BuilderDbTag;
    const resolver = yield* OrgDbResolverTag;

    const checkBuilder = Effect.tryPromise({
      try: async () => {
        await (builder as any).execute(sql`select 1`);
      },
      catch: (cause) => makeDbError("Builder DB health check failed", cause),
    });

    const checkOrg: (id: string) => Effect.Effect<void, DbError> = (id) =>
      Effect.flatMap(resolver.get(id), (orgDb) =>
        Effect.tryPromise({
          try: async () => {
            await (orgDb as any).execute(sql`select 1`);
          },
          catch: (cause) => makeDbError("Org DB health check failed", cause),
        }),
      );

    return { checkBuilder, checkOrg };
  }),
);
