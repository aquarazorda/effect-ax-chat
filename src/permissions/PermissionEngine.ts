import { Context, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import type {
  ActionId,
  EntityTypeId,
  FieldGroupId,
  OrganizationId,
  UserId,
  RelationId,
  UserEntityId,
} from "../db/ids";
import { FieldGroupIdSchema, ActionVersionIdSchema } from "../db/ids";
import type { VersionType } from "../domain/version";
import { BuilderDbTag, type BuilderDatabase } from "../db/tags";
import { dbSchema } from "../db/schema";
import { desc, eq } from "drizzle-orm";
import {
  AuthorizationServiceTag,
  type AuthorizationService,
  type Authorization,
  type AnyoneWithLinkAuthorization,
} from "./Authorization";
import {
  UserEntityResolverTag,
  type UserEntityResolver,
} from "../services/UserEntityResolver";
import { LinkTokenVerifierTag, type LinkTokenVerifier } from "./LinkToken";

// Minimal field-group access metadata used when filtering results
export interface FieldGroupAccessPolicy {
  readonly anyStateGranted: boolean;
  readonly fieldGroupsGranted: ReadonlySet<FieldGroupId>;
  readonly actionsGranted: ReadonlySet<ActionId>;
}

// Read plan describes whether to allow, deny, or require filters
export type ReadPlanMode = "denyAll" | "allowAll" | "filter";

export interface EntityReadPlan {
  readonly mode: ReadPlanMode;
  readonly fieldGroupPolicy: FieldGroupAccessPolicy;
  readonly traversal?: ReadonlyArray<{
    readonly startingEntityTypeId?: EntityTypeId;
    readonly steps: ReadonlyArray<{
      readonly relationId: RelationId;
      readonly direction: "aToB" | "bToA";
    }>;
  }>;
  readonly anchorUserEntityId?: UserEntityId;
}

export interface ActionExecutePlan {
  readonly mode: ReadPlanMode;
  readonly actionVersionId: string; // use branded in higher layer if needed
  readonly traversal?: ReadonlyArray<{
    readonly startingEntityTypeId?: EntityTypeId;
    readonly steps: ReadonlyArray<{
      readonly relationId: string;
      readonly direction: "aToB" | "bToA";
    }>;
  }>;
  readonly anchorUserEntityId?: string;
}

export type AuthorizeFor =
  | { readonly type: "read"; readonly userId?: UserId }
  | { readonly type: "activityLog"; readonly userId?: UserId }
  | {
      readonly type: "actionExecution";
      readonly userId?: UserId;
      readonly actions?: ReadonlyArray<ActionId>;
    }
  | { readonly type: "system" };

export interface PermissionEngine {
  readonly planEntityRead: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly entityTypeId: EntityTypeId;
    readonly subject: Extract<AuthorizeFor, { type: "read" | "system" }>;
    readonly linkToken?: string;
  }) => Effect.Effect<
    EntityReadPlan,
    never,
    | BuilderDbTag
    | AuthorizationServiceTag
    | UserEntityResolverTag
    | LinkTokenVerifierTag
  >;

  readonly planActionExecute: (args: {
    readonly organizationId: OrganizationId;
    readonly versionType: VersionType;
    readonly actionVersionId: string; // branded in service layer
    readonly subject: Extract<
      AuthorizeFor,
      { type: "actionExecution" | "system" }
    >;
  }) => Effect.Effect<
    ActionExecutePlan,
    never,
    BuilderDbTag | AuthorizationServiceTag | UserEntityResolverTag
  >;
}

export class PermissionEngineTag extends Context.Tag(
  "effect-ax/PermissionEngine",
)<PermissionEngineTag, PermissionEngine>() {}

