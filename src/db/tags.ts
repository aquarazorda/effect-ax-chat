import { Context, Effect } from "effect";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
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
  | NodePgDatabase<typeof dbSchema>;

export class BuilderDbTag extends Context.Tag("effect-ax/BuilderDb")<
  BuilderDbTag,
  BuilderDatabase
>() {}

/** Minimal DB shape for org connections to avoid driver-specific result typing */
export interface OrgDatabase {
  readonly execute: (query: unknown) => PromiseLike<unknown>;
}

/** Per‑organization database resolver */
export interface OrgDbResolver {
  readonly get: (
    organizationId: string,
  ) => Effect.Effect<
    OrgDatabase,
    DbError
  >;
}

export class OrgDbResolverTag extends Context.Tag("effect-ax/OrgDbResolver")<
  OrgDbResolverTag,
  OrgDbResolver
>() {}
