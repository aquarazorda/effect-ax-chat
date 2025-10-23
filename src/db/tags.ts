import { Context, Effect } from "effect";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
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
export class BuilderDbTag extends Context.Tag("effect-ax/BuilderDb")<
  BuilderDbTag,
  NeonHttpDatabase<typeof dbSchema>
>() {}

/** Per‑organization database resolver */
export interface OrgDbResolver {
  readonly get: (
    organizationId: string,
  ) => Effect.Effect<NeonHttpDatabase<typeof dbSchema>, DbError>;
}

export class OrgDbResolverTag extends Context.Tag("effect-ax/OrgDbResolver")<
  OrgDbResolverTag,
  OrgDbResolver
>() {}
