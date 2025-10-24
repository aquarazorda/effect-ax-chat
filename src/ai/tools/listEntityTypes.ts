import type { AxFunction } from "@ax-llm/ax";
import { Runtime, Effect } from "effect";
import * as S from "effect/Schema";
import { EntityTypeCatalogTag } from "../../services/EntityTypeCatalog";
import { OrganizationIdSchema } from "../../db/ids";
import type { AppEnv } from "../../env";

export interface ListEntityTypesToolDeps {
  readonly runtime: Runtime.Runtime<any>;
  readonly env: AppEnv;
  readonly startTypingHeartbeat: () => () => void;
}

export const makeListEntityTypesTool = (
  deps: ListEntityTypesToolDeps,
): AxFunction => ({
  name: "listEntityTypes",
  description: "List available entity types (name, plural, id).",
  parameters: { type: "object", properties: {} },
  func: async () => {
    const stopTyping = deps.startTypingHeartbeat();
    const types = await Runtime.runPromise(
      deps.runtime,
      Effect.flatMap(EntityTypeCatalogTag, (c) =>
        c
          .listEntityTypes({
            organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
              deps.env.DEMO_ORG_ID,
            ),
            versionType: "prod",
            columnsFilter: {
              nameContains: ["phone", "mobile", "cell", "email", "name"],
              max: 24,
            },
          })
          .pipe(Effect.catchAll(() => Effect.succeed([]))),
      ),
    );
    const out = types.map((t) => ({
      id: t.id,
      name: t.name,
      pluralName: t.pluralName,
      columns: (t.columns ?? []).map((c) => ({ id: c.id, name: c.name })),
    }));
    stopTyping();
    return out;
  },
});