// Safe default: deny everything until actual relation-path evaluation is implemented
export const makePermissionEngine = (): PermissionEngine => {
  const emptyPolicy = (): FieldGroupAccessPolicy => ({
    anyStateGranted: false,
    fieldGroupsGranted: new Set<FieldGroupId>(),
    actionsGranted: new Set<ActionId>(),
  });

  const getLatestEntityTypeVersionId = (
    db: BuilderDatabase,
    entityTypeId: EntityTypeId,
  ) =>
    Effect.promise(() =>
      db
        .select({
          version_id: dbSchema.data_model_entity_type_version.version_id,
        })
        .from(dbSchema.data_model_entity_type_version)
        .where(eq(dbSchema.data_model_entity_type_version.id, entityTypeId))
        .orderBy(desc(dbSchema.data_model_entity_type_version.created_at))
        .limit(1),
    ).pipe(Effect.map((rows) => rows[0]?.version_id));

  const planEntityRead: PermissionEngine["planEntityRead"] = ({
    organizationId,
    versionType,
    entityTypeId,
    subject,
    linkToken,
  }) =>
    Effect.gen(function* () {
      if (subject.type === "system") {
        return { mode: "allowAll", fieldGroupPolicy: emptyPolicy() } as const;
      }

      const db = yield* BuilderDbTag;
      const authz: AuthorizationService = yield* AuthorizationServiceTag;
      const userResolver: UserEntityResolver = yield* UserEntityResolverTag;
      const linkVerifier: LinkTokenVerifier = yield* LinkTokenVerifierTag;

      const versionId = yield* getLatestEntityTypeVersionId(db, entityTypeId);
      if (!versionId) {
        return { mode: "denyAll", fieldGroupPolicy: emptyPolicy() } as const;
      }

      const byVersion = yield* authz.getByEntityTypeVersionIds({
        organizationId,
        entityTypeVersionIds: [versionId],
      });
      const grouped = byVersion[versionId];
      if (!grouped) {
        return { mode: "denyAll", fieldGroupPolicy: emptyPolicy() } as const;
      }

      // Minimal policy: grant only explicitly per-field-group entries for now
      const fieldGroups = new Set<FieldGroupId>();
      // Grant per-field-group read when an authorization exists OR link token is valid for link-based grants
      for (const [fgId, auths] of Object.entries(grouped.perFieldGroupId)) {
        const hasDirect = auths.some((a) => "authorizedByRelationPath" in a);
        const hasLink = auths.some((a) => "authorizedForAnyoneWithLink" in a);
        if (hasDirect)
          fieldGroups.add(S.decodeUnknownSync(FieldGroupIdSchema)(fgId));
        if (hasLink && linkToken) {
          const ok = yield* linkVerifier.verify(linkToken);
          if (ok)
            fieldGroups.add(S.decodeUnknownSync(FieldGroupIdSchema)(fgId));
        }
      }
      const policy: FieldGroupAccessPolicy = {
        anyStateGranted: grouped.read.length > 0,
        fieldGroupsGranted: fieldGroups,
        actionsGranted: new Set<ActionId>(),
      };

      const mode: ReadPlanMode =
        grouped.read.length > 0 || fieldGroups.size > 0 ? "filter" : "denyAll";

      // Build traversal plans from authorizations (read + perFieldGroup)
      const traversals: Array<{
        startingEntityTypeId?: EntityTypeId;
        steps: Array<{ relationId: RelationId; direction: "aToB" | "bToA" }>;
      }> = [];
      const collect = (
        auths: ReadonlyArray<Authorization | AnyoneWithLinkAuthorization>,
      ) => {
        for (const a of auths) {
          if ("authorizedByRelationPath" in a) {
            const path = a.authorizedByRelationPath;
            traversals.push({
              startingEntityTypeId: path.startingEntityType?.id,
              steps: path.path.map((p) => ({
                relationId: p.relationId,
                direction: p.direction,
              })),
            });
          }
        }
      };
      collect(grouped.read);
      for (const fg of Object.values(grouped.perFieldGroupId)) collect(fg);

      // resolve user entity anchor when available
      let anchorUserEntityId: UserEntityId | undefined = undefined;
      if (subject.userId) {
        anchorUserEntityId = yield* userResolver
          .get({ organizationId, versionType, userId: subject.userId })
          .pipe(Effect.map((e) => e ?? undefined));
      }

      return {
        mode,
        fieldGroupPolicy: policy,
        traversal: traversals,
        anchorUserEntityId,
      } as const;
    })
      .pipe(
        Effect.withSpan("PermissionEngine.planEntityRead", {
          attributes: { orgId: organizationId, versionType, entityTypeId },
        }),
      )
      .pipe(
        Effect.catchAll(() =>
          Effect.succeed<EntityReadPlan>({
            mode: "denyAll",
            fieldGroupPolicy: emptyPolicy(),
          }),
        ),
      );

  const planActionExecute: PermissionEngine["planActionExecute"] = ({
    organizationId,
    versionType,
    actionVersionId,
    subject,
  }) =>
    Effect.gen(function* () {
      if (subject.type === "system") {
        return { mode: "allowAll", actionVersionId } as const;
      }
      const authz: AuthorizationService = yield* AuthorizationServiceTag;
      const userResolver: UserEntityResolver = yield* UserEntityResolverTag;

      const byAction = yield* authz.getByActionVersionIds({
        organizationId,
        actionVersionIds: [
          S.decodeUnknownSync(ActionVersionIdSchema)(actionVersionId),
        ],
      });
      const auths = byAction[actionVersionId] ?? [];

      const traversals: Array<{
        startingEntityTypeId?: EntityTypeId;
        steps: Array<{ relationId: RelationId; direction: "aToB" | "bToA" }>;
      }> = [];
      for (const a of auths) {
        const path = a.authorizedByRelationPath;
        traversals.push({
          startingEntityTypeId: path.startingEntityType?.id,
          steps: path.path.map((p) => ({
            relationId: p.relationId,
            direction: p.direction,
          })),
        });
      }

      let anchorUserEntityId: UserEntityId | undefined = undefined;
      if (subject.userId) {
        anchorUserEntityId = yield* userResolver
          .get({ organizationId, versionType, userId: subject.userId })
          .pipe(Effect.map((e) => e ?? undefined));
      }

      const mode: ReadPlanMode = auths.length > 0 ? "filter" : "denyAll";
      return {
        mode,
        actionVersionId,
        traversal: traversals,
        anchorUserEntityId,
      } as const;
    })
      .pipe(
        Effect.withSpan("PermissionEngine.planActionExecute", {
          attributes: { orgId: organizationId, versionType, actionVersionId },
        }),
      )
      .pipe(
        Effect.catchAll(() =>
          Effect.succeed<ActionExecutePlan>({
            mode: "denyAll",
            actionVersionId,
          }),
        ),
      );

  return { planEntityRead, planActionExecute };
};

export const makePermissionEngineLayer: Layer.Layer<PermissionEngineTag> =
  Layer.effect(PermissionEngineTag, Effect.succeed(makePermissionEngine()));
