import { Context, Effect, Layer } from "effect";
import { dbSchema } from "../db/schema";
import {
  BuilderDbTag,
  type BuilderDatabase,
  makeDbError,
  type DbError,
} from "../db/tags";
import { and, eq, inArray } from "drizzle-orm";
import type {
  ColumnId,
  EntityTypeId,
  EntityTypeVersionId,
  FieldGroupId,
  OrganizationId,
} from "../db/ids";
import {
  AuthorizationServiceTag,
  type AuthorizationService,
  type EntityTypeAuthorizations,
} from "../permissions/Authorization";

export interface FieldGroupCore {
  readonly id: FieldGroupId;
  readonly name: string;
  readonly stateId?: string;
  readonly supportCreateActionId?: string;
  readonly supportUpdateActionId?: string;
}

export interface EntityTypeCore {
  readonly id: EntityTypeId;
  readonly versionId: EntityTypeVersionId;
  readonly name: string;
  readonly pluralName: string;
  readonly description?: string;
  readonly displayNameColumnId: ColumnId;
  readonly primaryKeyColumnId: ColumnId;
  readonly statusColumnId?: ColumnId;
  readonly profilePictureColumnId?: string;
  readonly fieldGroups: ReadonlyArray<FieldGroupCore>;
  readonly authorizations: EntityTypeAuthorizations;
}

export interface EntityTypeService {
  readonly getByVersionIds: (args: {
    organizationId: OrganizationId;
    versionIds: ReadonlyArray<EntityTypeVersionId>;
  }) => Effect.Effect<
    ReadonlyArray<EntityTypeCore>,
    DbError,
    BuilderDbTag | AuthorizationServiceTag
  >;
}

export class EntityTypeServiceTag extends Context.Tag(
  "effect-ax/EntityTypeService",
)<EntityTypeServiceTag, EntityTypeService>() {}

export const makeEntityTypeService = (): EntityTypeService => {
  const getByVersionIds: EntityTypeService["getByVersionIds"] = ({
    organizationId,
    versionIds,
  }) =>
    Effect.gen(function* () {
      if (versionIds.length === 0) return [] as const;
      const db: BuilderDatabase = yield* BuilderDbTag;
      const authz: AuthorizationService = yield* AuthorizationServiceTag;

      const versions = yield* Effect.promise(() =>
        db
          .select()
          .from(dbSchema.data_model_entity_type_version)
          .where(
            inArray(
              dbSchema.data_model_entity_type_version.version_id,
              versionIds,
            ),
          ),
      );

      if (versions.length === 0) return [] as const;

      const typeIds = versions
        .map((v) => v.id)
        .filter((v): v is EntityTypeId => v != null);

      const types = typeIds.length
        ? yield* Effect.promise(() =>
            db
              .select()
              .from(dbSchema.data_model_entity_type)
              .where(
                and(
                  eq(
                    dbSchema.data_model_entity_type.organization_id,
                    organizationId,
                  ),
                  inArray(dbSchema.data_model_entity_type.id, typeIds),
                ),
              ),
          )
        : ([] as Array<typeof dbSchema.data_model_entity_type.$inferSelect>);

      const groups = yield* Effect.promise(() =>
        db
          .select()
          .from(dbSchema.field_group)
          .where(
            inArray(dbSchema.field_group.entity_type_version_id, versionIds),
          ),
      );

      const authByVersionId = yield* authz.getByEntityTypeVersionIds({
        organizationId,
        entityTypeVersionIds: versionIds,
      });

      const typeById = new Map(types.map((t) => [t.id!, t]));
      const groupsByVersionId = new Map<
        string,
        Array<typeof dbSchema.field_group.$inferSelect>
      >();
      groups.forEach((g) => {
        const list = groupsByVersionId.get(g.entity_type_version_id) ?? [];
        list.push(g);
        groupsByVersionId.set(g.entity_type_version_id, list);
      });

      const res: EntityTypeCore[] = [];
      versions.forEach((v) => {
        const t = v.id ? typeById.get(v.id) : undefined;
        if (!t) return;
        const fg = groupsByVersionId.get(v.version_id) ?? [];
        const mappedGroups: FieldGroupCore[] = fg.map((g) => ({
          id: g.id,
          name: g.name,
          stateId: g.state_id ?? undefined,
          supportCreateActionId: g.support_create_action_id ?? undefined,
          supportUpdateActionId: g.support_update_action_id ?? undefined,
        }));
        const auth = authByVersionId[v.version_id] ?? {
          read: [],
          activityLog: [],
          perFieldGroupId: {},
        };
        res.push({
          id: t.id,
          versionId: v.version_id,
          name: t.name,
          pluralName: t.plural_name,
          description: t.description ?? undefined,
          displayNameColumnId: v.display_name_column_id,
          primaryKeyColumnId: v.primary_key_column_id,
          statusColumnId: v.status_column_id ?? undefined,
          profilePictureColumnId: v.profile_picture_column_id ?? undefined,
          fieldGroups: mappedGroups,
          authorizations: auth,
        });
      });

      return res;
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(makeDbError("Entity types fetch failed", e)),
      ),
    );

  return { getByVersionIds } satisfies EntityTypeService;
};

export const makeEntityTypeServiceLayer: Layer.Layer<EntityTypeServiceTag> =
  Layer.effect(EntityTypeServiceTag, Effect.succeed(makeEntityTypeService()));
