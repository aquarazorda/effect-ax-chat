import { Context, Effect } from "effect";

/**
 * Opaque handle for a Drizzle database connection. The concrete driver
 * (neon-http, pglite, etc.) is provided via Layers. We intentionally avoid
 * importing Drizzle types here to keep this package lean and typesafe without
 * optional deps installed yet.
 */
export interface DrizzleDbHandle {
  readonly _tag: "DrizzleDbHandle";
}

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
  DrizzleDbHandle
>() {}

/** Per‑organization database resolver */
export interface OrgDbResolver {
  readonly get: (
    organizationId: string,
  ) => Effect.Effect<DrizzleDbHandle, DbError>;
}

export class OrgDbResolverTag extends Context.Tag("effect-ax/OrgDbResolver")<
  OrgDbResolverTag,
  OrgDbResolver
>() {}

