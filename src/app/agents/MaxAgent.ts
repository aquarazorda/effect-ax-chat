import { Effect, Runtime } from "effect";
import * as S from "effect/Schema";
import { ax, ai, type AxFunction } from "@ax-llm/ax";
import type { AgentFactory } from "../../runtime/Session";
import { AppEnvTag } from "../../env";
import type { AppEnv } from "../../env";
import { EntityTypeCatalogTag } from "../../services/EntityTypeCatalog";
import { OrgEntityStoreTag } from "../../services/OrgEntityStore";
import { PermissionEngineTag } from "../../permissions/PermissionEngine";
import * as Option from "effect/Option";
// No service tags required for MVP search stub
// versionType is fixed to "prod" for demo
import {
  ColumnIdSchema,
  EntityTypeIdSchema,
  OrganizationIdSchema,
} from "../../db/ids";
import { VersionTypeSchema } from "../../domain/version";
import { UserEntityIdSchema } from "../../db/ids";

// Utility to interpret boolean-like env strings safely
const parseBool = (v: string | undefined): boolean =>
  v === "1" || v?.toLowerCase() === "true";

// Typed parameters for tools decoded with Effect Schema at boundaries
const SearchEntitiesParams = S.Struct({
  entityTypeId: EntityTypeIdSchema,
  pageNumber: S.optional(S.Number),
  pageSize: S.optional(S.Number),
});
type SearchEntitiesParams = typeof SearchEntitiesParams.Type;

export const makeMaxAgent: AgentFactory<
  | AppEnvTag
  | EntityTypeCatalogTag
  | OrgEntityStoreTag
  | import("../../db/tags").BuilderDbTag
  | import("../../db/tags").OrgDbResolverTag
  | PermissionEngineTag
  | import("../../permissions/Authorization").AuthorizationServiceTag
  | import("../../services/UserEntityResolver").UserEntityResolverTag
  | import("../../permissions/LinkToken").LinkTokenVerifierTag
