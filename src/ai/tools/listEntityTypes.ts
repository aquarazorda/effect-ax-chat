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
  readonly getCache?: () =>
    | ReadonlyArray<{
        id: string;
        name: string;
        pluralName: string;
        columns?: ReadonlyArray<{ id: string; name: string }>;
      }>
    | undefined;
  readonly setCache?: (
    rows: ReadonlyArray<{
      id: string;
      name: string;
      pluralName: string;
      columns?: ReadonlyArray<{ id: string; name: string }>;
    }>,
  ) => void;
}

export const makeListEntityTypesTool = (
  deps: ListEntityTypesToolDeps,
): AxFunction => ({
  name: "listEntityTypes",
  description:
    "List available entity types as plain strings (id|name|plural|cols...).",
  parameters: { type: "object", properties: {} },
  func: async () => {
    const stopTyping = deps.startTypingHeartbeat();
    const cached = deps.getCache?.();
    if (cached && cached.length > 0) {
      const outCached = cached.map((t) => {
        const cols = (t.columns ?? [])
          .map((c) => `${c.name}=${c.id}`)
          .join(", ");
        return `${t.id}|${t.name}|${t.pluralName}|cols: ${cols}`;
      });
      stopTyping();
      return outCached;
    }
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
    const mapped = types.map((t) => ({
      id: t.id,
      name: t.name,
      pluralName: t.pluralName,
      columns: t.columns ?? [],
    }));
    deps.setCache?.(mapped);
    const out = mapped.map((t) => {
      const cols = (t.columns ?? []).map((c) => `${c.name}=${c.id}`).join(", ");
      return `${t.id}|${t.name}|${t.pluralName}|cols: ${cols}`;
    });
    stopTyping();
    return out;
  },
});
