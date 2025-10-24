import type { AxFunction } from "@ax-llm/ax";
import { Runtime, Effect } from "effect";
import * as S from "effect/Schema";
import { EntityTypeCatalogTag } from "../../services/EntityTypeCatalog";
import { OrgEntityStoreTag } from "../../services/OrgEntityStore";
import { PermissionEngineTag } from "../../permissions/PermissionEngine";
import { BuilderDbTag } from "../../db/tags";
import { dbSchema } from "../../db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { ColumnIdSchema, EntityTypeIdSchema, OrganizationIdSchema } from "../../db/ids";
import { VersionTypeSchema } from "../../domain/version";
import type { AppEnv } from "../../env";

export interface FindEntitiesToolDeps {
  readonly runtime: Runtime.Runtime<any>;
  readonly env: AppEnv;
  readonly startTypingHeartbeat: () => () => void;
}

export const makeFindEntitiesTool = (deps: FindEntitiesToolDeps): AxFunction => ({
  name: "findEntities",
  description:
    "Find entities by column filters with minimal fields and optional selected columns.",
  parameters: {
    type: "object",
    properties: {
      entityTypeId: {
        type: "string",
        description: "Target entity type id",
      },
      filters: {
        type: "array",
        description: "List of column filters (eq/ilike)",
        items: {
          type: "object",
          properties: {
            columnId: {
              type: "string",
              description: "Column id to filter",
            },
            op: {
              type: "string",
              enum: ["eq", "ilike"],
              description: "Operator",
            },
            value: { type: "string", description: "Filter value" },
          },
          required: ["columnId", "op", "value"],
        },
      },
      limit: {
        type: "number",
        description: "Max rows to return (<=50)",
      },
      cursorEntityId: {
        type: "string",
        description: "Keyset cursor entity id",
      },
      selectColumns: {
        type: "array",
        description: "Projected extra columns",
        items: { type: "string" },
      },
    },
    required: ["entityTypeId", "filters"],
  },
  func: async (raw) => {
    const stopTyping = deps.startTypingHeartbeat();
    const schema = S.Struct({
      entityTypeId: EntityTypeIdSchema,
      filters: S.Array(
        S.Struct({
          columnId: ColumnIdSchema,
          op: S.Union(S.Literal("eq"), S.Literal("ilike")),
          value: S.String,
        }),
      ),
      limit: S.optional(S.Number),
      cursorEntityId: S.optional(S.String),
      selectColumns: S.optional(S.Array(S.String)),
    });
    const params = S.decodeUnknownSync(schema)(raw);
    const planOk = await Runtime.runPromise(
      deps.runtime,
      Effect.flatMap(PermissionEngineTag, (e) =>
        e
          .planEntityRead({
            organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
              deps.env.DEMO_ORG_ID,
            ),
            versionType: S.decodeUnknownSync(VersionTypeSchema)("prod"),
            entityTypeId: params.entityTypeId,
            subject: { type: "read" },
          })
          .pipe(Effect.map((p) => ({ _tag: "ok" as const, plan: p })))
          .pipe(Effect.catchAll(() => Effect.succeed({ _tag: "err" as const }))),
      ),
    );
    if (planOk._tag === "err") return { total: 0, entities: [] } as const;
    const plan = planOk.plan;

    // Compute allowed columns for display/status gating
    const allowedSet = await Runtime.runPromise(
      deps.runtime,
      Effect.gen(function* () {
        if (plan.mode === "allowAll" || plan.fieldGroupPolicy.anyStateGranted) {
          return new Set<typeof ColumnIdSchema.Type>();
        }
        const types = yield* Effect.flatMap(EntityTypeCatalogTag, (c) =>
          c
            .listEntityTypes({
              organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                deps.env.DEMO_ORG_ID,
              ),
              versionType: "prod",
            })
            .pipe(Effect.catchAll(() => Effect.succeed([]))),
        );
        const t = types.find((x) => x.id === params.entityTypeId);
        if (!t) return new Set<typeof ColumnIdSchema.Type>();
        const db = yield* BuilderDbTag;
        const rows = (yield* Effect.tryPromise(() =>
          db
            .select({ id: dbSchema.field_group.id, fields: dbSchema.field_group.fields })
            .from(dbSchema.field_group)
            .where(
              and(
                inArray(
                  dbSchema.field_group.id,
                  Array.from(plan.fieldGroupPolicy.fieldGroupsGranted),
                ),
                eq(dbSchema.field_group.entity_type_version_id, t.versionId),
              ),
            ),
        ).pipe(Effect.catchAll(() => Effect.succeed([])))) as Array<{
          id: string;
          fields: unknown;
        }>;
        const res = new Set<typeof ColumnIdSchema.Type>();
        const visit = (node: unknown): void => {
          if (Array.isArray(node)) return node.forEach(visit);
          if (node && typeof node === "object") {
            for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
              if ((k === "column_id" || k === "columnId") && typeof v === "string") {
                try {
                  res.add(S.decodeUnknownSync(ColumnIdSchema)(v));
                } catch {}
              } else visit(v);
            }
          }
        };
        for (const r of rows) visit(r.fields);
        return res;
      }),
    );

    const proj = new Set<typeof ColumnIdSchema.Type>();
    const sel = params.selectColumns?.slice(0, 5) ?? [];
    for (const v of sel) {
      try {
        const c = S.decodeUnknownSync(ColumnIdSchema)(v);
        if (allowedSet.size === 0 || allowedSet.has(c)) proj.add(c);
      } catch {}
    }
    const limit = Math.min(Math.max(params.limit ?? 5, 1), 50);
    const result = await Runtime.runPromise(
      deps.runtime,
      Effect.flatMap(OrgEntityStoreTag, (s) =>
        s
          .findEntities({
            organizationId: S.decodeUnknownSync(OrganizationIdSchema)(deps.env.DEMO_ORG_ID),
            versionType: S.decodeUnknownSync(VersionTypeSchema)("prod"),
            targetEntityTypeId: params.entityTypeId,
            filters: params.filters,
            config: { countsOnly: false, cursorEntityId: params.cursorEntityId, order: "asc" },
            allowedColumns: allowedSet,
            projectColumns: proj.size > 0 ? proj : undefined,
            page: { pageNumber: 0, pageSize: limit },
          })
          .pipe(
            Effect.catchAll(() =>
              Effect.succeed({ entities: [], totalNumberEntities: 0, totalNumberPages: 0 }),
            ),
          ),
      ),
    );
    const nextCursorEntityId = result.entities.length
      ? result.entities[result.entities.length - 1]!.entityId
      : undefined;
    const out = {
      total: result.totalNumberEntities,
      entities: result.entities,
      nextCursorEntityId,
    } as const;
    stopTyping();
    return out;
  },
});

