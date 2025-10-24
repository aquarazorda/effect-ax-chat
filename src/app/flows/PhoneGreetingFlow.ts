import { flow, type AxAIService } from "@ax-llm/ax";
import { Runtime, Effect } from "effect";
import * as S from "effect/Schema";
import { EntityTypeCatalogTag } from "../../services/EntityTypeCatalog";
import { OrgEntityStoreTag } from "../../services/OrgEntityStore";
import {
  OrganizationIdSchema,
  EntityTypeIdSchema,
  ColumnIdSchema,
} from "../../db/ids";
import { VersionTypeSchema } from "../../domain/version";

export interface PhoneGreetingFlowInput {
  readonly organizationId: string;
  readonly phoneNumber: string;
  readonly versionType?: "prod" | "dev";
  readonly preferPeopleEntityTypeId?: string;
  readonly preferPhoneColumnId?: string;
}

export interface PhoneGreetingFlowOutput {
  readonly anchorEntityId?: string;
  readonly displayName?: string;
  readonly greetingText: string;
}

export interface PhoneGreetingFlowDeps {
  readonly runtime: Runtime.Runtime<any>;
}

const pickBestPeopleType = (
  types: ReadonlyArray<{ id: string; name: string; pluralName: string }>,
  preferId?: string,
): { id: string; name: string } | undefined => {
  if (preferId) return types.find((t) => t.id === preferId);
  const score = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes("people")) return 4;
    if (n.includes("person")) return 3;
    if (n.includes("contact")) return 2;
    if (n.includes("user")) return 1;
    return 0;
  };
  let best: { id: string; name: string } | undefined;
  let bestScore = -1;
  for (const t of types) {
    const s = Math.max(score(t.name), score(t.pluralName));
    if (s > bestScore) {
      best = { id: t.id, name: t.name };
      bestScore = s;
    }
  }
  return bestScore > 0 ? best : undefined;
};

const pickBestPhoneColumn = (
  cols: ReadonlyArray<{ id: string; name: string }>,
  preferId?: string,
): string | undefined => {
  if (preferId) return preferId;
  const rank = (n: string) => {
    const s = n.toLowerCase();
    if (s === "phone" || s === "phone_number") return 4;
    if (s.includes("phone")) return 3;
    if (s.includes("mobile")) return 2;
    if (s.includes("cell")) return 1;
    return 0;
  };
  let best: { id: string; score: number } | undefined;
  for (const c of cols) {
    const s = rank(c.name);
    if (!best || s > best.score) best = { id: c.id, score: s };
  }
  return best?.score && best.score > 0 ? best.id : undefined;
};

type InternalState = PhoneGreetingFlowInput & {
  readonly _types?: ReadonlyArray<{
    id: string;
    name: string;
    pluralName: string;
  }>;
  readonly _people?: { id: string; name: string };
  readonly _cols?: ReadonlyArray<{ id: string; name: string }>;
  readonly _phoneColId?: string;
  readonly _anchorId?: string;
  readonly _displayName?: string;
};

export const runPhoneGreetingFlow = async (
  deps: PhoneGreetingFlowDeps,
  aiSvc: AxAIService,
  input: PhoneGreetingFlowInput,
): Promise<PhoneGreetingFlowOutput> => {
  const f = flow<InternalState, PhoneGreetingFlowOutput>();

  const wf = f
    .map(async (state) => {
      const orgId = S.decodeUnknownSync(OrganizationIdSchema)(
        state.organizationId,
      );
      const versionType = state.versionType ?? "prod";
      const types = await Runtime.runPromise(
        deps.runtime,
        Effect.flatMap(EntityTypeCatalogTag, (c) =>
          c
            .listEntityTypes({
              organizationId: orgId,
              versionType,
              columnsFilter: {
                nameContains: ["phone", "mobile", "cell"],
                max: 16,
              },
            })
            .pipe(Effect.catchAll(() => Effect.succeed([]))),
        ),
      );
      const people = pickBestPeopleType(types, state.preferPeopleEntityTypeId);
      return { ...state, _types: types, _people: people } as const;
    })
    .map(async (state) => {
      if (!state._people) return state;
      const thisType = state._types?.find((t) => t.id === state._people!.id);
      const cols = thisType?.columns ?? [];
      const phoneCol = pickBestPhoneColumn(cols, state.preferPhoneColumnId);
      return { ...state, _cols: cols, _phoneColId: phoneCol } as const;
    })
    .map(async (state) => {
      if (!state._people || !state._phoneColId) return state;
      const orgId = S.decodeUnknownSync(OrganizationIdSchema)(
        state.organizationId,
      );
      const versionTypeBranded = S.decodeUnknownSync(VersionTypeSchema)(
        state.versionType ?? "prod",
      );
      const entityId = await Runtime.runPromise(
        deps.runtime,
        Effect.flatMap(OrgEntityStoreTag, (s) =>
          s
            .findByColumnEquals({
              organizationId: orgId,
              versionType: versionTypeBranded,
              targetEntityTypeId: S.decodeUnknownSync(EntityTypeIdSchema)(
                state._people!.id,
              ),
              columnId: S.decodeUnknownSync(ColumnIdSchema)(state._phoneColId!),
              value: state.phoneNumber,
            })
            .pipe(Effect.catchAll(() => Effect.succeed(undefined))),
        ),
      );
      return { ...state, _anchorId: entityId } as const;
    })
    .map(async (state) => {
      if (!state._people || !state._phoneColId || !state._anchorId)
        return state;
      const orgId = S.decodeUnknownSync(OrganizationIdSchema)(
        state.organizationId,
      );
      const versionTypeBranded = S.decodeUnknownSync(VersionTypeSchema)(
        state.versionType ?? "prod",
      );
      const result = await Runtime.runPromise(
        deps.runtime,
        Effect.flatMap(OrgEntityStoreTag, (s) =>
          s
            .findEntities({
              organizationId: orgId,
              versionType: versionTypeBranded,
              targetEntityTypeId: S.decodeUnknownSync(EntityTypeIdSchema)(
                state._people!.id,
              ),
              filters: [
                {
                  columnId: S.decodeUnknownSync(ColumnIdSchema)(
                    state._phoneColId!,
                  ),
                  op: "eq",
                  value: state.phoneNumber,
                },
              ],
              config: { countsOnly: false, order: "asc" },
              page: { pageNumber: 0, pageSize: 1 },
            })
            .pipe(
              Effect.catchAll(() =>
                Effect.succeed({
                  entities: [],
                  totalNumberEntities: 0,
                  totalNumberPages: 0,
                }),
              ),
            ),
        ),
      );
      const displayName = result.entities[0]?.displayName;
      return { ...state, _displayName: displayName } as const;
    })
    .returns((state) => {
      if (state._anchorId) {
        const name = state._displayName?.trim();
        const greet = name
          ? `Hi ${name}. I’ve verified your number. How can I help?`
          : "Great, I’ve verified your number. How can I help?";
        return {
          anchorEntityId: state._anchorId,
          displayName: name,
          greetingText: greet,
        } satisfies PhoneGreetingFlowOutput;
      }
      return {
        greetingText:
          "Thanks! I couldn’t match your phone yet. Do you want to try a different number?",
      } satisfies PhoneGreetingFlowOutput;
    });

  // Execute the flow. For map-only flows, aiSvc is unused but required by API.
  const out = await wf.forward(aiSvc, input);
  return out;
};
