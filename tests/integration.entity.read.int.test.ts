import { expect, test } from "bun:test";
import { Effect, Layer } from "effect";
import { makeEnvLayer, makeDbConfigFromEnvLayer } from "../src/env";
import { makeBuilderDbLayer, makeOrgDbResolverLayer } from "../src/db/connect";
import {
  makeEntityTypeCatalogLayer,
  EntityTypeCatalogTag,
} from "../src/services/EntityTypeCatalog";
import type {
  CatalogEntityType,
  CatalogColumn,
} from "../src/services/EntityTypeCatalog";
import {
  makeOrgEntityStoreLayer,
  OrgEntityStoreTag,
} from "../src/services/OrgEntityStore";
import * as S from "effect/Schema";
import { VersionTypeSchema } from "../src/domain/version";
import {
  OrganizationIdSchema,
  EntityTypeIdSchema,
  ColumnIdSchema,
} from "../src/db/ids";

// Integration tests that run only when LOCAL_DATABASE_URL + DEMO_ORG_ID are provided.
// These exercise the same service paths Max uses to discover entity types and
// resolve a People entity by phone.

const hasEnv = Boolean(Bun.env.LOCAL_DATABASE_URL && Bun.env.DEMO_ORG_ID);

const makeTestLayer = () => {
  const envL = makeEnvLayer;
  const cfgL = Layer.provide(envL)(makeDbConfigFromEnvLayer);
  const builderL = Layer.provide(Layer.mergeAll(envL, cfgL))(
    makeBuilderDbLayer,
  );
  const resolverL = Layer.provide(Layer.mergeAll(builderL, envL))(
    makeOrgDbResolverLayer,
  );
  const catalogL = Layer.provide(builderL)(makeEntityTypeCatalogLayer);
  const storeL = Layer.provide(Layer.mergeAll(resolverL, builderL))(
    makeOrgEntityStoreLayer,
  );
  return Layer.mergeAll(envL, cfgL, builderL, resolverL, catalogL, storeL);
};

const withLayer = <A, E, R>(eff: Effect.Effect<A, E, R>) =>
  // In tests, relax env typing and provide the composed live layer
  (eff as any).pipe(Effect.provide(makeTestLayer() as any));

async function requireEnv() {
  if (!hasEnv) {
    throw new Error(
      "Set LOCAL_DATABASE_URL and DEMO_ORG_ID in your environment to run integration tests.",
    );
  }
}

const vtProd = S.decodeUnknownSync(VersionTypeSchema)("prod");

async function listTypes(): Promise<ReadonlyArray<CatalogEntityType>> {
  await requireEnv();
  const orgId = S.decodeUnknownSync(OrganizationIdSchema)(Bun.env.DEMO_ORG_ID);
  const rows = (await Effect.runPromise(
    withLayer(
      Effect.flatMap(EntityTypeCatalogTag, (c) =>
        c.listEntityTypes({ organizationId: orgId, versionType: vtProd }),
      ),
    ),
  )) as ReadonlyArray<CatalogEntityType>;

  return rows;
}

async function listCols(
  entityTypeId: CatalogEntityType["id"],
): Promise<ReadonlyArray<CatalogColumn>> {
  await requireEnv();
  const orgId = S.decodeUnknownSync(OrganizationIdSchema)(Bun.env.DEMO_ORG_ID);
  const cols = (await Effect.runPromise(
    withLayer(
      Effect.flatMap(EntityTypeCatalogTag, (c) =>
        c.listColumns({
          organizationId: orgId,
          versionType: vtProd,
          entityTypeId,
        }),
      ),
    ),
  )) as ReadonlyArray<CatalogColumn>;
  return cols;
}

function scoreName(n: string): number {
  const s = n.toLowerCase();
  if (s.includes("people")) return 5;
  if (s.includes("person")) return 4;
  if (s.includes("contact")) return 3;
  if (s.includes("user")) return 1;
  return 0;
}

async function pickPeopleType(
  types: ReadonlyArray<CatalogEntityType>,
): Promise<CatalogEntityType> {
  const typeOverride = Bun.env.DEMO_PEOPLE_ENTITY_TYPE_ID;
  if (typeOverride) {
    const id = S.decodeUnknownSync(EntityTypeIdSchema)(typeOverride);
    const t = types.find((x) => x.id === id);
    if (!t)
      throw new Error(
        `DEMO_PEOPLE_ENTITY_TYPE_ID=${typeOverride} not found among listed types`,
      );
    return t;
  }
  const best = [...types]
    .map((t) => ({
      t,
      s: Math.max(scoreName(t.name), scoreName(t.pluralName)),
    }))
    .sort((a, b) => b.s - a.s)[0]?.t;
  if (!best) throw new Error("Could not identify any entity type");
  return best;
}

async function pickPhoneColumnId(
  entityTypeId: CatalogEntityType["id"],
): Promise<string> {
  const cols = await listCols(entityTypeId);
  const override = Bun.env.DEMO_PHONE_COLUMN_ID;
  if (override) return S.decodeUnknownSync(ColumnIdSchema)(override);
  const byName = cols.find((c) => /phone|mobile/i.test(c.name))?.id;
  if (!byName)
    throw new Error("No phone-like column found; set DEMO_PHONE_COLUMN_ID");
  return S.decodeUnknownSync(ColumnIdSchema)(byName);
}

test("listEntityTypes returns at least one and includes People-type at top", async () => {
  await requireEnv();
  const rows = await listTypes();
  expect(rows.length).toBeGreaterThan(0);
  const type = await pickPeopleType(rows);
  const nameScore = Math.max(scoreName(type.name), scoreName(type.pluralName));
  expect(nameScore).toBeGreaterThan(0);
});

test("OrgEntityStore can find a person by phone when DEMO_TEST_PHONE is provided", async () => {
  await requireEnv();
  if (!Bun.env.DEMO_TEST_PHONE) {
    throw new Error("Set DEMO_TEST_PHONE to a known phone in your org DB.");
  }
  const orgId = S.decodeUnknownSync(OrganizationIdSchema)(Bun.env.DEMO_ORG_ID);
  const types = await listTypes();
  expect(types.length).toBeGreaterThan(0);
  const type = await pickPeopleType(types);
  const phoneColumnId = await pickPhoneColumnId(type.id);
  const entityId = await Effect.runPromise(
    withLayer(
      Effect.flatMap(OrgEntityStoreTag, (s) =>
        s.findByColumnEquals({
          organizationId: orgId,
          versionType: vtProd,
          targetEntityTypeId: S.decodeUnknownSync(EntityTypeIdSchema)(type.id),
          columnId: S.decodeUnknownSync(ColumnIdSchema)(phoneColumnId),
          value: String(Bun.env.DEMO_TEST_PHONE),
        }),
      ),
    ),
  );
  expect(typeof entityId === "string" && entityId.length > 0).toBe(true);
});
