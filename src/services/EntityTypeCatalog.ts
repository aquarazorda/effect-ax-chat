import { Context, Effect, Layer } from "effect";
import { dbSchema } from "../db/schema";
import {
  BuilderDbTag,
  type BuilderDatabase,
  makeDbError,
  type DbError,
} from "../db/tags";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type {
  OrganizationId,
  EntityTypeId,
  EntityTypeVersionId,
} from "../db/ids";
import { EntityTypeIdSchema, EntityTypeVersionIdSchema } from "../db/ids";
import * as S from "effect/Schema";

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
      // Get entity types whose versions are mapped for this org/versionType
      const w = dbSchema.workspace_version;
      const vr = dbSchema.version_refs;
      const wvev = dbSchema.workspace_version_entity_type_version;
      const et = dbSchema.data_model_entity_type;
      const etv = dbSchema.data_model_entity_type_version;
      // Org-mapped entity types (via version_refs)
      const mappedRows = yield* Effect.promise(() =>
        db
          .select({
            entity_type_id: et.id,
            entity_type_version_id: etv.version_id,
            name: et.name,
            plural_name: et.plural_name,
            description: et.description,
          })
          .from(w)
          .innerJoin(wvev, eq(wvev.workspace_version_id, w.version_id))
          .innerJoin(etv, eq(etv.version_id, wvev.entity_type_version_id))
          .innerJoin(et, eq(et.id, etv.id))
          // Only include entity type versions mapped for this org
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
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1000),
      );

      // Also include system entity types (e.g., People/Company/Meetings) from the latest workspace,
      // even when not explicitly mapped for the org via version_refs.
      // System entity types (People/Company/Meetings) from latest workspaces (not requiring version_refs)
      const systemRows = yield* Effect.promise(() =>
        db
          .select({
            entity_type_id: et.id,
            entity_type_version_id: etv.version_id,
            name: et.name,
            plural_name: et.plural_name,
            description: et.description,
          })
          .from(w)
          .innerJoin(wvev, eq(wvev.workspace_version_id, w.version_id))
          .innerJoin(etv, eq(etv.version_id, wvev.entity_type_version_id))
          .innerJoin(et, eq(et.id, etv.id))
          .where(
            sql`${etv.user_entity_type_version} is not null or ${etv.company_entity_type_version} is not null or ${etv.meetings_entity_type_version} is not null`,
          )
          .orderBy(
            desc(w.version_major),
            desc(w.version_minor),
            desc(w.version_patch),
          )
          .limit(1000),
      );

      // Deduplicate preferring system rows first (so system types appear at the top)
      const seen = new Set<string>();
      const result: CatalogEntityType[] = [];
      const pushRow = (r: {
        entity_type_id: unknown;
        entity_type_version_id: unknown;
        name: string;
        plural_name: string;
        description: string | null;
      }) => {
        const key = S.decodeUnknownSync(S.String)(r.entity_type_id);
        if (seen.has(key)) return;
        seen.add(key);
        result.push({
          id: S.decodeUnknownSync(EntityTypeIdSchema)(r.entity_type_id),
          versionId: S.decodeUnknownSync(EntityTypeVersionIdSchema)(
            r.entity_type_version_id,
          ),
          name: r.name,
          pluralName: r.plural_name,
          description: r.description ?? undefined,
        });
      };
      for (const r of systemRows) pushRow(r);
      for (const r of mappedRows) pushRow(r);
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

      let versionRows = yield* Effect.promise(() =>
        db
          .select({ entity_type_version_id: wvev.entity_type_version_id })
          .from(w)
          .innerJoin(wvev, eq(wvev.workspace_version_id, w.version_id))
          .innerJoin(etv, eq(etv.version_id, wvev.entity_type_version_id))
          // Only versions of the requested entity type that are mapped for this org
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
          .limit(1),
      );
      let verId = versionRows[0]?.entity_type_version_id;
      if (!verId) {
        // Fallback to latest workspace system entity type version
        versionRows = yield* Effect.promise(() =>
          db
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
            .limit(1),
        );
        verId = versionRows[0]?.entity_type_version_id;
      }
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
