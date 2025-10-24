import { Context, Effect, Layer } from "effect";
import { dbSchema } from "../db/schema";
import {
  BuilderDbTag,
  type BuilderDatabase,
  makeDbError,
  type DbError,
} from "../db/tags";
import { and, desc, eq } from "drizzle-orm";
import type {
  OrganizationId,
  EntityTypeId,
  EntityTypeVersionId,
} from "../db/ids";

export interface CatalogEntityType {
  readonly id: EntityTypeId;
  readonly versionId: EntityTypeVersionId;
  readonly name: string;
  readonly pluralName: string;
  readonly description?: string;
}

export interface CatalogColumn {
  readonly id: string;
  readonly name: string;
}

export interface EntityTypeCatalog {
  readonly listEntityTypes: (args: {
    organizationId: OrganizationId;
    versionType: "prod" | "dev";
  }) => Effect.Effect<ReadonlyArray<CatalogEntityType>, DbError, BuilderDbTag>;

  readonly listColumns: (args: {
    organizationId: OrganizationId;
    versionType: "prod" | "dev";
    entityTypeId: EntityTypeId;
  }) => Effect.Effect<ReadonlyArray<CatalogColumn>, DbError, BuilderDbTag>;
}

export class EntityTypeCatalogTag extends Context.Tag(
  "effect-ax/EntityTypeCatalog",
)<EntityTypeCatalogTag, EntityTypeCatalog>() {}

export const makeEntityTypeCatalog = (): EntityTypeCatalog => {
  const listEntityTypes: EntityTypeCatalog["listEntityTypes"] = ({
    organizationId,
    versionType,
  }) =>
    Effect.gen(function* () {
      const db: BuilderDatabase = yield* BuilderDbTag;
      // Get latest workspace version for org + versionType
      const w = dbSchema.workspace_version;
      const vr = dbSchema.version_refs;
      const wvev = dbSchema.workspace_version_entity_type_version;
      const et = dbSchema.data_model_entity_type;
      const etv = dbSchema.data_model_entity_type_version;

      const rows = yield* Effect.promise(() =>
        db
          .select({
            entity_type_id: et.id,
            entity_type_version_id: etv.version_id,
            name: et.name,
            plural_name: et.plural_name,
            description: et.description,
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
          .innerJoin(et, eq(et.id, etv.id))
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1000),
      );

      // The above returns rows from latest WS first; we can keep the first seen per entity_type_id
      const seen = new Set<string>();
      const result: CatalogEntityType[] = [];
      for (const r of rows) {
        const key = r.entity_type_id as unknown as string;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({
          id: r.entity_type_id as EntityTypeId,
          versionId: r.entity_type_version_id as EntityTypeVersionId,
          name: r.name,
          pluralName: r.plural_name,
          description: r.description ?? undefined,
        });
      }
      return result;
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(makeDbError("listEntityTypes failed", e)),
      ),
    );

  const listColumns: EntityTypeCatalog["listColumns"] = ({
    organizationId,
    versionType,
    entityTypeId,
  }) =>
    Effect.gen(function* () {
      const db: BuilderDatabase = yield* BuilderDbTag;
      // Resolve latest version for this entity type within workspace mapping
      const w = dbSchema.workspace_version;
      const vr = dbSchema.version_refs;
      const wvev = dbSchema.workspace_version_entity_type_version;
      const etv = dbSchema.data_model_entity_type_version;
      const etcol = dbSchema.data_model_entity_type_column;

      const versionRows = yield* Effect.promise(() =>
        db
          .select({ entity_type_version_id: wvev.entity_type_version_id })
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
          .limit(1),
      );
      const verId = versionRows[0]?.entity_type_version_id;
      if (!verId) return [] as const;

      const cols = yield* Effect.promise(() =>
        db
          .select({ id: etcol.id, name: etcol.name })
          .from(etcol)
          .where(eq(etcol.entity_type_version_id, verId))
          .limit(1000),
      );
      return cols.map((c) => ({ id: c.id, name: c.name }));
    }).pipe(
      Effect.catchAll((e) => Effect.fail(makeDbError("listColumns failed", e))),
    );

  return { listEntityTypes, listColumns } satisfies EntityTypeCatalog;
};

export const makeEntityTypeCatalogLayer: Layer.Layer<EntityTypeCatalogTag> =
  Layer.effect(EntityTypeCatalogTag, Effect.succeed(makeEntityTypeCatalog()));
