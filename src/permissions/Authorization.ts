import * as S from "effect/Schema";
import { Context, Effect, Layer } from "effect";
import { JsonSchema } from "../db/json";
import {
  EntityTypeIdSchema,
  RelationIdSchema,
  type OrganizationId,
  type EntityTypeVersionId,
  type ActionVersionId,
} from "../db/ids";
import {
  BuilderDbTag,
  type BuilderDatabase,
  type DbError,
  makeDbError,
} from "../db/tags";
import { dbSchema } from "../db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

export const RelationDirectionSchema = S.Union(
  S.Literal("aToB"),
  S.Literal("bToA"),
);
export type RelationDirection = typeof RelationDirectionSchema.Type;

export const RelationPathNodeSchema = S.Struct({
  relationId: RelationIdSchema,
  direction: RelationDirectionSchema,
});
export type RelationPathNode = typeof RelationPathNodeSchema.Type;

export const AuthorizingRelationPathSchema = S.Struct({
  startingEntityType: S.optional(
    S.Struct({ id: EntityTypeIdSchema, filters: S.optional(JsonSchema) }),
  ),
  path: S.Array(RelationPathNodeSchema),
  userTypeFilters: S.optional(JsonSchema),
});
export type AuthorizingRelationPath = typeof AuthorizingRelationPathSchema.Type;

export const AuthorizationSchema = S.Struct({
  authorizedByRelationPath: AuthorizingRelationPathSchema,
});
export type Authorization = typeof AuthorizationSchema.Type;

export type AnyoneWithLinkAuthorization = { authorizedForAnyoneWithLink: true };

export type AuthorizationValue = Authorization | AnyoneWithLinkAuthorization;

export interface EntityTypeAuthorizations {
  readonly read: ReadonlyArray<AuthorizationValue>;
  readonly activityLog: ReadonlyArray<AuthorizationValue>;
  readonly perFieldGroupId: Record<string, ReadonlyArray<AuthorizationValue>>;
}

export interface AuthorizationService {
  readonly getByEntityTypeVersionIds: (args: {
    organizationId: OrganizationId;
    entityTypeVersionIds: ReadonlyArray<EntityTypeVersionId>;
  }) => Effect.Effect<
    Record<string, EntityTypeAuthorizations>,
    DbError,
    BuilderDbTag
  >;

  readonly getByActionVersionIds: (args: {
    organizationId: OrganizationId;
    actionVersionIds: ReadonlyArray<ActionVersionId>;
  }) => Effect.Effect<
    Record<string, ReadonlyArray<Authorization>>,
    DbError,
    BuilderDbTag
  >;
}

export class AuthorizationServiceTag extends Context.Tag(
  "effect-ax/AuthorizationService",
)<AuthorizationServiceTag, AuthorizationService>() {}

const decodeAuthorizationValue = (
  row: typeof dbSchema.data_model_authorization.$inferSelect,
): Effect.Effect<AuthorizationValue, DbError> => {
  if (row.authorized_for_anyone_with_link === true) {
    return Effect.succeed({ authorizedForAnyoneWithLink: true });
  }
  const payload = row.authorized_by_relation_path;
  return Effect.try({
    try: () =>
      S.decodeUnknownSync(AuthorizationSchema)({
        authorizedByRelationPath: payload,
      }),
    catch: (cause) => makeDbError("Invalid authorization payload", cause),
  });
};

const groupEntityTypeAuths = (
  rows: ReadonlyArray<typeof dbSchema.data_model_authorization.$inferSelect>,
): Effect.Effect<EntityTypeAuthorizations, DbError> =>
  Effect.forEach(rows, decodeAuthorizationValue, {
    concurrency: "unbounded",
  }).pipe(
    Effect.map((auths) => {
      const read: AuthorizationValue[] = [];
      const activityLog: AuthorizationValue[] = [];
      const perFieldGroupId: Record<string, AuthorizationValue[]> = {};

      rows.forEach((row, idx) => {
        const auth = auths[idx]!;
        if (row.authorize_activity_log === true) {
          activityLog.push(auth);
          return;
        }
        const fg = row.authorize_read_on_entities_per_field_group_id;
        if (fg != null) {
          const list = perFieldGroupId[fg] ?? [];
          list.push(auth);
          perFieldGroupId[fg] = list;
          return;
        }
        read.push(auth);
      });

      return { read, activityLog, perFieldGroupId };
    }),
  );

