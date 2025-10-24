import { Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import {
  EntityIdSchema,
  EntityTypeIdSchema,
  type OrganizationId,
  type UserId,
} from "../db/ids";
import type { VersionType } from "../domain/version";
import {
  PermissionEngineTag,
  type PermissionEngine,
} from "../permissions/PermissionEngine";
import {
  deriveOneHopFilter,
  deriveMultiHopFilter,
} from "../permissions/FilterPlan";
import * as Option from "effect/Option";
import { OrgEntityStoreTag, type OrgEntityStore } from "./OrgEntityStore";
import { BuilderDbTag } from "../db/tags";
import { dbSchema } from "../db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ColumnIdSchema } from "../db/ids";
import type { EntityTypeVersionId, ColumnId, FieldGroupId } from "../db/ids";

// Minimal query inputs (scaffold)
export const DataLoadingQuerySchema = S.Struct({
  entityTypeId: EntityTypeIdSchema,
  entities: S.optional(S.Array(EntityIdSchema)),
});
export type DataLoadingQuery = typeof DataLoadingQuerySchema.Type;

export const PageSchema = S.Struct({
  pageNumber: S.Number,
  pageSize: S.Number,
});
export type Page = typeof PageSchema.Type;

export const QueryConfigSchema = S.Struct({
  countsOnly: S.optional(S.Boolean),
  linkToken: S.optional(S.String),
  cursorEntityId: S.optional(S.String),
  order: S.optional(S.Union(S.Literal("asc"), S.Literal("desc"))),
});
export type QueryConfig = typeof QueryConfigSchema.Type;

export type Subject = { readonly type: "read"; readonly userId?: UserId };

export interface QueryEntitiesResultEntity {
  readonly entityId: string;
  readonly displayName?: string;
  readonly status?: string;
  readonly columns?: Record<string, unknown>;
}

export interface QueryEntitiesResult {
  readonly entities: ReadonlyArray<QueryEntitiesResultEntity>;
  readonly totalNumberEntities: number;
  readonly totalNumberPages: number;
}

export interface EntityQueryService {
  readonly query: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly subject: Subject;
    readonly query: DataLoadingQuery;
    readonly config: QueryConfig;
    readonly page: Page;
  }) => Effect.Effect<
    QueryEntitiesResult,
    never,
    | PermissionEngineTag
    | import("../db/tags").BuilderDbTag
    | import("../permissions/Authorization").AuthorizationServiceTag
    | import("./UserEntityResolver").UserEntityResolverTag
    | OrgEntityStoreTag
    | import("../db/tags").OrgDbResolverTag
    | import("../permissions/LinkToken").LinkTokenVerifierTag
  >;
}

export class EntityQueryServiceTag extends Context.Tag(
  "effect-ax/EntityQueryService",
)<EntityQueryServiceTag, EntityQueryService>() {}

