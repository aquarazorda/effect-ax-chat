import { Context, Effect, Layer } from "effect";
import { dbSchema } from "../db/schema";
import {
  BuilderDbTag,
  type BuilderDatabase,
  makeDbError,
  type DbError,
} from "../db/tags";
import { and, desc, eq, or, sql, inArray } from "drizzle-orm";
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
  readonly columns?: ReadonlyArray<CatalogColumn>;
}

export interface CatalogColumn {
  readonly id: string;
  readonly name: string;
}

export interface EntityTypeCatalog {
  readonly listEntityTypes: (args: {
    organizationId: OrganizationId;
    versionType: "prod" | "dev";
    columnsFilter?: { nameContains?: ReadonlyArray<string>; max?: number };
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
    columnsFilter,
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

      // Deduplicate by human name (name + plural), preferring later pushes.
      // We push system rows first (sorted by workspace version desc), then mapped rows,
      // so the latest for each semantic name wins and only appears once.
      const seenByName = new Set<string>();
      const base: CatalogEntityType[] = [];
      const pushRow = (r: {
        entity_type_id: unknown;
        entity_type_version_id: unknown;
        name: string;
        plural_name: string;
        description: string | null;
      }) => {
        const nameKey = `${r.name.toLowerCase()}|${r.plural_name.toLowerCase()}`;
        if (seenByName.has(nameKey)) return;
        seenByName.add(nameKey);
        base.push({
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
      const baseRows: CatalogEntityType[] = base;

      // Optionally attach columns for each type in a single batch query
      const versionIds = baseRows.map((r) => r.versionId);
      if (versionIds.length > 0) {
        const etcol = dbSchema.data_model_entity_type_column;
        const colRows = yield* Effect.promise(() =>
          db
            .select({
              id: etcol.id,
              name: etcol.name,
              entity_type_version_id: etcol.entity_type_version_id,
            })
            .from(etcol)
            .where(inArray(etcol.entity_type_version_id, versionIds as any)),
        ).pipe(
          Effect.catchAll((e) =>
            Effect.fail(makeDbError("listEntityTypes column fetch failed", e)),
          ),
        );
        const want = (n: string): boolean => {
          if (
            !columnsFilter?.nameContains ||
            columnsFilter.nameContains.length === 0
          )
            return true;
          const lower = n.toLowerCase();
          for (const frag of columnsFilter.nameContains) {
            if (lower.includes(frag.toLowerCase())) return true;
          }
          return false;
        };
        const byVersionAll = new Map<string, CatalogColumn[]>();
        const byVersionFiltered = new Map<string, CatalogColumn[]>();
        for (const c of colRows) {
          const key = S.decodeUnknownSync(EntityTypeVersionIdSchema)(
            c.entity_type_version_id as unknown as string,
          );
          const recAll = byVersionAll.get(key) ?? [];
          recAll.push({ id: c.id, name: c.name });
          byVersionAll.set(key, recAll);
          if (want(c.name)) {
            const recF = byVersionFiltered.get(key) ?? [];
            recF.push({ id: c.id, name: c.name });
            byVersionFiltered.set(key, recF);
          }
        }
        const out: CatalogEntityType[] = [];
        for (const r of baseRows) {
          const filtered = byVersionFiltered.get(r.versionId) ?? [];
          const all = byVersionAll.get(r.versionId) ?? [];
          const picked = filtered.length > 0 ? filtered : all;
          const cap = columnsFilter?.max ?? picked.length;
          const capped = picked.slice(
            0,
            Math.max(0, Math.min(cap, picked.length)),
          );
          out.push({ ...r, columns: capped });
        }
        return out;
      }
      return baseRows;
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
