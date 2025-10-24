import { expect, test } from "bun:test";
import {
  deriveOneHopFilter,
  deriveMultiHopFilter,
} from "../src/permissions/FilterPlan";
import type { EntityReadPlan } from "../src/permissions/PermissionEngine";
import * as S from "effect/Schema";
import {
  EntityTypeIdSchema,
  RelationIdSchema,
  UserEntityIdSchema,
  type EntityTypeId,
  type RelationId,
  type UserEntityId,
} from "../src/db/ids";

const mkPlan = (
  steps: Array<{ relationId: RelationId; direction: "aToB" | "bToA" }>,
): EntityReadPlan => ({
  mode: "filter",
  fieldGroupPolicy: {
    anyStateGranted: false,
    fieldGroupsGranted: new Set(),
    actionsGranted: new Set(),
  },
  traversal: [{ steps }],
  anchorUserEntityId: S.decodeUnknownSync(UserEntityIdSchema)("ue_1"),
});

test("deriveOneHopFilter returns first single-step path", () => {
  const plan = mkPlan([
    {
      relationId: S.decodeUnknownSync(RelationIdSchema)("rel1"),
      direction: "aToB",
    },
  ]);
  const res = deriveOneHopFilter(
    plan,
    S.decodeUnknownSync(EntityTypeIdSchema)("et_1"),
  );
  expect(res._tag).toBe("Some");
  if (res._tag === "Some") {
    expect(res.value.relationId).toBe(
      S.decodeUnknownSync(RelationIdSchema)("rel1"),
    );
    expect(res.value.direction).toBe("aToB");
    expect(res.value.targetEntityTypeId).toBe(
      S.decodeUnknownSync(EntityTypeIdSchema)("et_1"),
    );
  }
});

test("deriveMultiHopFilter returns first multi-step path", () => {
  const plan = mkPlan([
    {
      relationId: S.decodeUnknownSync(RelationIdSchema)("rel1"),
      direction: "aToB",
    },
    {
      relationId: S.decodeUnknownSync(RelationIdSchema)("rel2"),
      direction: "bToA",
    },
  ]);
  const res = deriveMultiHopFilter(
    plan,
    S.decodeUnknownSync(EntityTypeIdSchema)("et_2"),
  );
  expect(res._tag).toBe("Some");
  if (res._tag === "Some") {
    expect(res.value.steps.length).toBe(2);
    expect(res.value.steps[0]!.relationId).toBe(
      S.decodeUnknownSync(RelationIdSchema)("rel1"),
    );
    expect(res.value.targetEntityTypeId).toBe(
      S.decodeUnknownSync(EntityTypeIdSchema)("et_2"),
    );
  }
});
