import { Context, Effect, Layer } from "effect";
import { dbSchema } from "../db/schema";
import {
  BuilderDbTag,
  type BuilderDatabase,
  makeDbError,
  type DbError,
} from "../db/tags";
import { and, eq, inArray } from "drizzle-orm";
import type {
  ActionId,
  ActionVersionId,
  EntityTypeId,
  OrganizationId,
} from "../db/ids";
import {
  AuthorizationServiceTag,
  type AuthorizationService,
  type Authorization,
} from "../permissions/Authorization";

export interface ActionCore {
  readonly id?: ActionId;
  readonly versionId: ActionVersionId;
  readonly name: string;
  readonly description?: string;
  readonly entityTypeId?: EntityTypeId;
  readonly actionType: string;
  readonly toState?: string;
  readonly fromStates?: ReadonlyArray<string>;
  readonly authorizations: ReadonlyArray<Authorization>;
}

export interface ActionService {
  readonly getByVersionIds: (args: {
    organizationId: OrganizationId;
    versionIds: ReadonlyArray<ActionVersionId>;
  }) => Effect.Effect<
    ReadonlyArray<ActionCore>,
    DbError,
    BuilderDbTag | AuthorizationServiceTag
  >;
}

export class ActionServiceTag extends Context.Tag("effect-ax/ActionService")<
  ActionServiceTag,
  ActionService
>() {}

export const makeActionService = (): ActionService => {
  const getByVersionIds: ActionService["getByVersionIds"] = ({
    organizationId,
    versionIds,
  }) =>
    Effect.gen(function* () {
      if (versionIds.length === 0) return [] as const;
      const db: BuilderDatabase = yield* BuilderDbTag;
      const authz: AuthorizationService = yield* AuthorizationServiceTag;

      const actions = yield* Effect.promise(() =>
        db
          .select()
          .from(dbSchema.data_model_action)
          .where(
            and(
              eq(dbSchema.data_model_action.organization_id, organizationId),
              inArray(dbSchema.data_model_action.version_id, versionIds),
            ),
          ),
      );

      const authByVersionId = yield* authz.getByActionVersionIds({
        organizationId,
        actionVersionIds: versionIds,
      });

      const isStringArray = (v: unknown): v is ReadonlyArray<string> =>
        Array.isArray(v) && v.every((x) => typeof x === "string");

      return actions.map<ActionCore>((a) => ({
        id: a.id ?? undefined,
        versionId: a.version_id,
        name: a.name,
        description: a.description ?? undefined,
        entityTypeId: a.entity_type_id ?? undefined,
        actionType: a.action_type,
        toState: a.to_state ?? undefined,
        fromStates: isStringArray(a.from_states) ? a.from_states : undefined,
        authorizations: authByVersionId[a.version_id] ?? [],
      }));
    }).pipe(
      Effect.catchAll((e) =>
        Effect.fail(makeDbError("Actions fetch failed", e)),
      ),
    );

  return { getByVersionIds } satisfies ActionService;
};

export const makeActionServiceLayer: Layer.Layer<ActionServiceTag> =
  Layer.effect(ActionServiceTag, Effect.succeed(makeActionService()));