> = (ctx) => {
  let phoneNumber: string | undefined = undefined;
  // Anchor entity id (People entity matched by phone); stored per session
  let anchorEntityId: string | undefined = undefined;
  let greeted = false;

  return (m) =>
    Effect.gen(function* () {
      const AGENT_NAME = "Max" as const;
      yield* Effect.annotateLogs({
        component: "MaxAgent",
        agent: AGENT_NAME,
        chatId: m.chatId,
        senderId: m.senderId,
      })(Effect.logInfo("received", m.text));
      // Capture phone number using Effect Schema decoding
      const PhoneNumberSchema = S.String.pipe(S.brand("PhoneNumber"));
      const TelegramMetaSchema = S.Struct({
        phoneNumber: S.optional(PhoneNumberSchema),
        contactFirstName: S.optional(S.String),
        contactLastName: S.optional(S.String),
      });
      try {
        const parsed = S.decodeUnknownSync(TelegramMetaSchema)(
          m.metadata ?? {},
        );
        if (parsed.phoneNumber) {
          phoneNumber = parsed.phoneNumber;
          yield* Effect.annotateLogs({
            component: "MaxAgent",
            agent: AGENT_NAME,
            chatId: m.chatId,
            senderId: m.senderId,
          })(Effect.logInfo("phone captured"));
        }
      } catch {
        // Ignore metadata decode failures; proceed to ask for phone if missing
      }

      // Env for configuration
      const env = yield* AppEnvTag;
      const runtime = yield* Effect.runtime<
        | AppEnvTag
        | EntityTypeCatalogTag
        | OrgEntityStoreTag
        | import("../../db/tags").BuilderDbTag
        | import("../../db/tags").OrgDbResolverTag
        | PermissionEngineTag
        | import("../../permissions/Authorization").AuthorizationServiceTag
        | import("../../services/UserEntityResolver").UserEntityResolverTag
        | import("../../permissions/LinkToken").LinkTokenVerifierTag
      >();

      // require org context for demo; else guide user
      const demoOrgId = env.DEMO_ORG_ID;
      if (!demoOrgId) {
        yield* ctx.send({
          chatId: m.chatId,
          text: "Max is almost ready. Set DEMO_ORG_ID in .env and restart, or tell me your org id.",
        });
        return;
      }

      // If we don't have a phone number yet, ask for it via Telegram reply keyboard
      if (!phoneNumber) {
        yield* Effect.annotateLogs({
          component: "MaxAgent",
          agent: AGENT_NAME,
          chatId: m.chatId,
          senderId: m.senderId,
        })(Effect.logInfo("requesting phone share"));
        yield* ctx.send({
          chatId: m.chatId,
          text: "Please share your phone number to continue.",
          metadata: {
            telegramReplyMarkup: {
              keyboard: [[{ text: "Share phone", request_contact: true }]],
              one_time_keyboard: true,
              resize_keyboard: true,
            },
            agent: AGENT_NAME,
            stage: "request-phone",
          },
        });
        return;
      }

      // Resolve user anchor by introspecting People and phone column if not set
      if (!anchorEntityId && phoneNumber) {
        const resolveStart = Date.now();
        yield* Effect.annotateLogs({
          component: "MaxAgent",
          agent: AGENT_NAME,
          chatId: m.chatId,
          senderId: m.senderId,
        })(Effect.logInfo("resolve anchor start"));
        try {
          const types = yield* Effect.promise(() =>
            Runtime.runPromise(
              runtime,
              Effect.flatMap(EntityTypeCatalogTag, (c) =>
                c
                  .listEntityTypes({
                    organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                      env.DEMO_ORG_ID,
                    ),
                    versionType: "prod",
                  })
                  .pipe(Effect.catchAll(() => Effect.succeed([]))),
              ),
            ),
          );
          yield* Effect.annotateLogs({
            component: "MaxAgent",
            agent: AGENT_NAME,
            chatId: m.chatId,
            senderId: m.senderId,
          })(Effect.logDebug(`types.count=${types.length}`));
          // Prefer explicit env override; else heuristic match on name
          const preferId = env.DEMO_PEOPLE_ENTITY_TYPE_ID;
          const pickPeople = () => {
            if (preferId) return types.find((t) => t.id === preferId);
            const score = (name: string) => {
              const n = name.toLowerCase();
              if (n.includes("people")) return 3;
              if (n.includes("person")) return 2;
              if (n.includes("contact")) return 2;
              if (n.includes("user")) return 1;
              return 0;
            };
            let best = types[0];
            let bestScore = -1;
            for (const t of types) {
              const s = Math.max(score(t.name), score(t.pluralName));
              if (s > bestScore) {
                best = t;
                bestScore = s;
              }
            }
            return bestScore > 0 ? best : undefined;
          };
          const people = pickPeople();
          if (people) {
            yield* Effect.annotateLogs({
              component: "MaxAgent",
              agent: AGENT_NAME,
              chatId: m.chatId,
              senderId: m.senderId,
            })(Effect.logDebug(`people.id=${people.id} name=${people.name}`));
            const cols = yield* Effect.promise(() =>
              Runtime.runPromise(
                runtime,
                Effect.flatMap(EntityTypeCatalogTag, (c) =>
                  c
                    .listColumns({
                      organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                        env.DEMO_ORG_ID,
                      ),
                      versionType: "prod",
                      entityTypeId: people.id,
                    })
                    .pipe(Effect.catchAll(() => Effect.succeed([]))),
                ),
              ),
            );
            yield* Effect.annotateLogs({
              component: "MaxAgent",
              agent: AGENT_NAME,
              chatId: m.chatId,
              senderId: m.senderId,
            })(Effect.logDebug(`people.columns.count=${cols.length}`));
            const phoneColId = env.DEMO_PHONE_COLUMN_ID
              ? env.DEMO_PHONE_COLUMN_ID
              : (() => {
                  const rank = (n: string) => {
                    const s = n.toLowerCase();
                    if (s === "phone" || s === "phone_number") return 3;
                    if (s.includes("phone")) return 2;
                    if (s.includes("mobile")) return 1;
                    return 0;
                  };
                  let best: { id: string; name: string } | undefined;
                  let bestScore = -1;
                  for (const c of cols) {
                    const s = rank(c.name);
                    if (s > bestScore) {
                      best = c;
                      bestScore = s;
                    }
                  }
                  return best?.id;
                })();
            if (phoneColId) {
              yield* Effect.annotateLogs({
                component: "MaxAgent",
                agent: AGENT_NAME,
                chatId: m.chatId,
                senderId: m.senderId,
              })(Effect.logDebug(`phone.columnId=${phoneColId}`));
            } else {
              yield* Effect.annotateLogs({
                component: "MaxAgent",
                agent: AGENT_NAME,
                chatId: m.chatId,
                senderId: m.senderId,
              })(Effect.logDebug("phone.columnId not found"));
            }
            if (phoneColId) {
              const found = yield* Effect.promise(() =>
                Runtime.runPromise(
                  runtime,
                  Effect.flatMap(OrgEntityStoreTag, (s) =>
                    s
                      .findByColumnEquals({
                        organizationId: S.decodeUnknownSync(
                          OrganizationIdSchema,
                        )(env.DEMO_ORG_ID),
                        versionType:
                          S.decodeUnknownSync(VersionTypeSchema)("prod"),
                        targetEntityTypeId: people.id,
                        columnId:
                          S.decodeUnknownSync(ColumnIdSchema)(phoneColId),
                        value: phoneNumber!,
                      })
                      .pipe(Effect.catchAll(() => Effect.succeed(undefined))),
                  ),
                ),
              );
              if (found) {
                anchorEntityId = found;
                yield* Effect.annotateLogs({
                  component: "MaxAgent",
                  agent: AGENT_NAME,
                  chatId: m.chatId,
                  senderId: m.senderId,
                })(Effect.logInfo("anchor resolved"));
              }
            }
          }
        } catch (e) {
          yield* Effect.annotateLogs({
            component: "MaxAgent",
            agent: AGENT_NAME,
            chatId: m.chatId,
            senderId: m.senderId,
          })(Effect.logError("resolve anchor failed", e));
        } finally {
          const took = Date.now() - resolveStart;
          yield* Effect.annotateLogs({
            component: "MaxAgent",
            agent: AGENT_NAME,
            chatId: m.chatId,
            senderId: m.senderId,
            tookMs: took,
          })(Effect.logDebug("resolve anchor done"));
        }
      }

      // If we just resolved anchor, greet once and return
      if (anchorEntityId && !greeted) {
        greeted = true;
        yield* ctx.send({
          chatId: m.chatId,
          text: "Great, I’ve verified your number. How can I help?",
          metadata: { agent: AGENT_NAME, stage: "greet" },
        });
        return;
      }

      // No interim ack; proceed to LLM

      const tools: AxFunction[] = [
        {
          name: "listEntityTypes",
          description: "List available entity types (name, plural, id).",
          parameters: { type: "object", properties: {} },
          func: async () => {
            const types = await Runtime.runPromise(
              runtime,
              Effect.flatMap(EntityTypeCatalogTag, (c) =>
                c
                  .listEntityTypes({
                    organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                      env.DEMO_ORG_ID,
                    ),
                    versionType: "prod",
                  })
                  .pipe(Effect.catchAll(() => Effect.succeed([]))),
              ),
            );
            return types.map((t) => ({
              id: t.id,
              name: t.name,
              pluralName: t.pluralName,
            }));
          },
        },
        {
          name: "listColumnsForType",
          description: "List columns for a given entity type id.",
          parameters: {
            type: "object",
            properties: {
              entityTypeId: { type: "string", description: "Entity type id" },
            },
            required: ["entityTypeId"],
          },
          func: async ({ entityTypeId }) => {
            const cols = await Runtime.runPromise(
              runtime,
              Effect.flatMap(EntityTypeCatalogTag, (c) =>
                c
                  .listColumns({
                    organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                      env.DEMO_ORG_ID,
                    ),
                    versionType: "prod",
                    entityTypeId,
                  })
                  .pipe(Effect.catchAll(() => Effect.succeed([]))),
              ),
            );
            return cols;
          },
        },
        {
          name: "searchEntities",
          description:
            "List entities you are authorized to view, using your verified identity (id, display, status).",
          parameters: {
            type: "object",
            properties: {
              entityTypeId: {
                type: "string",
                description: "Target entity type id",
              },
              pageNumber: {
                type: "number",
                description: "Zero-based page number",
              },
              pageSize: { type: "number", description: "Page size" },
            },
            required: ["entityTypeId"],
          },
          func: async (raw) => {
            const params = S.decodeUnknownSync(SearchEntitiesParams)(raw);
            // Require anchor; otherwise deny-by-default (empty results)
            if (!anchorEntityId)
              return { total: 0, pageCount: 0, entities: [] };
            const pageNumber = params.pageNumber ?? 0;
            const pageSize = params.pageSize ?? 20;
            // Plan authorizations and derive a minimal filter; inject anchor id
            const targetEntityTypeId = S.decodeUnknownSync(EntityTypeIdSchema)(
              params.entityTypeId,
            );
            const planOk = await Runtime.runPromise(
              runtime,
              Effect.flatMap(PermissionEngineTag, (e) =>
                e
                  .planEntityRead({
                    organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                      env.DEMO_ORG_ID,
                    ),
                    versionType: S.decodeUnknownSync(VersionTypeSchema)("prod"),
                    entityTypeId: targetEntityTypeId,
                    subject: { type: "read" },
                  })
                  .pipe(Effect.map((p) => ({ _tag: "ok" as const, plan: p })))
                  .pipe(
                    Effect.catchAll(() =>
                      Effect.succeed({ _tag: "err" as const }),
                    ),
                  ),
              ),
            );
            if (planOk._tag === "err") {
              return { total: 0, pageCount: 0, entities: [] } as const;
            }
            const plan = planOk.plan;
            // Choose multi-hop first else one-hop; build filter with anchor
            const multi = Option.getOrUndefined(
              ((): Option.Option<
                import("../../permissions/FilterPlan").MultiHopFilterPlan
              > => {
                if (!plan.traversal || plan.traversal.length === 0)
                  return Option.none();
                for (const t of plan.traversal) {
                  if (t.steps.length > 1) {
                    return Option.some({
                      targetEntityTypeId,
                      steps: t.steps.map((s) => ({
                        relationId: s.relationId,
                        direction: s.direction,
                      })),
                      anchorUserEntityId:
                        S.decodeUnknownSync(UserEntityIdSchema)(anchorEntityId),
                    });
                  }
                }
                return Option.none();
              })(),
            );
            const one = Option.getOrUndefined(
              ((): Option.Option<
                import("../../permissions/FilterPlan").OneHopFilterPlan
              > => {
                if (!plan.traversal || plan.traversal.length === 0)
                  return Option.none();
                for (const t of plan.traversal) {
                  if (t.steps.length === 1) {
                    const s0 = t.steps[0]!;
                    return Option.some({
                      targetEntityTypeId,
                      relationId: s0.relationId,
                      direction: s0.direction,
                      anchorUserEntityId:
                        S.decodeUnknownSync(UserEntityIdSchema)(anchorEntityId),
                    });
                  }
                }
                return Option.none();
              })(),
            );

            if (!multi && !one) {
              return { total: 0, pageCount: 0, entities: [] } as const;
            }

            const result = await Runtime.runPromise(
              runtime,
              Effect.flatMap(OrgEntityStoreTag, (s) =>
                (multi
                  ? s.queryByMultiHopFilter({
                      organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                        env.DEMO_ORG_ID,
                      ),
                      versionType:
                        S.decodeUnknownSync(VersionTypeSchema)("prod"),
                      filter: multi,
                      config: { countsOnly: false },
                      page: { pageNumber, pageSize },
                    })
                  : s.queryByOneHopFilter({
                      organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                        env.DEMO_ORG_ID,
                      ),
                      versionType:
                        S.decodeUnknownSync(VersionTypeSchema)("prod"),
                      filter: one!,
                      config: { countsOnly: false },
                      page: { pageNumber, pageSize },
                    })
                ).pipe(
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
            return {
              total: result.totalNumberEntities,
              pageCount: result.totalNumberPages,
              entities: result.entities,
            };
          },
        },
        {
          name: "findEntityByColumnEquals",
          description: "Find an entity id by exact column match (e.g., phone).",
          parameters: {
            type: "object",
            properties: {
              entityTypeId: { type: "string", description: "Entity type id" },
              columnId: { type: "string", description: "Column id to match" },
              value: { type: "string", description: "Value to match exactly" },
            },
            required: ["entityTypeId", "columnId", "value"],
          },
          func: async ({ entityTypeId, columnId, value }) => {
            const id = await Runtime.runPromise(
              runtime,
              Effect.flatMap(OrgEntityStoreTag, (s) =>
                s.findByColumnEquals({
                  organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                    env.DEMO_ORG_ID,
                  ),
                  versionType: S.decodeUnknownSync(VersionTypeSchema)("prod"),
                  targetEntityTypeId: S.decodeUnknownSync(EntityTypeIdSchema)(
                    entityTypeId,
                  ),
                  columnId: S.decodeUnknownSync(ColumnIdSchema)(columnId),
                  value,
                }),
              ),
            );
            return { entityId: id };
          },
        },
      ];

      const program = ax("message:string -> reply:string, toolPlan?:string", {
        functions: tools,
      });
      const llm = ai({ name: "openai", apiKey: env.OPENAI_API_KEY });

      const llmStart = Date.now();
      yield* Effect.annotateLogs({
        component: "MaxAgent",
        agent: AGENT_NAME,
        chatId: m.chatId,
        senderId: m.senderId,
      })(Effect.logInfo("llm.forward start"));
      const out = yield* Effect.promise(() =>
        program.forward(llm, { message: m.text }),
      );
      const llmMs = Date.now() - llmStart;
      yield* Effect.annotateLogs({
        component: "MaxAgent",
        agent: AGENT_NAME,
        chatId: m.chatId,
        senderId: m.senderId,
        tookMs: llmMs,
      })(Effect.logInfo("llm.forward done"));

      const reply = out.reply ?? "Done.";
      yield* Effect.annotateLogs({
        component: "MaxAgent",
        agent: AGENT_NAME,
        chatId: m.chatId,
        senderId: m.senderId,
      })(Effect.logInfo("reply", reply));
      yield* ctx.send({
        chatId: m.chatId,
        text: reply,
        metadata: { agent: AGENT_NAME, stage: "final" },
      });
    });
};

