import { Context, Effect, Layer } from "effect";
import type { OrganizationId, UserEntityId, UserId } from "../db/ids";
import type { VersionType } from "../domain/version";
import {
  BuilderDbTag,
  type BuilderDatabase,
  makeDbError,
  type DbError,
} from "../db/tags";
import { dbSchema } from "../db/schema";
import { and, eq } from "drizzle-orm";

export interface UserEntityResolver {
  readonly get: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly userId: UserId;
  }) => Effect.Effect<UserEntityId | undefined, DbError, BuilderDbTag>;
}

export class UserEntityResolverTag extends Context.Tag(
  "effect-ax/UserEntityResolver",
)<UserEntityResolverTag, UserEntityResolver>() {}

export const makeUserEntityResolver = (): UserEntityResolver => {
  const get: UserEntityResolver["get"] = ({
    organizationId,
    versionType,
    userId,
  }) =>
    Effect.gen(function* () {
      const db: BuilderDatabase = yield* BuilderDbTag;
      const rows = yield* Effect.promise(() =>
        db
          .select({ entity_id: dbSchema.organization_user_entity_id.entity_id })
          .from(dbSchema.organization_user_entity_id)
          .where(
            and(
              eq(
                dbSchema.organization_user_entity_id.organization_id,
                organizationId,
              ),
              eq(dbSchema.organization_user_entity_id.user_id, userId),
              eq(
                dbSchema.organization_user_entity_id.version_type,
                versionType,
              ),
            ),
          )
          .limit(1),
      );
      return rows[0]?.entity_id;
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(makeDbError("Failed to resolve user entity id", e)),
      ),
    );

  return { get };
};

export const makeUserEntityResolverLayer: Layer.Layer<UserEntityResolverTag> =
  Layer.effect(UserEntityResolverTag, Effect.succeed(makeUserEntityResolver()));
