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
import { and, desc, eq, or } from "drizzle-orm";
import { sql } from "drizzle-orm";
import * as S from "effect/Schema";
import {
  entityTableName,
  relationTableName,
  relationColumnA,
  relationColumnB,
  columnSqlName,
  META,
  normalizeId,
} from "../orgdb/sqlNames";

export interface OrgEntityStore {
  readonly queryByOneHopFilter: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly filter: OneHopFilterPlan;
    readonly config: QueryConfig;
    readonly allowedColumns?: ReadonlySet<ColumnId>;
    // Optional: restrict projected extra columns (besides display/status)
    readonly projectColumns?: ReadonlySet<ColumnId>;
    readonly page: Page;
  }) => Effect.Effect<
    QueryEntitiesResult,
    DbError,
    OrgDbResolverTag | BuilderDbTag
  >;

  readonly findEntities: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly targetEntityTypeId: EntityTypeId;
    readonly filters: ReadonlyArray<{
      readonly columnId: ColumnId;
      readonly op: "eq" | "ilike";
      readonly value: string;
    }>;
    readonly config: QueryConfig;
    readonly allowedColumns?: ReadonlySet<ColumnId>;
    readonly projectColumns?: ReadonlySet<ColumnId>;
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
    // Optional: restrict projected extra columns (besides display/status)
    readonly projectColumns?: ReadonlySet<ColumnId>;
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
    // Optional: restrict projected extra columns (besides display/status)
    readonly projectColumns?: ReadonlySet<ColumnId>;
    readonly page: Page;
  }) => Effect.Effect<
    QueryEntitiesResult,
    DbError,
    OrgDbResolverTag | BuilderDbTag
  >;

  /**
   * Find a single entity id by exact match on a column value.
   * Intended for simple lookups like phone/email on People.
   */
  readonly findByColumnEquals: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly targetEntityTypeId: EntityTypeId;
    readonly columnId: ColumnId;
    readonly value: string;
  }) => Effect.Effect<
    string | undefined,
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
  // Normalize driver results to readonly row arrays without casts
  const decodeRows = <A>(
    u: unknown,
    row: S.Schema<A, A>,
    label: string,
  ): Effect.Effect<readonly A[], DbError> =>
    Effect.try({
      try: () => {
        const RowsObj = S.Struct({ rows: S.Array(row) });
        try {
          const r = S.decodeUnknownSync(RowsObj)(u);
          return r.rows as readonly A[];
        } catch {
          const Arr = S.Array(row);
          const r = S.decodeUnknownSync(Arr)(u);
          return r as readonly A[];
        }
      },
      catch: (cause) => makeDbError(`Failed to decode ${label} rows`, cause),
    });
  const safeLiteral = (s: string): string | undefined =>
    /^[A-Za-z0-9_:\-]+$/.test(s) ? s : undefined;
  const safePhoneLiteral = (s: string): string | undefined =>
    /^[+0-9()\-\s]+$/.test(s) ? s : undefined;
  // Resolve workspace-bound version ids
  const resolveEntityTypeVersionId = (
    db: BuilderDatabase,
    organizationId: OrganizationId,
    versionType: VersionType,
    entityTypeId: EntityTypeId,
  ) =>
    Effect.tryPromise({
      try: async () => {
        // Resolve entity type version mapped for this org/versionType using workspace order
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
          .innerJoin(wvev, eq(wvev.workspace_version_id, w.version_id))
          .innerJoin(etv, eq(etv.version_id, wvev.entity_type_version_id))
          .innerJoin(
            vr,
            and(
              eq(vr.version_id, etv.version_id),
              or(
                eq(vr.table_name, "builder.data_model_entity_type"),
                eq(vr.table_name, "data_model_entity_type"),
              ),
              eq(vr.organization_id, organizationId),
              eq(vr.version_type, versionType),
            ),
          )
          .where(eq(etv.id, entityTypeId))
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1);
        const mapped = rows[0]?.entity_type_version_id;
        if (mapped) return mapped;
        // Fallback: latest workspace version for this entity type (system types, unmapped)
        const fallback = await db
          .select({ entity_type_version_id: wvev.entity_type_version_id })
          .from(w)
          .innerJoin(wvev, eq(wvev.workspace_version_id, w.version_id))
          .innerJoin(etv, eq(etv.version_id, wvev.entity_type_version_id))
          .where(eq(etv.id, entityTypeId))
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1);
        return fallback[0]?.entity_type_version_id;
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
          .innerJoin(wvrv, eq(wvrv.workspace_version_id, w.version_id))
          .innerJoin(drv, eq(drv.version_id, wvrv.relation_version_id))
          .innerJoin(
            vr,
            and(
              eq(vr.version_id, wvrv.relation_version_id),
              or(
                eq(vr.table_name, "builder.data_model_entity_relation"),
                eq(vr.table_name, "data_model_entity_relation"),
              ),
              eq(vr.organization_id, organizationId),
              eq(vr.version_type, versionType),
            ),
          )
          .where(eq(drv.id, relationId))
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1);
        const mapped = rows[0]?.relation_version_id;
        if (mapped) return mapped;
        // Fallback: latest workspace version for this relation (system relations, unmapped)
        const fallback = await db
          .select({ relation_version_id: wvrv.relation_version_id })
          .from(w)
          .innerJoin(wvrv, eq(wvrv.workspace_version_id, w.version_id))
          .innerJoin(drv, eq(drv.version_id, wvrv.relation_version_id))
          .where(eq(drv.id, relationId))
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1);
        return fallback[0]?.relation_version_id;
      },
      catch: (cause) =>
        makeDbError("Failed to resolve relation version", cause),
    });

  const checkTableExists = (
    orgDb: { execute: (q: unknown) => PromiseLike<unknown> },
    tableName: string,
  ): Effect.Effect<boolean, DbError> =>
    Effect.gen(function* () {
      const res = yield* Effect.promise(() =>
        orgDb.execute(
          sql.raw(`SELECT to_regclass('${tableName}') IS NOT NULL AS exists`),
        ),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org table existence check failed", cause)),
        ),
      );
      const Row = S.Struct({
        exists: S.Union(S.Boolean, S.String, S.Number),
      });
      const rows = (yield* decodeRows(res, Row, "table-exists")) as readonly {
        readonly exists: boolean | string | number;
      }[];
      const v = rows[0]?.exists;
      return v === true || v === 1 || v === "1" || v === "t" || v === "true";
    });

  const resolveColumnSqlName = (
    orgDb: { execute: (q: unknown) => PromiseLike<unknown> },
    tableName: string,
    columnId: string,
  ): Effect.Effect<string, DbError> =>
    Effect.gen(function* () {
      const listRes = yield* Effect.promise(() =>
        orgDb.execute(
          sql.raw(
            `SELECT attname as name
               FROM pg_attribute
               WHERE attrelid = '${tableName}'::regclass
                 AND attnum > 0
                 AND NOT attisdropped`,
          ),
        ),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org list columns for table failed", cause)),
        ),
      );
      const Row = S.Struct({ name: S.String });
      const rows = (yield* decodeRows(
        listRes,
        Row,
        "table-columns",
      )) as readonly {
        readonly name: string;
      }[];
      const targetBase = normalizeId(columnId).replace(/^col_/, "");
      const names = rows.map((r) => r.name);
      // 1) exact match on col_<id>
      const exact = names.find((n) => n === `col_${targetBase}`);
      if (exact) return exact;
      // 2) anchored suffix match on base id ( ..._<id> ) ignoring a single leading col_
      const anchored = names.find((n) =>
        n.replace(/^col_/, "").endsWith(`_${targetBase}`),
      );
      if (anchored) return anchored;
      // 3) conservative fallback: default naming for the id
      return columnSqlName(columnId);
    });

  const resolveEntityTableName = (
    orgDb: { execute: (q: unknown) => PromiseLike<unknown> },
    versionType: string,
    entityTypeVersionId: string,
  ): Effect.Effect<string | undefined, DbError> =>
    Effect.gen(function* () {
      const norm = entityTypeVersionId.replace(/-/g, "_").toLowerCase();
      const noPrefix = norm.replace(/^etv_/, "");
      const candidates = [
        `entity_${versionType}_${noPrefix}`,
        `entity_${versionType}_${norm}`,
      ];
      for (const name of candidates) {
        const ok = yield* checkTableExists(orgDb, name);
        if (ok) return name;
      }
      return undefined;
    });

  const queryByOneHopFilter: OrgEntityStore["queryByOneHopFilter"] = ({
    organizationId,
    versionType,
    filter,
    config,
    allowedColumns,
    projectColumns,
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
      // Prefer explicit projection if provided, intersected with allowed
      if (projectColumns && projectColumns.size > 0) {
        for (const col of projectColumns) {
          if (
            (targetVer.display_col && col === targetVer.display_col) ||
            (targetVer.status_col && col === targetVer.status_col)
          )
            continue;
          if (
            !allowedColumns ||
            allowedColumns.size === 0 ||
            allowedColumns.has(col)
          ) {
            extraCols.push(col);
          }
        }
      } else if (allowedColumns && allowedColumns.size > 0) {
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
      const ks = keyset ? safeLiteral(keyset) : undefined;
      const anchor = safeLiteral(filter.anchorUserEntityId);
      const selectCols = [
        `r.${targetCol} as entity_id`,
        displayCol ? `e.${displayCol} as display_name` : undefined,
        statusCol ? `e.${statusCol} as status` : undefined,
        jsonColumnsExpr ? jsonColumnsExpr : undefined,
        "1 as __dummy__",
      ]
        .filter(Boolean)
        .join(",\n                          ");
      const baseWhere = `WHERE r.${anchorCol} = '${anchor ?? ""}' AND r.${META.IS_DELETED} = false`;
      const keysetFrag = ks
        ? order === "asc"
          ? `AND r.${targetCol} > '${ks}'`
          : `AND r.${targetCol} < '${ks}'`
        : "";
      const q = `SELECT ${selectCols}
                       FROM ${relTable} as r
                       INNER JOIN ${entTable} as e
                         ON e.${META.ENTITY_ID} = r.${targetCol} AND e.${META.IS_DELETED} = false
                        ${baseWhere}
                         ${keysetFrag}
                       ORDER BY r.${targetCol} ${order === "asc" ? "ASC" : "DESC"}
                       LIMIT ${limit} OFFSET ${offset}`;
      const rowsRes = yield* Effect.promise(() =>
        orgDb.execute(sql.raw(q)),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org one-hop query failed", cause)),
        ),
      );

      const rowsElapsedMsOneHop = Date.now() - rowsStartedAtOneHop;
      const countRes = yield* Effect.promise(() =>
        orgDb.execute(
          sql`SELECT COUNT(*)::int as cnt
            FROM ${sql.raw(relTable)} as r
            INNER JOIN ${sql.raw(entTable)} as e
              ON e.${sql.raw(META.ENTITY_ID)} = r.${sql.raw(targetCol)} AND e.${sql.raw(META.IS_DELETED)} = false
            WHERE r.${sql.raw(anchorCol)} = ${filter.anchorUserEntityId}
              AND r.${sql.raw(META.IS_DELETED)} = false`,
        ),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org count query failed", cause)),
        ),
      );

      const RowSchema = S.Struct({
        entity_id: S.String,
        display_name: S.optional(S.String),
        status: S.optional(S.String),
        columns: S.optional(S.Record({ key: S.String, value: S.Unknown })),
      });
      const CountRow = S.Struct({ cnt: S.Union(S.Number, S.String) });
      const ids = (yield* decodeRows(
        rowsRes,
        RowSchema,
        "one-hop",
      )) as readonly {
        readonly entity_id: string;
        readonly display_name?: string | undefined;
        readonly status?: string | undefined;
        readonly columns?: Readonly<Record<string, unknown>> | undefined;
      }[];
      const decodedCount = (yield* decodeRows(
        countRes,
        CountRow,
        "one-hop-count",
      )) as readonly { readonly cnt: number | string }[];
      const firstCnt = decodedCount[0]?.cnt;
      const total =
        typeof firstCnt === "string" ? Number(firstCnt) : (firstCnt ?? 0);
      const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);

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
    projectColumns,
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
        const relRow = yield* Effect.tryPromise(() =>
          builderDb
            .select({
              version_id: dbSchema.data_model_entity_relation.version_id,
              a: dbSchema.data_model_entity_relation.entity_type_id_a,
              b: dbSchema.data_model_entity_relation.entity_type_id_b,
            })
            .from(dbSchema.data_model_entity_relation)
            .where(
              eq(dbSchema.data_model_entity_relation.version_id, relVersionId),
            )
            .limit(1),
        ).pipe(
          Effect.catchAll((cause) =>
            Effect.fail(makeDbError("Failed to load relation version", cause)),
          ),
        );
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
      const targetRows = yield* Effect.tryPromise(() =>
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
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            makeDbError("Failed to load target entity version", cause),
          ),
        ),
      );
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
      const rowsRes = yield* Effect.promise(() =>
        orgDb.execute(sql.raw(selectSql)),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org multi-hop query failed", cause)),
        ),
      );
      const rowsElapsedMs2 = Date.now() - rowsStartedAt2;
      const countStartedAt2 = Date.now();
      const countRes = yield* Effect.promise(() =>
        orgDb.execute(sql.raw(countSql)),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org multi-hop count query failed", cause)),
        ),
      );
      const countElapsedMs2 = Date.now() - countStartedAt2;

      const RowSchema = S.Struct({
        entity_id: S.String,
        display_name: S.optional(S.String),
        status: S.optional(S.String),
        columns: S.optional(S.Record({ key: S.String, value: S.Unknown })),
      });
      const CountRow = S.Struct({ cnt: S.Union(S.Number, S.String) });
      const ids = (yield* decodeRows(
        rowsRes,
        RowSchema,
        "multi-hop",
      )) as readonly {
        readonly entity_id: string;
        readonly display_name?: string | undefined;
        readonly status?: string | undefined;
        readonly columns?: Readonly<Record<string, unknown>> | undefined;
      }[];
      const decodedCount = (yield* decodeRows(
        countRes,
        CountRow,
        "multi-hop-count",
      )) as readonly { readonly cnt: number | string }[];
      const firstCnt = decodedCount[0]?.cnt;
      const total =
        typeof firstCnt === "string" ? Number(firstCnt) : (firstCnt ?? 0);
      const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);

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
    projectColumns,
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

      const resolver = yield* OrgDbResolverTag;
      const orgDb = yield* resolver.get(organizationId);
      const entTable = yield* resolveEntityTableName(
        orgDb,
        versionType,
        ver.version_id,
      );
      if (!entTable) {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }
      const resolvedDisplay = ver.display_col
        ? yield* resolveColumnSqlName(orgDb, entTable, ver.display_col)
        : undefined;
      const resolvedStatus = ver.status_col
        ? yield* resolveColumnSqlName(orgDb, entTable, ver.status_col)
        : undefined;
      const displayCol =
        allowedColumns &&
        ver.display_col &&
        !allowedColumns.has(ver.display_col)
          ? undefined
          : resolvedDisplay;
      const statusCol =
        allowedColumns && ver.status_col && !allowedColumns.has(ver.status_col)
          ? undefined
          : resolvedStatus;
      // resolver/orgDb already resolved above

      const limit = page.pageSize;
      const offset = page.pageNumber * page.pageSize;
      const order = config.order ?? "asc";
      const keyset = config.cursorEntityId;
      const extraCols: string[] = [];
      if (projectColumns && projectColumns.size > 0) {
        for (const col of projectColumns) {
          if (
            (ver.display_col && col === ver.display_col) ||
            (ver.status_col && col === ver.status_col)
          )
            continue;
          if (
            !allowedColumns ||
            allowedColumns.size === 0 ||
            allowedColumns.has(col)
          ) {
            const phys = yield* resolveColumnSqlName(orgDb, entTable, col);
            extraCols.push(phys);
          }
        }
      } else if (allowedColumns && allowedColumns.size > 0) {
        for (const col of allowedColumns) {
          if (
            (ver.display_col && col === ver.display_col) ||
            (ver.status_col && col === ver.status_col)
          )
            continue;
          const phys = yield* resolveColumnSqlName(orgDb, entTable, col);
          extraCols.push(phys);
        }
      }
      const jsonColumnsExpr =
        extraCols.length > 0
          ? `jsonb_build_object(${extraCols
              .map((c) => `'${c}', e.${c}`)
              .join(", ")}) as columns,`
          : "";
      const ks3 = keyset ? safeLiteral(keyset) : undefined;
      const keysetFilter = ks3
        ? order === "asc"
          ? `AND e.${META.ENTITY_ID} > '${ks3}'`
          : `AND e.${META.ENTITY_ID} < '${ks3}'`
        : "";
      const rowsRes = yield* Effect.promise(() => {
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
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org all-of-type query failed", cause)),
        ),
      );
      // omitted timing capture for allowAll to reduce overhead

      const countRes = yield* Effect.promise(() =>
        orgDb.execute(
          sql`SELECT COUNT(*)::int as cnt
                FROM ${sql.raw(entTable)} as e
                WHERE e.${sql.raw(META.IS_DELETED)} = false`,
        ),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org all-of-type count query failed", cause)),
        ),
      );

      const RowSchema2 = S.Struct({
        entity_id: S.String,
        display_name: S.optional(S.String),
        status: S.optional(S.String),
        columns: S.optional(S.Record({ key: S.String, value: S.Unknown })),
      });
      const CountRow2 = S.Struct({ cnt: S.Union(S.Number, S.String) });
      const ids = (yield* decodeRows(
        rowsRes,
        RowSchema2,
        "all-of-type",
      )) as readonly {
        readonly entity_id: string;
        readonly display_name?: string | undefined;
        readonly status?: string | undefined;
        readonly columns?: Readonly<Record<string, unknown>> | undefined;
      }[];
      const decodedCount2 = (yield* decodeRows(
        countRes,
        CountRow2,
        "all-of-type-count",
      )) as readonly { readonly cnt: number | string }[];
      const firstCnt2 = decodedCount2[0]?.cnt;
      const total =
        typeof firstCnt2 === "string" ? Number(firstCnt2) : (firstCnt2 ?? 0);
      const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);
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

  const findByColumnEquals: OrgEntityStore["findByColumnEquals"] = ({
    organizationId,
    versionType,
    targetEntityTypeId,
    columnId,
    value,
  }) =>
    Effect.gen(function* () {
      const builderDb: BuilderDatabase = yield* BuilderDbTag;
      const targetEntityTypeVersionId = yield* resolveEntityTypeVersionId(
        builderDb,
        organizationId,
        versionType,
        targetEntityTypeId,
      );
      if (!targetEntityTypeVersionId) return undefined;

      const resolver = yield* OrgDbResolverTag;
      const orgDb = yield* resolver.get(organizationId);
      const entTable = yield* resolveEntityTableName(
        orgDb,
        versionType,
        targetEntityTypeVersionId,
      );
      if (!entTable) return undefined;
      yield* Effect.logDebug(`findByColumnEquals entity table=${entTable}`);
      const col = yield* resolveColumnSqlName(orgDb, entTable, columnId);
      yield* Effect.logDebug(`findByColumnEquals column=${col}`);
      const safeVal = safePhoneLiteral(value);
      if (!safeVal) return undefined;
      const candidates: string[] = [];
      candidates.push(safeVal);
      if (!safeVal.startsWith("+") && safeLiteral(`+${safeVal}`)) {
        candidates.push(`+${safeVal}`);
      }
      const inList = candidates.map((v) => `'${v}'`).join(", ");
      const q = `SELECT e.${META.ENTITY_ID} as entity_id
                 FROM ${entTable} as e
                 WHERE e.${col} IN (${inList}) AND e.${META.IS_DELETED} = false
                 LIMIT 1`;
      const res = yield* Effect.promise(() => orgDb.execute(sql.raw(q))).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org findByColumnEquals failed", cause)),
        ),
      );
      const RowSchema = S.Struct({ entity_id: S.String });
      const decoded = (yield* decodeRows(
        res,
        RowSchema,
        "find-by-column",
      )) as readonly { readonly entity_id: string }[];
      return decoded[0]?.entity_id;
    }).pipe(
      Effect.withSpan("OrgEntityStore.findByColumnEquals", {
        attributes: { orgId: organizationId, versionType, targetEntityTypeId },
      }),
    );

  const findEntities: OrgEntityStore["findEntities"] = ({
    organizationId,
    versionType,
    targetEntityTypeId,
    filters,
    config,
    allowedColumns,
    projectColumns,
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
      if (!targetEntityTypeVersionId) {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }

      const resolver = yield* OrgDbResolverTag;
      const orgDb = yield* resolver.get(organizationId);
      const entTable = yield* resolveEntityTableName(
        orgDb,
        versionType,
        targetEntityTypeVersionId,
      );
      if (!entTable) {
        return {
          entities: [],
          totalNumberEntities: 0,
          totalNumberPages: 0,
        } as const;
      }

      // Resolve display/status
      const verRows = yield* Effect.tryPromise(() =>
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
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            makeDbError("Failed to load target entity type version", cause),
          ),
        ),
      );
      const ver = verRows[0];
      const displayCol =
        ver?.display_col &&
        (!allowedColumns ||
          allowedColumns.size === 0 ||
          allowedColumns.has(ver.display_col))
          ? yield* resolveColumnSqlName(orgDb, entTable, ver.display_col)
          : undefined;
      const statusCol =
        ver?.status_col &&
        (!allowedColumns ||
          allowedColumns.size === 0 ||
          allowedColumns.has(ver.status_col))
          ? yield* resolveColumnSqlName(orgDb, entTable, ver.status_col)
          : undefined;

      // Resolve projection columns
      const extraCols: string[] = [];
      if (projectColumns && projectColumns.size > 0) {
        for (const col of projectColumns) {
          if (
            (ver?.display_col && col === ver.display_col) ||
            (ver?.status_col && col === ver.status_col)
          )
            continue;
          if (
            !allowedColumns ||
            allowedColumns.size === 0 ||
            allowedColumns.has(col)
          ) {
            const phys = yield* resolveColumnSqlName(orgDb, entTable, col);
            extraCols.push(phys);
          }
        }
      } else if (allowedColumns && allowedColumns.size > 0) {
        for (const col of allowedColumns) {
          if (
            (ver?.display_col && col === ver.display_col) ||
            (ver?.status_col && col === ver.status_col)
          )
            continue;
          const phys = yield* resolveColumnSqlName(orgDb, entTable, col);
          extraCols.push(phys);
        }
      }
      const jsonColumnsExpr =
        extraCols.length > 0
          ? sql.raw(
              `jsonb_build_object(${extraCols
                .map((c) => `'${c}', e.${c}`)
                .join(", ")}) as columns`,
            )
          : undefined;

      // Build WHERE conditions
      const conds: Array<ReturnType<typeof sql>> = [];
      for (const f of filters) {
        const phys = yield* resolveColumnSqlName(orgDb, entTable, f.columnId);
        if (f.op === "eq") {
          conds.push(sql`${sql.raw(`e.${phys}`)} = ${f.value}`);
        } else {
          const pattern = `%${f.value}%`;
          conds.push(sql`${sql.raw(`e.${phys}`)} ILIKE ${pattern}`);
        }
      }

      const limit = page.pageSize;
      const offset = page.pageNumber * page.pageSize;
      const order = config.order ?? "asc";
      const keyset = config.cursorEntityId;
      const ksFrag = keyset
        ? order === "asc"
          ? sql`AND e.${sql.raw(META.ENTITY_ID)} > ${keyset}`
          : sql`AND e.${sql.raw(META.ENTITY_ID)} < ${keyset}`
        : sql``;

      // Build SELECT
      const selectList = [
        sql`e.${sql.raw(META.ENTITY_ID)} as entity_id`,
        displayCol ? sql`e.${sql.raw(displayCol)} as display_name` : undefined,
        statusCol ? sql`e.${sql.raw(statusCol)} as status` : undefined,
        jsonColumnsExpr,
        sql`1 as __dummy__`,
      ].filter(Boolean) as Array<ReturnType<typeof sql>>;

      const rowsRes = yield* Effect.promise(() =>
        orgDb.execute(
          sql`SELECT ${sql.join(selectList, sql`, `)}
                FROM ${sql.raw(entTable)} as e
               WHERE e.${sql.raw(META.IS_DELETED)} = false
                 ${conds.length > 0 ? sql`AND ${sql.join(conds, sql` AND `)}` : sql``}
                 ${ksFrag}
               ORDER BY e.${sql.raw(META.ENTITY_ID)} ${sql.raw(order === "asc" ? "ASC" : "DESC")}
               LIMIT ${limit} OFFSET ${offset}`,
        ),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org filtered query failed", cause)),
        ),
      );

      const countRes = yield* Effect.promise(() =>
        orgDb.execute(
          sql`SELECT COUNT(*)::int as cnt
                FROM ${sql.raw(entTable)} as e
               WHERE e.${sql.raw(META.IS_DELETED)} = false
                 ${conds.length > 0 ? sql`AND ${sql.join(conds, sql` AND `)}` : sql``}`,
        ),
      ).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(makeDbError("Org filtered count failed", cause)),
        ),
      );

      const RowSchema = S.Struct({
        entity_id: S.String,
        display_name: S.optional(S.String),
        status: S.optional(S.String),
        columns: S.optional(S.Record({ key: S.String, value: S.Unknown })),
      });
      const CountRow = S.Struct({ cnt: S.Union(S.Number, S.String) });
      const ids = (yield* decodeRows(
        rowsRes,
        RowSchema,
        "filtered",
      )) as readonly {
        readonly entity_id: string;
        readonly display_name?: string | undefined;
        readonly status?: string | undefined;
        readonly columns?: Readonly<Record<string, unknown>> | undefined;
      }[];
      const decodedCount = (yield* decodeRows(
        countRes,
        CountRow,
        "filtered-count",
      )) as readonly { readonly cnt: number | string }[];
      const firstCnt = decodedCount[0]?.cnt;
      const total =
        typeof firstCnt === "string" ? Number(firstCnt) : (firstCnt ?? 0);
      const totalPages = total === 0 ? 0 : Math.ceil(total / page.pageSize);

      yield* Effect.log(
        `OrgEntityStore.findEntities org=${organizationId} entTable=${entTable} total=${total}`,
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
      Effect.withSpan("OrgEntityStore.findEntities", {
        attributes: { orgId: organizationId, versionType, targetEntityTypeId },
      }),
    );

  return {
    queryByOneHopFilter,
    queryByMultiHopFilter,
    queryAllOfType,
    findByColumnEquals,
    findEntities,
  };
};

export const makeOrgEntityStoreLayer: Layer.Layer<OrgEntityStoreTag> =
  Layer.effect(OrgEntityStoreTag, Effect.succeed(makeOrgEntityStore()));