export const makeAuthorizationService = (): AuthorizationService => {
  const getByEntityTypeVersionIds: AuthorizationService["getByEntityTypeVersionIds"] =
    ({ organizationId, entityTypeVersionIds }) =>
      Effect.gen(function* () {
        const db: BuilderDatabase = yield* BuilderDbTag;
        if (entityTypeVersionIds.length === 0) return {};
        const rows = yield* Effect.promise(() =>
          db
            .select()
            .from(dbSchema.data_model_authorization)
            .where(
              and(
                eq(
                  dbSchema.data_model_authorization.organization_id,
                  organizationId,
                ),
                isNull(
                  dbSchema.data_model_authorization
                    .authorize_execute_on_action_version_id,
                ),
                inArray(
                  dbSchema.data_model_authorization
                    .authorize_read_on_entities_of_type_version_id,
                  entityTypeVersionIds,
                ),
              ),
            ),
        );

        const grouped = new Map<string, typeof rows>();
        rows.forEach((r) => {
          const key = r.authorize_read_on_entities_of_type_version_id ?? "";
          const list = grouped.get(key) ?? [];
          list.push(r);
          grouped.set(key, list);
        });

        const result: Record<string, EntityTypeAuthorizations> = {};
        for (const [k, list] of grouped.entries()) {
          result[k] = yield* groupEntityTypeAuths(list);
        }
        return result;
      }).pipe(
        Effect.catchAll((e) =>
          Effect.fail(makeDbError("Authz fetch failed", e)),
        ),
      );

  const getByActionVersionIds: AuthorizationService["getByActionVersionIds"] =
    ({ organizationId, actionVersionIds }) =>
      Effect.gen(function* () {
        const db: BuilderDatabase = yield* BuilderDbTag;
        if (actionVersionIds.length === 0) return {};
        const rows = yield* Effect.promise(() =>
          db
            .select()
            .from(dbSchema.data_model_authorization)
            .where(
              and(
                eq(
                  dbSchema.data_model_authorization.organization_id,
                  organizationId,
                ),
                inArray(
                  dbSchema.data_model_authorization
                    .authorize_execute_on_action_version_id,
                  actionVersionIds,
                ),
              ),
            ),
        );

        const grouped = new Map<string, typeof rows>();
        rows.forEach((r) => {
          const key = r.authorize_execute_on_action_version_id ?? "";
          const list = grouped.get(key) ?? [];
          list.push(r);
          grouped.set(key, list);
        });

        const result: Record<string, ReadonlyArray<Authorization>> = {};
        for (const [k, list] of grouped.entries()) {
          const decoded = yield* Effect.forEach(list, (r) =>
            decodeAuthorizationValue(r).pipe(
              Effect.flatMap((v) =>
                "authorizedForAnyoneWithLink" in v
                  ? Effect.fail(
                      makeDbError(
                        "authorizedForAnyoneWithLink is not supported for actions",
                      ),
                    )
                  : Effect.succeed(v),
              ),
            ),
          );
          result[k] = decoded;
        }
        return result;
      }).pipe(
        Effect.catchAll((e) =>
          Effect.fail(makeDbError("Action authz fetch failed", e)),
        ),
      );

  return {
    getByEntityTypeVersionIds,
    getByActionVersionIds,
  } satisfies AuthorizationService;
};

export const makeAuthorizationServiceLayer: Layer.Layer<AuthorizationServiceTag> =
  Layer.effect(
    AuthorizationServiceTag,
    Effect.succeed(makeAuthorizationService()),
  );
