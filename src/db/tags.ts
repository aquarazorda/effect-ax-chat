import { Context, Effect } from "effect";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { dbSchema } from "./schema";

export interface DbError {
  readonly _tag: "DbError";
  readonly message: string;
  readonly cause?: unknown;
}

export const makeDbError = (message: string, cause?: unknown): DbError => ({
  _tag: "DbError",
  message,
  cause,
});

/** Builder (platform) database handle */
export type BuilderDatabase =
  | NeonHttpDatabase<typeof dbSchema>
  | PgliteDatabase<typeof dbSchema>
  | BunSQLDatabase<typeof dbSchema>;

export class BuilderDbTag extends Context.Tag("effect-ax/BuilderDb")<
  BuilderDbTag,
  BuilderDatabase
>() {}

/** Per‑organization database resolver */
export interface OrgDbResolver {
  readonly get: (
    organizationId: string,
  ) => Effect.Effect<
    NeonHttpDatabase<typeof dbSchema> | BunSQLDatabase<typeof dbSchema>,
    DbError
  >;
}

export class OrgDbResolverTag extends Context.Tag("effect-ax/OrgDbResolver")<
  OrgDbResolverTag,
  OrgDbResolver
>() {}
