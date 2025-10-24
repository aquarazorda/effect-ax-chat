import * as Option from "effect/Option";
import type { EntityReadPlan } from "./PermissionEngine";
import type { EntityTypeId, RelationId, UserEntityId } from "../db/ids";

export interface OneHopFilterPlan {
  readonly targetEntityTypeId: EntityTypeId;
  readonly relationId: RelationId;
  readonly direction: "aToB" | "bToA";
  readonly anchorUserEntityId: UserEntityId;
}

export const deriveOneHopFilter = (
  plan: EntityReadPlan,
  targetEntityTypeId: EntityTypeId,
): Option.Option<OneHopFilterPlan> => {
  if (plan.mode === "denyAll") return Option.none();
  if (!plan.traversal || plan.traversal.length === 0) return Option.none();
  if (!plan.anchorUserEntityId) return Option.none();

  // Choose the first 1-step traversal as a minimal viable filter
  for (const t of plan.traversal) {
    if (t.steps.length === 1) {
      const s0 = t.steps[0]!;
      return Option.some({
        targetEntityTypeId,
        relationId: s0.relationId,
        direction: s0.direction,
        anchorUserEntityId: plan.anchorUserEntityId,
      });
    }
  }

  return Option.none();
};

export interface MultiHopFilterPlanStep {
  readonly relationId: RelationId;
  readonly direction: "aToB" | "bToA";
}

export interface MultiHopFilterPlan {
  readonly targetEntityTypeId: EntityTypeId;
  readonly steps: ReadonlyArray<MultiHopFilterPlanStep>;
  readonly anchorUserEntityId: UserEntityId;
}

export const deriveMultiHopFilter = (
  plan: EntityReadPlan,
  targetEntityTypeId: EntityTypeId,
): Option.Option<MultiHopFilterPlan> => {
  if (plan.mode === "denyAll") return Option.none();
  if (!plan.traversal || plan.traversal.length === 0) return Option.none();
  if (!plan.anchorUserEntityId) return Option.none();

  for (const t of plan.traversal) {
    if (t.steps.length > 1) {
      return Option.some({
        targetEntityTypeId,
        steps: t.steps.map((s) => ({
          relationId: s.relationId,
          direction: s.direction,
        })),
        anchorUserEntityId: plan.anchorUserEntityId,
      });
    }
  }
  return Option.none();
};
