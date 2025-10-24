import { Context, Effect, Layer } from "effect";
import type { OrganizationId, EntityTypeId, ColumnId } from "../db/ids";
import type { VersionType } from "../domain/version";
import type {
  OneHopFilterPlan,
  MultiHopFilterPlan,
} from "../permissions/FilterPlan";
import type {
  QueryConfig,
  Page,
  QueryEntitiesResult,
} from "./EntityQueryService";
import { OrgDbResolverTag, BuilderDbTag, makeDbError } from "../db/tags";
import type { DbError, BuilderDatabase } from "../db/tags";
import { dbSchema } from "../db/schema";
import { and, desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import * as S from "effect/Schema";
import {
  entityTableName,
  relationTableName,
  relationColumnA,
  relationColumnB,
  columnSqlName,
  META,
} from "../orgdb/sqlNames";

export interface OrgEntityStore {
  readonly queryByOneHopFilter: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly filter: OneHopFilterPlan;
    readonly config: QueryConfig;
    readonly allowedColumns?: ReadonlySet<ColumnId>;
    readonly page: Page;
  }) => Effect.Effect<
    QueryEntitiesResult,
    DbError,
    OrgDbResolverTag | BuilderDbTag
  >;

  readonly queryByMultiHopFilter: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly filter: MultiHopFilterPlan;
    readonly config: QueryConfig;
    readonly allowedColumns?: ReadonlySet<ColumnId>;
    readonly page: Page;
  }) => Effect.Effect<
    QueryEntitiesResult,
    DbError,
    OrgDbResolverTag | BuilderDbTag
  >;

  readonly queryAllOfType: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly targetEntityTypeId: EntityTypeId;
    readonly config: QueryConfig;
    readonly allowedColumns?: ReadonlySet<ColumnId>;
    readonly page: Page;
  }) => Effect.Effect<
    QueryEntitiesResult,
    DbError,
    OrgDbResolverTag | BuilderDbTag
  >;
}

export class OrgEntityStoreTag extends Context.Tag("effect-ax/OrgEntityStore")<
  OrgEntityStoreTag,
  OrgEntityStore
>() {}