// Safe scaffold: call PermissionEngine and, unless it returns allowAll/filter in future, return empty results
export const makeEntityQueryService = (): EntityQueryService => {
  const query: EntityQueryService["query"] = ({
    organizationId,
    versionType,
    subject,
    query,
    config,
    page,
  }) =>
    Effect.gen(function* () {
      const engine: PermissionEngine = yield* PermissionEngineTag;
      const plan = yield* engine.planEntityRead({
        organizationId,
        versionType,
        entityTypeId: query.entityTypeId,
        subject,
        linkToken: config.linkToken,
      });

      yield* Effect.log(
        `EntityQuery plan: org=${organizationId} vtype=${versionType} mode=${plan.mode} steps=${plan.traversal?.[0]?.steps.length ?? 0}`,
      );

      // deny-by-default unless an implementation later computes filters
      if (plan.mode === "denyAll") {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }

      const store: OrgEntityStore = yield* OrgEntityStoreTag;
      const builderDb = yield* BuilderDbTag;

      const resolveEntityTypeVersionId = (
        entityTypeId: typeof query.entityTypeId,
      ) =>
        Effect.promise(() =>
          builderDb
            .select({
              version_id: dbSchema.data_model_entity_type_version.version_id,
            })
            .from(dbSchema.data_model_entity_type_version)
            .innerJoin(
              dbSchema.workspace_version_entity_type_version,
              eq(
                dbSchema.workspace_version_entity_type_version
                  .entity_type_version_id,
                dbSchema.data_model_entity_type_version.version_id,
              ),
            )
            .innerJoin(
              dbSchema.workspace_version,
              eq(
                dbSchema.workspace_version.version_id,
                dbSchema.workspace_version_entity_type_version
                  .workspace_version_id,
              ),
            )
            .innerJoin(
              dbSchema.version_refs,
              and(
                eq(
                  dbSchema.version_refs.version_id,
                  dbSchema.workspace_version.version_id,
                ),
                and(
                  eq(dbSchema.version_refs.table_name, "workspace_version"),
                  and(
                    eq(dbSchema.version_refs.organization_id, organizationId),
                    eq(dbSchema.version_refs.version_type, versionType),
                  ),
                ),
              ),
            )
            .where(eq(dbSchema.data_model_entity_type_version.id, entityTypeId))
            .orderBy(
              desc(dbSchema.workspace_version.version_major),
              desc(dbSchema.workspace_version.version_minor),
              desc(dbSchema.workspace_version.version_patch),
            )
            .limit(1),
        ).pipe(Effect.map((rows) => rows[0]?.version_id));

      const extractColumnIds = (
        json: unknown,
      ): ReadonlyArray<typeof ColumnIdSchema.Type> => {
        const result: Array<typeof ColumnIdSchema.Type> = [];
        const visit = (node: unknown): void => {
          if (Array.isArray(node)) {
            node.forEach(visit);
            return;
          }
          if (node && typeof node === "object") {
            for (const [k, v] of Object.entries(
              node as Record<string, unknown>,
            )) {
              if (
                (k === "column_id" || k === "columnId") &&
                typeof v === "string"
              ) {
                try {
                  result.push(S.decodeUnknownSync(ColumnIdSchema)(v));
                } catch {}
              } else {
                visit(v);
              }
            }
          }
        };
        visit(json);
        return result;
      };

      const computeAllowedColumns = (
        versionId: EntityTypeVersionId,
      ): Effect.Effect<ReadonlySet<ColumnId>> =>
        Effect.gen(function* () {
          if (plan.mode === "allowAll") return new Set();
          if (plan.fieldGroupPolicy.anyStateGranted) {
            return new Set();
          }
          const granted = Array.from(plan.fieldGroupPolicy.fieldGroupsGranted);
          if (granted.length === 0) return new Set();
          const fgRows: Array<{ id: FieldGroupId; fields: unknown }> =
            yield* Effect.promise(() =>
              builderDb
                .select({
                  id: dbSchema.field_group.id,
                  fields: dbSchema.field_group.fields,
                })
                .from(dbSchema.field_group)
                .where(
                  and(
                    inArray(dbSchema.field_group.id, granted),
                    eq(dbSchema.field_group.entity_type_version_id, versionId),
                  ),
                ),
            ).pipe(Effect.catchAll(() => Effect.succeed([])));
          const allowed = new Set<ColumnId>();
          for (const row of fgRows) {
            const cols = extractColumnIds(row.fields);
            cols.forEach((c) => allowed.add(c));
          }
          return allowed;
        });

      const prune = (
        entities: ReadonlyArray<QueryEntitiesResultEntity>,
      ): Effect.Effect<ReadonlyArray<QueryEntitiesResultEntity>> =>
        Effect.gen(function* () {
          // System allowAll case has no policy; keep as-is
          if (plan.mode === "allowAll") return entities;
          const versionId = yield* resolveEntityTypeVersionId(
            query.entityTypeId,
          );
          if (!versionId) return entities;
          const versionRows: Array<{
            display_col: ColumnId | null;
            status_col: ColumnId | null;
          }> = yield* Effect.promise(() =>
            builderDb
              .select({
                display_col:
                  dbSchema.data_model_entity_type_version
                    .display_name_column_id,
                status_col:
                  dbSchema.data_model_entity_type_version.status_column_id,
              })
              .from(dbSchema.data_model_entity_type_version)
              .where(
                eq(
                  dbSchema.data_model_entity_type_version.version_id,
                  versionId,
                ),
              )
              .limit(1),
          ).pipe(Effect.catchAll(() => Effect.succeed([])));
          const ver = versionRows[0];
          if (!ver) return entities;

          if (plan.fieldGroupPolicy.anyStateGranted) {
            return entities; // full fields allowed
          }

          const allowed = yield* computeAllowedColumns(versionId);

          const displayId = ver.display_col ?? undefined;
          const statusId = ver.status_col ?? undefined;

          const filtered = entities.map((e) => {
            let displayName = e.displayName;
            let status = e.status;
            if (displayId && !allowed.has(displayId)) {
              displayName = undefined;
            }
            if (statusId && !allowed.has(statusId)) {
              status = undefined;
            }
            return {
              ...e,
              ...(displayName ? { displayName } : {}),
              ...(status ? { status } : {}),
            };
          });

          return filtered;
        });

      // If allowAll, fetch all entities of target type
      if (plan.mode === "allowAll") {
        // compute allowed set for pushdown (may be empty meaning unrestricted)
        const versionId = yield* resolveEntityTypeVersionId(query.entityTypeId);
        const allowedSet = versionId
          ? yield* computeAllowedColumns(versionId)
          : new Set<ColumnId>();
        const allRes = yield* store
          .queryAllOfType({
            organizationId,
            versionType,
            targetEntityTypeId: query.entityTypeId,
            config,
            allowedColumns: allowedSet,
            page,
          })
          .pipe(
            Effect.catchAll(() =>
              Effect.succeed<QueryEntitiesResult>({
                entities: [],
                totalNumberEntities: 0,
                totalNumberPages: 0,
              }),
            ),
          )
          .pipe(
            Effect.withSpan("OrgEntityStore.queryAllOfType", {
              attributes: {
                orgId: organizationId,
                versionType,
                entityTypeId: query.entityTypeId,
              },
            }),
          );
        return { ...allRes, entities: yield* prune(allRes.entities) };
      }

      // Prefer multi-hop if available, else one-hop; otherwise empty
      const multiHop = deriveMultiHopFilter(plan, query.entityTypeId);
      const versionId = yield* resolveEntityTypeVersionId(query.entityTypeId);
      const allowedSet = versionId
        ? yield* computeAllowedColumns(versionId)
        : new Set<ColumnId>();
      if (Option.isSome(multiHop)) {
        const result = yield* store
          .queryByMultiHopFilter({
            organizationId,
            versionType,
            filter: multiHop.value,
            config,
            allowedColumns: allowedSet,
            page,
          })
          .pipe(
            Effect.catchAll(() =>
              Effect.succeed<QueryEntitiesResult>({
                entities: [],
                totalNumberEntities: 0,
                totalNumberPages: 0,
              }),
            ),
          )
          .pipe(
            Effect.withSpan("OrgEntityStore.queryByMultiHopFilter", {
              attributes: {
                orgId: organizationId,
                versionType,
                entityTypeId: query.entityTypeId,
                steps: multiHop.value.steps.length,
              },
            }),
          );
        return { ...result, entities: yield* prune(result.entities) };
      }

      const oneHop = deriveOneHopFilter(plan, query.entityTypeId);
      if (Option.isSome(oneHop)) {
        const result = yield* store
          .queryByOneHopFilter({
            organizationId,
            versionType,
            filter: oneHop.value,
            config,
            allowedColumns: allowedSet,
            page,
          })
          .pipe(
            Effect.catchAll(() =>
              Effect.succeed<QueryEntitiesResult>({
                entities: [],
                totalNumberEntities: 0,
                totalNumberPages: 0,
              }),
            ),
          )
          .pipe(
            Effect.withSpan("OrgEntityStore.queryByOneHopFilter", {
              attributes: {
                orgId: organizationId,
                versionType,
                entityTypeId: query.entityTypeId,
                relationId: oneHop.value.relationId,
                direction: oneHop.value.direction,
              },
            }),
          );
        return { ...result, entities: yield* prune(result.entities) };
      }

      return {
        entities: [],
        totalNumberEntities: 0,
        totalNumberPages: 0,
      } as const;
    }).pipe(
      Effect.withSpan("EntityQueryService.query", {
        attributes: {
          orgId: organizationId,
          versionType,
          entityTypeId: query.entityTypeId,
        },
      }),
    );

  return { query };
};

export const makeEntityQueryServiceLayer: Layer.Layer<EntityQueryServiceTag> =
  Layer.effect(EntityQueryServiceTag, Effect.succeed(makeEntityQueryService()));