// Bound variant that doesn't require env tags at call site
export interface MaxAgentDeps {
  readonly env: AppEnv;
}

export const makeMaxAgentBound =
  (deps: MaxAgentDeps): AgentFactory<never> =>
  (ctx) => {
    let phoneNumber: string | undefined = undefined;
    return (m) =>
      Effect.gen(function* () {
        const AGENT_NAME = "Max" as const;
        yield* Effect.annotateLogs({
          component: "MaxAgent",
          agent: AGENT_NAME,
          chatId: m.chatId,
          senderId: m.senderId,
        })(Effect.logInfo("received", m.text));
        // Parse phone via schema
        const PhoneNumberSchema = S.String.pipe(S.brand("PhoneNumber"));
        const TelegramMetaSchema = S.Struct({
          phoneNumber: S.optional(PhoneNumberSchema),
          contactFirstName: S.optional(S.String),
          contactLastName: S.optional(S.String),
        });
        try {
          const parsed = S.decodeUnknownSync(TelegramMetaSchema)(
            m.metadata ?? {},
          );
          if (parsed.phoneNumber) {
            phoneNumber = parsed.phoneNumber;
            yield* Effect.annotateLogs({
              component: "MaxAgent",
              agent: AGENT_NAME,
              chatId: m.chatId,
              senderId: m.senderId,
            })(Effect.logInfo("phone captured"));
          }
        } catch {}

        const env = deps.env;

        const demoOrgId = env.DEMO_ORG_ID;
        if (!demoOrgId) {
          yield* ctx.send({
            chatId: m.chatId,
            text: "Max is almost ready. Set DEMO_ORG_ID in .env and restart, or tell me your org id.",
          });
          return;
        }

        if (!phoneNumber) {
          yield* Effect.annotateLogs({
            component: "MaxAgent",
            agent: AGENT_NAME,
            chatId: m.chatId,
            senderId: m.senderId,
          })(Effect.logInfo("requesting phone share"));
          yield* ctx.send({
            chatId: m.chatId,
            text: "Please share your phone number to continue.",
            metadata: {
              telegramReplyMarkup: {
                keyboard: [[{ text: "Share phone", request_contact: true }]],
                one_time_keyboard: true,
                resize_keyboard: true,
              },
              agent: AGENT_NAME,
              stage: "request-phone",
            },
          });
          return;
        }

        const tools: AxFunction[] = [
          {
            name: "searchEntities",
            description:
              "List authorized entities of a type with minimal display data (id, display, status).",
            parameters: {
              type: "object",
              properties: {
                entityTypeId: {
                  type: "string",
                  description: "Target entity type id",
                },
                pageNumber: {
                  type: "number",
                  description: "Zero-based page number",
                },
                pageSize: { type: "number", description: "Page size" },
              },
              required: ["entityTypeId"],
            },
            func: async (raw) => {
              const _params = S.decodeUnknownSync(SearchEntitiesParams)(raw);
              const trust = parseBool(env.DEMO_TRUST_MODE) || !!phoneNumber;
              if (!trust) return { total: 0, pageCount: 0, entities: [] };
              return { total: 0, pageCount: 0, entities: [] } as const;
            },
          },
        ];

        const program = ax("message:string -> reply:string, toolPlan?:string", {
          functions: tools,
        });
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) {
          yield* ctx.send({
            chatId: m.chatId,
            text: "Missing OpenAI API key. Set OPENAI_API_KEY in .env or configure a provider.",
          });
          return;
        }
        const llm = ai({ name: "openai", apiKey: openaiKey });
        // No interim ack in bound variant either

        const llmStart = Date.now();
        yield* Effect.annotateLogs({
          component: "MaxAgent",
          agent: AGENT_NAME,
          chatId: m.chatId,
          senderId: m.senderId,
        })(Effect.logInfo("llm.forward start"));
        const out = yield* Effect.promise(() =>
          program.forward(llm, { message: m.text }),
        );
        const llmMs = Date.now() - llmStart;
        yield* Effect.annotateLogs({
          component: "MaxAgent",
          agent: AGENT_NAME,
          chatId: m.chatId,
          senderId: m.senderId,
          tookMs: llmMs,
        })(Effect.logInfo("llm.forward done"));

        const reply = out.reply ?? "Done.";
        yield* Effect.annotateLogs({
          component: "MaxAgent",
          agent: AGENT_NAME,
          chatId: m.chatId,
          senderId: m.senderId,
        })(Effect.logInfo("reply", reply));
        yield* ctx.send({
          chatId: m.chatId,
          text: reply,
          metadata: { agent: AGENT_NAME, stage: "final" },
        });
      });
  };
