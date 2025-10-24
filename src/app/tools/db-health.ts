import { Effect, Layer } from "effect";
import * as S from "effect/Schema";
import { AppEnvTag, makeEnvLayer, makeDbConfigFromEnvLayer } from "../../env";
import { BuilderDbTag, OrgDbResolverTag } from "../../db/tags";
import { makeBuilderDbLayer, makeOrgDbResolverLayer } from "../../db/connect";
import { dbSchema } from "../../db/schema";
import { and, desc, eq } from "drizzle-orm";
import { OrganizationIdSchema } from "../../db/ids";
import { sql } from "drizzle-orm";

const program = Effect.gen(function* () {
  const env = yield* AppEnvTag;
  const builder = yield* BuilderDbTag;

  // Probe builder DB presence
  try {
    const wsRows = yield* Effect.promise(() =>
      builder
        .select({
          id: dbSchema.workspace_version.id,
          version_id: dbSchema.workspace_version.version_id,
          major: dbSchema.workspace_version.version_major,
          minor: dbSchema.workspace_version.version_minor,
          patch: dbSchema.workspace_version.version_patch,
        })
        .from(dbSchema.workspace_version)
        .orderBy(
          desc(dbSchema.workspace_version.version_major),
          desc(dbSchema.workspace_version.version_minor),
          desc(dbSchema.workspace_version.version_patch),
        )
        .limit(1),
    );
    console.log(
      `builder.workspace_version ok: latest=${wsRows[0]?.version_id ?? "<none>"}`,
    );
  } catch (e) {
    console.error("builder.workspace_version probe failed:", e);
    return;
  }

  // List mapped entity and relation tables for DEMO_ORG_ID + prod
  const orgId = env.DEMO_ORG_ID;
  if (!orgId) {
    console.error("DEMO_ORG_ID missing in env");
    return;
  }
  const vref = dbSchema.version_refs;
  const et = dbSchema.data_model_entity_type;
  const etv = dbSchema.data_model_entity_type_version;

  const entityRefs = yield* Effect.promise(() =>
    builder
      .select({ version_id: vref.version_id })
      .from(vref)
      .innerJoin(etv, eq(etv.version_id, vref.version_id))
      .innerJoin(et, eq(et.id, etv.id))
      .where(
        and(
          eq(vref.organization_id, S.decodeUnknownSync(OrganizationIdSchema)(orgId)),
          eq(vref.table_name, "builder.data_model_entity_type"),
          eq(vref.version_type, "prod"),
        ),
      )
      .limit(1000),
  );
  console.log(
    `version_refs entities for org=${orgId} prod: ${entityRefs.length}`,
  );

  const relRefs = yield* Effect.promise(() =>
    builder
      .select({ version_id: vref.version_id })
      .from(vref)
      .where(
        and(
          eq(vref.organization_id, S.decodeUnknownSync(OrganizationIdSchema)(orgId)),
          eq(vref.table_name, "builder.data_model_entity_relation"),
          eq(vref.version_type, "prod"),
        ),
      )
      .limit(1000),
  );
  console.log(
    `version_refs relations for org=${orgId} prod: ${relRefs.length}`,
  );

  // Probe Org DB connection if possible
  try {
    const resolver = yield* OrgDbResolverTag;
    const orgDb = yield* resolver.get(
      S.decodeUnknownSync(OrganizationIdSchema)(orgId),
    );
    console.log("org db resolved ok");
    if (entityRefs.length > 0) {
      // check that first entity table exists by counting rows (best-effort)
      const id = entityRefs[0]!.version_id;
      const tableName = `entity_prod_${id.replace(/-/g, "_").toLowerCase()}`;
      const res = yield* Effect.promise(() =>
        orgDb.execute(
          sql.raw(`SELECT COUNT(*)::int as cnt FROM ${tableName} LIMIT 1`),
        ),
      );
      const CountRow = S.Struct({ cnt: S.Union(S.Number, S.String) });
      const rows = (() => {
        try {
          const Obj = S.Struct({ rows: S.Array(CountRow) });
          return S.decodeUnknownSync(Obj)(res).rows;
        } catch {
          const Arr = S.Array(CountRow);
          return S.decodeUnknownSync(Arr)(res);
        }
      })();
      const cnt = rows[0]?.cnt;
      console.log(`${tableName} exists: count=${typeof cnt === "string" ? Number(cnt) : (cnt ?? 0)}`);
    }
  } catch (e) {
    console.error("org db probe failed:", e);
  }
});

const layer = (() => {
  const envL = makeEnvLayer;
  const dbConfigL = Layer.provide(envL)(makeDbConfigFromEnvLayer);
  const builderL = Layer.provide(Layer.mergeAll(envL, dbConfigL))(
    makeBuilderDbLayer,
  );
  const orgResolverL = Layer.provide(Layer.mergeAll(builderL, envL))(
    makeOrgDbResolverLayer,
  );
  return Layer.mergeAll(envL, dbConfigL, builderL, orgResolverL);
})();

Effect.runPromise(program.pipe(Effect.provide(layer))).catch((e) => {
  console.error("db:health error", e);
  process.exit(1);
});