// Placeholder implementation: returns empty results until a concrete org schema is wired.
export const makeOrgEntityStore = (): OrgEntityStore => {
  const safeLiteral = (s: string): string | undefined =>
    /^[A-Za-z0-9_:\-]+$/.test(s) ? s : undefined;
  // Resolve workspace-bound version ids
  const resolveEntityTypeVersionId = (
    db: BuilderDatabase,
    organizationId: OrganizationId,
    versionType: VersionType,
    entityTypeId: EntityTypeId,
  ) =>
    Effect.tryPromise({
      try: async () => {
        // Join workspace_version + version_refs (for version_type) + workspace_version_entity_type_version + data_model_entity_type_version
        const w = dbSchema.workspace_version;
        const vr = dbSchema.version_refs;
        const wvev = dbSchema.workspace_version_entity_type_version;
        const etv = dbSchema.data_model_entity_type_version;
        const rows = await db
          .select({
            entity_type_version_id: wvev.entity_type_version_id,
            version_major: w.version_major,
            version_minor: w.version_minor,
            version_patch: w.version_patch,
          })
          .from(w)
          .leftJoin(
            vr,
            and(
              eq(vr.version_id, w.version_id),
              and(
                eq(vr.table_name, "workspace_version"),
                and(
                  eq(vr.organization_id, organizationId),
                  eq(vr.version_type, versionType),
                ),
              ),
            ),
          )
          .innerJoin(wvev, eq(wvev.workspace_version_id, w.version_id))
          .innerJoin(etv, eq(etv.version_id, wvev.entity_type_version_id))
          .where(eq(etv.id, entityTypeId))
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1);
        return rows[0]?.entity_type_version_id;
      },
      catch: (cause) =>
        makeDbError("Failed to resolve entity type version", cause),
    });

  const resolveRelationVersionId = (
    db: BuilderDatabase,
    organizationId: OrganizationId,
    versionType: VersionType,
    relationId: import("../db/ids").RelationId,
  ) =>
    Effect.tryPromise({
      try: async () => {
        const w = dbSchema.workspace_version;
        const vr = dbSchema.version_refs;
        const wvrv = dbSchema.workspace_version_relation_version;
        const drv = dbSchema.data_model_entity_relation;
        const rows = await db
          .select({
            relation_version_id: wvrv.relation_version_id,
            version_major: w.version_major,
            version_minor: w.version_minor,
            version_patch: w.version_patch,
          })
          .from(w)
          .leftJoin(
            vr,
            and(
              eq(vr.version_id, w.version_id),
              and(
                eq(vr.table_name, "workspace_version"),
                and(
                  eq(vr.organization_id, organizationId),
                  eq(vr.version_type, versionType),
                ),
              ),
            ),
          )
          .innerJoin(wvrv, eq(wvrv.workspace_version_id, w.version_id))
          .innerJoin(drv, eq(drv.version_id, wvrv.relation_version_id))
          .where(eq(drv.id, relationId))
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1);
        return rows[0]?.relation_version_id;
      },
      catch: (cause) =>
        makeDbError("Failed to resolve relation version", cause),
    });

  const queryByOneHopFilter: OrgEntityStore["queryByOneHopFilter"] = ({
    organizationId,
    versionType,
    filter,
    config,
    allowedColumns,
    page,
  }) =>
    Effect.gen(function* () {
      // Resolve latest relation version and its endpoint entityTypeIds
      const builderDb: BuilderDatabase = yield* BuilderDbTag;
      const resolvedRelationVersionId = yield* resolveRelationVersionId(
        builderDb,
        organizationId,
        versionType,
        filter.relationId,
      );
      const relRows = resolvedRelationVersionId
        ? yield* Effect.tryPromise({
            try: () =>
              builderDb
                .select({
                  version_id: dbSchema.data_model_entity_relation.version_id,
                  a: dbSchema.data_model_entity_relation.entity_type_id_a,
                  b: dbSchema.data_model_entity_relation.entity_type_id_b,
                })
                .from(dbSchema.data_model_entity_relation)
                .where(
                  eq(
                    dbSchema.data_model_entity_relation.version_id,
                    resolvedRelationVersionId,
                  ),
                )
                .limit(1),
            catch: (cause) =>
              makeDbError("Failed to load relation version", cause),
          })
        : [];
      const rel = relRows[0];

      if (!rel) {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }

      const targetEntityTypeVersionId = yield* resolveEntityTypeVersionId(
        builderDb,
        organizationId,
        versionType,
        filter.targetEntityTypeId,
      );
      const targetRows = targetEntityTypeVersionId
        ? yield* Effect.tryPromise({
            try: () =>
              builderDb
                .select({
                  version_id:
                    dbSchema.data_model_entity_type_version.version_id,
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
                    targetEntityTypeVersionId,
                  ),
                )
                .limit(1),
            catch: (cause) =>
              makeDbError("Failed to load target entity type version", cause),
          })
        : [];
      const targetVer = targetRows[0];

      if (!targetVer) {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }

      // Compute dynamic table/column names
      const relTable = relationTableName(versionType, rel.version_id);
      const entTable = entityTableName(versionType, targetVer.version_id);
      const displayColRaw = targetVer.display_col
        ? columnSqlName(targetVer.display_col)
        : undefined;
      const statusColRaw = targetVer.status_col
        ? columnSqlName(targetVer.status_col)
        : undefined;
      const unrestricted = !allowedColumns || allowedColumns.size === 0;
      const displayCol =
        unrestricted ||
        (targetVer.display_col && allowedColumns?.has(targetVer.display_col))
          ? displayColRaw
          : undefined;
      const statusCol =
        unrestricted ||
        (targetVer.status_col && allowedColumns?.has(targetVer.status_col))
          ? statusColRaw
          : undefined;
      if (!rel.a || !rel.b) {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }
      const anchorCol =
        filter.direction === "aToB"
          ? relationColumnA(rel.a)
          : relationColumnB(rel.b);
      const targetCol =
        filter.direction === "aToB"
          ? relationColumnB(rel.b)
          : relationColumnA(rel.a);

      const resolver = yield* OrgDbResolverTag;
      const orgDb = yield* resolver.get(organizationId);

      const limit = page.pageSize;
      const offset = page.pageNumber * page.pageSize;
      const order = config.order ?? "asc";
      const keyset = config.cursorEntityId;

      // Build optional JSON columns projection for allowedColumns beyond display/status
      const extraCols: string[] = [];
      if (allowedColumns && allowedColumns.size > 0) {
        for (const col of allowedColumns) {
          if (
            (targetVer.display_col && col === targetVer.display_col) ||
            (targetVer.status_col && col === targetVer.status_col)
          )
            continue;
          extraCols.push(col);
        }
      }
      const jsonColumnsExpr =
        extraCols.length > 0
          ? `jsonb_build_object(${extraCols
              .map((c) => `'${c}', e.${columnSqlName(c)}`)
              .join(", ")}) as columns,`
          : "";

      const rowsStartedAtOneHop = Date.now();
      const rowsRes = yield* Effect.tryPromise({
        try: () => {
          const started = Date.now();
          // keyset/order handled inline in query text below
          if (displayCol && statusCol) {
            const ks = keyset ? safeLiteral(keyset) : undefined;
            const anchor = safeLiteral(filter.anchorUserEntityId);
            const q = `SELECT r.${targetCol} as entity_id,
                          e.${displayCol} as display_name,
                          e.${statusCol} as status,
                          ${jsonColumnsExpr}
                          1 as __dummy__
                       FROM ${relTable} as r
                       INNER JOIN ${entTable} as e
                         ON e.${META.ENTITY_ID} = r.${targetCol} AND e.${META.IS_DELETED} = false
                        WHERE r.${anchorCol} = '${anchor ?? ""}'
                         AND r.${META.IS_DELETED} = false
                         ${ks ? (order === "asc" ? `AND r.${targetCol} > '${ks}'` : `AND r.${targetCol} < '${ks}'`) : ""}
                       ORDER BY r.${targetCol} ${order === "asc" ? "ASC" : "DESC"}
                       LIMIT ${limit} OFFSET ${offset}`;
            return orgDb.execute(sql.raw(q));
          }
          if (displayCol && !statusCol) {
            const ks = keyset ? safeLiteral(keyset) : undefined;
            const anchor = safeLiteral(filter.anchorUserEntityId);
            const q = `SELECT r.${targetCol} as entity_id,
                          e.${displayCol} as display_name,
                          ${jsonColumnsExpr}
                          1 as __dummy__
                       FROM ${relTable} as r
                       INNER JOIN ${entTable} as e
                         ON e.${META.ENTITY_ID} = r.${targetCol} AND e.${META.IS_DELETED} = false
                        WHERE r.${anchorCol} = '${anchor ?? ""}'
                         AND r.${META.IS_DELETED} = false
                         ${ks ? (order === "asc" ? `AND r.${targetCol} > '${ks}'` : `AND r.${targetCol} < '${ks}'`) : ""}
                       ORDER BY r.${targetCol} ${order === "asc" ? "ASC" : "DESC"}
                       LIMIT ${limit} OFFSET ${offset}`;
            return orgDb.execute(sql.raw(q));
          }
          const ks = keyset ? safeLiteral(keyset) : undefined;
          const anchor = safeLiteral(filter.anchorUserEntityId);
          const q = `SELECT r.${targetCol} as entity_id,
                         ${jsonColumnsExpr}
                         1 as __dummy__
                      FROM ${relTable} as r
                      INNER JOIN ${entTable} as e
                        ON e.${META.ENTITY_ID} = r.${targetCol} AND e.${META.IS_DELETED} = false
                      WHERE r.${anchorCol} = '${anchor ?? ""}'
                        AND r.${META.IS_DELETED} = false
                        ${ks ? (order === "asc" ? `AND r.${targetCol} > '${ks}'` : `AND r.${targetCol} < '${ks}'`) : ""}
                      ORDER BY r.${targetCol} ${order === "asc" ? "ASC" : "DESC"}
                      LIMIT ${limit} OFFSET ${offset}`;
          return orgDb.execute(sql.raw(q));
        },
        catch: (cause) => makeDbError("Org one-hop query failed", cause),
      });

      const rowsElapsedMsOneHop = Date.now() - rowsStartedAtOneHop;
      const countRes = yield* Effect.tryPromise({
        try: () =>
          orgDb.execute(
            sql`SELECT COUNT(*)::int as cnt
            FROM ${sql.raw(relTable)} as r
            INNER JOIN ${sql.raw(entTable)} as e
              ON e.${sql.raw(META.ENTITY_ID)} = r.${sql.raw(targetCol)} AND e.${sql.raw(META.IS_DELETED)} = false
            WHERE r.${sql.raw(anchorCol)} = ${filter.anchorUserEntityId}
              AND r.${sql.raw(META.IS_DELETED)} = false`,
          ),
        catch: (cause) => makeDbError("Org count query failed", cause),
      });

      const RowsSchema = S.Struct({
        rows: S.Array(
          S.Struct({
            entity_id: S.String,
            display_name: S.optional(S.String),
            status: S.optional(S.String),
            columns: S.optional(S.Record({ key: S.String, value: S.Unknown })),
          }),
        ),
      });
      const CountSchema = S.Struct({
        rows: S.Array(S.Struct({ cnt: S.Union(S.Number, S.String) })),
      });
      const decodedRows = S.decodeUnknownSync(RowsSchema)(rowsRes);
      const decodedCount = S.decodeUnknownSync(CountSchema)(countRes);
      const firstCnt = decodedCount.rows[0]?.cnt;
      const total =
        typeof firstCnt === "string" ? Number(firstCnt) : (firstCnt ?? 0);
      const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);
      const ids = decodedRows.rows;

      yield* Effect.log(
        `OrgEntityStore.oneHop org=${organizationId} relTable=${relTable} entTable=${entTable} dir=${filter.direction} total=${total} rows_ms=${rowsElapsedMsOneHop}`,
      );

      return {
        entities:
          config.countsOnly === true
            ? []
            : ids.map((r) => ({
                entityId: r.entity_id,
                ...(r.display_name ? { displayName: r.display_name } : {}),
                ...(r.status ? { status: r.status } : {}),
                ...(typeof r.columns !== "undefined"
                  ? { columns: r.columns }
                  : {}),
              })),
        totalNumberEntities: total,
        totalNumberPages: totalPages,
      } satisfies QueryEntitiesResult;
    }).pipe(
      Effect.withSpan("OrgEntityStore.queryByOneHopFilter", {
        attributes: {
          orgId: organizationId,
          versionType,
          relationId: filter.relationId,
          direction: filter.direction,
        },
      }),
    );

  const queryByMultiHopFilter: OrgEntityStore["queryByMultiHopFilter"] = ({
    organizationId,
    versionType,
    filter,
    config,
    allowedColumns,
    page,
  }) =>
    Effect.gen(function* () {
      const builderDb: BuilderDatabase = yield* BuilderDbTag;
      // Resolve all relation version ids and target entity type version id
      const stepVersions: Array<{
        relation_version_id: string;
        a: string;
        b: string;
        direction: "aToB" | "bToA";
      }> = [];
      for (const step of filter.steps) {
        const relVersionId = yield* resolveRelationVersionId(
          builderDb,
          organizationId,
          versionType,
          step.relationId,
        );
        if (!relVersionId) {
          return {
            entities: [],
            totalNumberEntities: 0,
            totalNumberPages: 0,
          } as const;
        }
        const relRow = yield* Effect.tryPromise({
          try: () =>
            builderDb
              .select({
                version_id: dbSchema.data_model_entity_relation.version_id,
                a: dbSchema.data_model_entity_relation.entity_type_id_a,
                b: dbSchema.data_model_entity_relation.entity_type_id_b,
              })
              .from(dbSchema.data_model_entity_relation)
              .where(
                eq(
                  dbSchema.data_model_entity_relation.version_id,
                  relVersionId,
                ),
              )
              .limit(1),
          catch: (cause) =>
            makeDbError("Failed to load relation version", cause),
        });
        const rel = relRow[0];
        if (!rel) {
          return {
            entities: [],
            totalNumberEntities: 0,
            totalNumberPages: 0,
          } as const;
        }
        stepVersions.push({
          relation_version_id: rel.version_id,
          a: rel.a!,
          b: rel.b!,
          direction: step.direction,
        });
      }

      const targetEntityTypeVersionId = yield* resolveEntityTypeVersionId(
        builderDb,
        organizationId,
        versionType,
        filter.targetEntityTypeId,
      );
      if (!targetEntityTypeVersionId) {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }

      const entTable = entityTableName(versionType, targetEntityTypeVersionId);
      // Get display/status cols
      const targetRows = yield* Effect.tryPromise({
        try: () =>
          builderDb
            .select({
              display_col:
                dbSchema.data_model_entity_type_version.display_name_column_id,
              status_col:
                dbSchema.data_model_entity_type_version.status_column_id,
            })
            .from(dbSchema.data_model_entity_type_version)
            .where(
              eq(
                dbSchema.data_model_entity_type_version.version_id,
                targetEntityTypeVersionId,
              ),
            )
            .limit(1),
        catch: (cause) =>
          makeDbError("Failed to load target entity version", cause),
      });
      const targetVer = targetRows[0];
      const displayColRaw = targetVer?.display_col
        ? columnSqlName(targetVer.display_col)
        : undefined;
      const statusColRaw = targetVer?.status_col
        ? columnSqlName(targetVer.status_col)
        : undefined;
      const unrestricted2 = !allowedColumns || allowedColumns.size === 0;
      const displayCol =
        unrestricted2 ||
        (targetVer?.display_col && allowedColumns?.has(targetVer.display_col))
          ? displayColRaw
          : undefined;
      const statusCol =
        unrestricted2 ||
        (targetVer?.status_col && allowedColumns?.has(targetVer.status_col))
          ? statusColRaw
          : undefined;

      // Build recursive CTE across steps (bounded by steps length)
      const resolver = yield* OrgDbResolverTag;
      const orgDb = yield* resolver.get(organizationId);
      const limit = page.pageSize;
      const offset = page.pageNumber * page.pageSize;
      const order = config.order ?? "asc";
      const keyset = config.cursorEntityId;

      // JSON columns projection for allowedColumns beyond display/status
      const extraCols: string[] = [];
      if (allowedColumns && allowedColumns.size > 0) {
        for (const col of allowedColumns) {
          if (
            (targetVer?.display_col && col === targetVer.display_col) ||
            (targetVer?.status_col && col === targetVer.status_col)
          )
            continue;
          extraCols.push(col);
        }
      }
      const jsonColumnsExpr =
        extraCols.length > 0
          ? `jsonb_build_object(${extraCols
              .map((c) => `'${c}', e.${columnSqlName(c)}`)
              .join(", ")}) as columns,`
          : "";

      const recursiveTerms: string[] = stepVersions.map((sv, idx) => {
        const relTable = relationTableName(versionType, sv.relation_version_id);
        const anchorCol =
          sv.direction === "aToB"
            ? relationColumnA(sv.a)
            : relationColumnB(sv.b);
        const targetCol =
          sv.direction === "aToB"
            ? relationColumnB(sv.b)
            : relationColumnA(sv.a);
        return `SELECT r.${targetCol} AS entity_id, reachable.depth + 1 AS depth
                FROM ${relTable} AS r
                JOIN reachable ON r.${anchorCol} = reachable.entity_id
                WHERE reachable.depth = ${idx} AND r.${META.IS_DELETED} = false`;
      });

      const cte = `WITH RECURSIVE reachable(entity_id, depth) AS (
  SELECT '${filter.anchorUserEntityId}'::text AS entity_id, 0 AS depth
  UNION ALL
  ${recursiveTerms.join("\n  UNION ALL\n  ")}
)`;
      const selectCols = [
        `e.${META.ENTITY_ID} as entity_id`,
        displayCol ? `e.${displayCol} as display_name` : undefined,
        statusCol ? `e.${statusCol} as status` : undefined,
        jsonColumnsExpr ? jsonColumnsExpr.slice(0, -1) : undefined,
      ]
        .filter(Boolean)
        .join(", ");
      const ks2 = keyset ? safeLiteral(keyset) : undefined;
      const keysetFilter = ks2
        ? order === "asc"
          ? `AND e.${META.ENTITY_ID} > '${ks2}'`
          : `AND e.${META.ENTITY_ID} < '${ks2}'`
        : "";
      const rowsStartedAtAll = Date.now();
      const selectSql = `${cte}
SELECT ${selectCols}
FROM ${entTable} AS e
INNER JOIN reachable s ON e.${META.ENTITY_ID} = s.entity_id AND e.${META.IS_DELETED} = false
WHERE s.depth = ${stepVersions.length} ${keysetFilter}
ORDER BY e.${META.ENTITY_ID} ${order === "asc" ? "ASC" : "DESC"}
LIMIT ${limit} OFFSET ${offset}`;

      const countSql = `${cte}
SELECT COUNT(*)::int as cnt
FROM ${entTable} AS e
INNER JOIN reachable s ON e.${META.ENTITY_ID} = s.entity_id AND e.${META.IS_DELETED} = false
WHERE s.depth = ${stepVersions.length}`;

      const rowsStartedAt2 = Date.now();
      const rowsRes = yield* Effect.tryPromise({
        try: () => orgDb.execute(sql.raw(selectSql)),
        catch: (cause) => makeDbError("Org multi-hop query failed", cause),
      });
      const rowsElapsedMs2 = Date.now() - rowsStartedAt2;
      const countStartedAt2 = Date.now();
      const countRes = yield* Effect.tryPromise({
        try: () => orgDb.execute(sql.raw(countSql)),
        catch: (cause) =>
          makeDbError("Org multi-hop count query failed", cause),
      });
      const countElapsedMs2 = Date.now() - countStartedAt2;

      const RowsSchema = S.Struct({
        rows: S.Array(
          S.Struct({
            entity_id: S.String,
            display_name: S.optional(S.String),
            status: S.optional(S.String),
            columns: S.optional(S.Record({ key: S.String, value: S.Unknown })),
          }),
        ),
      });
      const CountSchema = S.Struct({
        rows: S.Array(S.Struct({ cnt: S.Union(S.Number, S.String) })),
      });
      const decodedRows = S.decodeUnknownSync(RowsSchema)(rowsRes);
      const decodedCount = S.decodeUnknownSync(CountSchema)(countRes);
      const firstCnt = decodedCount.rows[0]?.cnt;
      const total =
        typeof firstCnt === "string" ? Number(firstCnt) : (firstCnt ?? 0);
      const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);
      const ids = decodedRows.rows;

      yield* Effect.log(
        `OrgEntityStore.multiHop org=${organizationId} steps=${stepVersions.length} entTable=${entTable} total=${total} rows_ms=${rowsElapsedMs2} count_ms=${countElapsedMs2}`,
      );

      return {
        entities:
          config.countsOnly === true
            ? []
            : ids.map((r) => ({
                entityId: r.entity_id,
                ...(r.display_name ? { displayName: r.display_name } : {}),
                ...(r.status ? { status: r.status } : {}),
                ...(typeof r.columns !== "undefined"
                  ? { columns: r.columns }
                  : {}),
              })),
        totalNumberEntities: total,
        totalNumberPages: totalPages,
      } satisfies QueryEntitiesResult;
    }).pipe(
      Effect.withSpan("OrgEntityStore.queryByMultiHopFilter", {
        attributes: {
          orgId: organizationId,
          versionType,
          steps: filter.steps.length,
        },
      }),
    );

  const queryAllOfType: OrgEntityStore["queryAllOfType"] = ({
    organizationId,
    versionType,
    targetEntityTypeId,
    config,
    allowedColumns,
    page,
  }) =>
    Effect.gen(function* () {
      const builderDb: BuilderDatabase = yield* BuilderDbTag;
      const targetEntityTypeVersionId = yield* resolveEntityTypeVersionId(
        builderDb,
        organizationId,
        versionType,
        targetEntityTypeId,
      );
      const verRows = targetEntityTypeVersionId
        ? yield* Effect.tryPromise({
            try: () =>
              builderDb
                .select({
                  version_id:
                    dbSchema.data_model_entity_type_version.version_id,
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
                    targetEntityTypeVersionId,
                  ),
                )
                .limit(1),
            catch: (cause) =>
              makeDbError("Failed to load target entity type version", cause),
          })
        : [];
      const ver = verRows[0];
      if (!ver) {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }

      const entTable = entityTableName(versionType, ver.version_id);
      const displayColRaw = ver.display_col
        ? columnSqlName(ver.display_col)
        : undefined;
      const statusColRaw = ver.status_col
        ? columnSqlName(ver.status_col)
        : undefined;
      const displayCol =
        allowedColumns &&
        ver.display_col &&
        !allowedColumns.has(ver.display_col)
          ? undefined
          : displayColRaw;
      const statusCol =
        allowedColumns && ver.status_col && !allowedColumns.has(ver.status_col)
          ? undefined
          : statusColRaw;
      const resolver = yield* OrgDbResolverTag;
      const orgDb = yield* resolver.get(organizationId);

      const limit = page.pageSize;
      const offset = page.pageNumber * page.pageSize;
      const order = config.order ?? "asc";
      const keyset = config.cursorEntityId;
      const extraCols: string[] = [];
      if (allowedColumns && allowedColumns.size > 0) {
        for (const col of allowedColumns) {
          if (
            (ver.display_col && col === ver.display_col) ||
            (ver.status_col && col === ver.status_col)
          )
            continue;
          extraCols.push(col);
        }
      }
      const jsonColumnsExpr =
        extraCols.length > 0
          ? `jsonb_build_object(${extraCols
              .map((c) => `'${c}', e.${columnSqlName(c)}`)
              .join(", ")}) as columns,`
          : "";
      const ks3 = keyset ? safeLiteral(keyset) : undefined;
      const keysetFilter = ks3
        ? order === "asc"
          ? `AND e.${META.ENTITY_ID} > '${ks3}'`
          : `AND e.${META.ENTITY_ID} < '${ks3}'`
        : "";
      const rowsRes = yield* Effect.tryPromise({
        try: () => {
          if (displayCol && statusCol) {
            const q = `SELECT e.${META.ENTITY_ID} as entity_id,
                          e.${displayCol} as display_name,
                          e.${statusCol} as status,
                          ${jsonColumnsExpr}
                          1 as __dummy__
                       FROM ${entTable} as e
                       WHERE e.${META.IS_DELETED} = false ${keysetFilter}
                       ORDER BY e.${META.ENTITY_ID} ${order === "asc" ? "ASC" : "DESC"}
                       LIMIT ${limit} OFFSET ${offset}`;
            return orgDb.execute(sql.raw(q));
          }
          if (displayCol && !statusCol) {
            const q = `SELECT e.${META.ENTITY_ID} as entity_id,
                          e.${displayCol} as display_name,
                          ${jsonColumnsExpr}
                          1 as __dummy__
                       FROM ${entTable} as e
                       WHERE e.${META.IS_DELETED} = false ${keysetFilter}
                       ORDER BY e.${META.ENTITY_ID} ${order === "asc" ? "ASC" : "DESC"}
                       LIMIT ${limit} OFFSET ${offset}`;
            return orgDb.execute(sql.raw(q));
          }
          const q = `SELECT e.${META.ENTITY_ID} as entity_id,
                         ${jsonColumnsExpr}
                         1 as __dummy__
                      FROM ${entTable} as e
                      WHERE e.${META.IS_DELETED} = false ${keysetFilter}
                      ORDER BY e.${META.ENTITY_ID} ${order === "asc" ? "ASC" : "DESC"}
                      LIMIT ${limit} OFFSET ${offset}`;
          return orgDb.execute(sql.raw(q));
        },
        catch: (cause) => makeDbError("Org all-of-type query failed", cause),
      });
      // omitted timing capture for allowAll to reduce overhead

      const countRes = yield* Effect.tryPromise({
        try: () =>
          orgDb.execute(
            sql`SELECT COUNT(*)::int as cnt
                FROM ${sql.raw(entTable)} as e
                WHERE e.${sql.raw(META.IS_DELETED)} = false`,
          ),
        catch: (cause) =>
          makeDbError("Org all-of-type count query failed", cause),
      });

      const RowsSchema2 = S.Struct({
        rows: S.Array(
          S.Struct({
            entity_id: S.String,
            display_name: S.optional(S.String),
            status: S.optional(S.String),
            columns: S.optional(S.Record({ key: S.String, value: S.Unknown })),
          }),
        ),
      });
      const CountSchema2 = S.Struct({
        rows: S.Array(S.Struct({ cnt: S.Union(S.Number, S.String) })),
      });
      const decodedRows2 = S.decodeUnknownSync(RowsSchema2)(rowsRes);
      const decodedCount2 = S.decodeUnknownSync(CountSchema2)(countRes);
      const firstCnt2 = decodedCount2.rows[0]?.cnt;
      const total =
        typeof firstCnt2 === "string" ? Number(firstCnt2) : (firstCnt2 ?? 0);
      const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);
      const ids = decodedRows2.rows;
      yield* Effect.log(
        `OrgEntityStore.allowAll org=${organizationId} entTable=${entTable} total=${total}`,
      );

      return {
        entities:
          config.countsOnly === true
            ? []
            : ids.map((r) => ({
                entityId: r.entity_id,
                ...(r.display_name ? { displayName: r.display_name } : {}),
                ...(r.status ? { status: r.status } : {}),
                ...(typeof r.columns !== "undefined"
                  ? { columns: r.columns }
                  : {}),
              })),
        totalNumberEntities: total,
        totalNumberPages: totalPages,
      } satisfies QueryEntitiesResult;
    }).pipe(
      Effect.withSpan("OrgEntityStore.queryAllOfType", {
        attributes: {
          orgId: organizationId,
          versionType,
          entityTypeId: targetEntityTypeId,
        },
      }),
    );

  return { queryByOneHopFilter, queryByMultiHopFilter, queryAllOfType };
};

export const makeOrgEntityStoreLayer: Layer.Layer<OrgEntityStoreTag> =
  Layer.effect(OrgEntityStoreTag, Effect.succeed(makeOrgEntityStore()));
