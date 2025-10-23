import { Effect, Layer } from "effect";
import { BuilderDbTag, OrgDbResolverTag, makeDbError } from "./tags";
import type { DrizzleDbHandle, OrgDbResolver } from "./tags";
import { DbConfigTag } from "./config";
import type { DbConfig } from "./config";

/**
 * Placeholder creator for a Drizzle DB handle.
 * Replace internals with actual drizzle-orm (neon-http/pglite) when wiring drivers.
 */
const makeHandle = (): DrizzleDbHandle => ({ _tag: "DrizzleDbHandle" });

/**
 * Builder DB (single) layer. Uses DbConfigTag for connection info.
 * Swap internals with neon-http drizzle connection when packages are available.
 */
export const makeBuilderDbLayer: Layer.Layer<BuilderDbTag, never, DbConfigTag> = Layer.effect(
  BuilderDbTag,
  Effect.gen(function* () {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _cfg: DbConfig = yield* DbConfigTag;
    // TODO: build a drizzle connection based on _cfg.databaseUrl
    return makeHandle();
  }),
);

/**
 * Org DB resolver. Implementation strategy:
 * - Look up org connection material in the builder DB (outside this module)
 * - Decrypt to DSN if needed
 * - Create drizzle client using neon-http (or pglite for local)
 * - Memoize per org with TTL
 */
export const makeOrgDbResolverLayer: Layer.Layer<OrgDbResolverTag, never, DbConfigTag> = Layer.effect(
  OrgDbResolverTag,
  Effect.sync((): OrgDbResolver => ({
    get: (_organizationId) =>
      // TODO: replace with real resolution against builder DB + decryption + driver creation
      Effect.succeed(makeHandle()).pipe(
        Effect.catchAll((cause) => Effect.fail(makeDbError("Failed to resolve org DB", cause))),
      ),
  })),
);

/**
 * Optional helper for withTransaction to be implemented when drivers are wired.
 */
export const withTransaction = <R, E, A>(
  fa: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> => fa;
