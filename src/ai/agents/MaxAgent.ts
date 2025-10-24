import { Effect, Runtime } from "effect";
import * as S from "effect/Schema";
import { ax, ai, type AxFunction, AxMemory } from "@ax-llm/ax";
import type { AgentFactory } from "../../runtime/Session";
import { AppEnvTag } from "../../env";
import type { AppEnv } from "../../env";
import { EntityTypeCatalogTag } from "../../services/EntityTypeCatalog";
import { OrgEntityStoreTag } from "../../services/OrgEntityStore";
import { PermissionEngineTag } from "../../permissions/PermissionEngine";
import { runPhoneGreetingFlow } from "../../app/flows/PhoneGreetingFlow";
import { makeListEntityTypesTool } from "../tools/listEntityTypes";
import { makeFindEntitiesTool } from "../tools/findEntities";
import type { BuilderDbTag, OrgDbResolverTag } from "../../db/tags";
import type { AuthorizationServiceTag } from "../../permissions/Authorization";
import type { UserEntityResolverTag } from "../../services/UserEntityResolver";
import type { LinkTokenVerifierTag } from "../../permissions/LinkToken";
import { OrganizationIdSchema } from "../../db/ids";

export const makeMaxAgent: AgentFactory<
  | AppEnvTag
  | EntityTypeCatalogTag
  | OrgEntityStoreTag
  | BuilderDbTag
  | OrgDbResolverTag
  | PermissionEngineTag
  | AuthorizationServiceTag
  | UserEntityResolverTag
  | LinkTokenVerifierTag
> = (ctx) => {
  let phoneNumber: string | undefined = undefined;
  let anchorEntityId: string | undefined = undefined;
  let greeted = false;
  // Per-session memory for LLM to avoid re-fetches and preserve function calls
  const mem = new AxMemory();
  // Lightweight cache of entity types for this session
  let cachedTypes:
    | ReadonlyArray<{
        id: string;
        name: string;
        pluralName: string;
        columns?: ReadonlyArray<{ id: string; name: string }>;
      }>
    | undefined;

  return (m) =>
    Effect.gen(function* () {
      const AGENT_NAME = "Max" as const;
      yield* Effect.annotateLogs({
        component: "MaxAgent",
        agent: AGENT_NAME,
        chatId: m.chatId,
        senderId: m.senderId,
      })(Effect.logInfo("received", m.text));
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

      if (!anchorEntityId && phoneNumber) {
        const resolveStart = Date.now();
        yield* Effect.annotateLogs({
          component: "MaxAgent",
          agent: AGENT_NAME,
          chatId: m.chatId,
          senderId: m.senderId,
        })(Effect.logInfo("resolve anchor (AxFlow) start"));
        let flowTyping = true;
        const typingFiber2 = yield* Effect.forkDaemon(
          Effect.gen(function* () {
            while (flowTyping) {
              yield* ctx.send({
                chatId: m.chatId,
                text: ".",
                metadata: {
                  telegramChatAction: "typing",
                  telegramChatActionOnly: true,
                  agent: AGENT_NAME,
                },
              });
              yield* Effect.promise(
                () => new Promise<void>((r) => setTimeout(r, 4000)),
              );
            }
          }),
        );
        try {
          const llmForFlow = ai({
            name: "openai",
            model: "gpt-4o-mini",
            apiKey: env.OPENAI_API_KEY,
          });
          const result = yield* Effect.promise(() =>
            runPhoneGreetingFlow({ runtime }, llmForFlow, {
              organizationId:
                S.decodeUnknownSync(OrganizationIdSchema)(demoOrgId),
              phoneNumber: S.decodeUnknownSync(PhoneNumberSchema)(phoneNumber),
              versionType: "prod",
              preferPeopleEntityTypeId: env.DEMO_PEOPLE_ENTITY_TYPE_ID,
              preferPhoneColumnId: env.DEMO_PHONE_COLUMN_ID,
            }),
          );
          if (result.anchorEntityId) {
            anchorEntityId = result.anchorEntityId;
            yield* Effect.annotateLogs({
              component: "MaxAgent",
              agent: AGENT_NAME,
              chatId: m.chatId,
              senderId: m.senderId,
            })(Effect.logInfo("anchor resolved (AxFlow)"));
            if (!greeted) {
              greeted = true;
              yield* ctx.send({
                chatId: m.chatId,
                text: result.greetingText,
                metadata: { agent: AGENT_NAME, stage: "greet" },
              });
              return;
            }
          }
        } catch (e) {
          yield* Effect.annotateLogs({
            component: "MaxAgent",
            agent: AGENT_NAME,
            chatId: m.chatId,
            senderId: m.senderId,
          })(Effect.logError("resolve anchor (AxFlow) failed", e));
        } finally {
          const took = Date.now() - resolveStart;
          flowTyping = false;
          yield* Effect.annotateLogs({
            component: "MaxAgent",
            agent: AGENT_NAME,
            chatId: m.chatId,
            senderId: m.senderId,
            tookMs: took,
          })(Effect.logDebug("resolve anchor (AxFlow) done"));
        }
      }

      const startTypingHeartbeat = () => {
        let active = true;
        Runtime.runFork(
          runtime,
          Effect.gen(function* () {
            while (active) {
              yield* ctx.send({
                chatId: m.chatId,
                text: ".",
                metadata: {
                  telegramChatAction: "typing",
                  telegramChatActionOnly: true,
                  agent: AGENT_NAME,
                },
              });
              yield* Effect.promise(
                () => new Promise<void>((r) => setTimeout(r, 4000)),
              );
            }
          }),
        );
        return () => {
          active = false;
        };
      };

      // Preselect a preferred People entity type to avoid LLM spraying calls
      const candidateTypes = yield* Effect.promise(() =>
        Runtime.runPromise(
          runtime,
          Effect.flatMap(EntityTypeCatalogTag, (c) =>
            c
              .listEntityTypes({
                organizationId: S.decodeUnknownSync(OrganizationIdSchema)(
                  env.DEMO_ORG_ID,
                ),
                versionType: "prod",
                columnsFilter: {
                  nameContains: ["full", "email", "phone"],
                  max: 10,
                },
              })
              .pipe(Effect.catchAll(() => Effect.succeed([]))),
          ),
        ),
      );
      const pickPeople = () => {
        if (env.DEMO_PEOPLE_ENTITY_TYPE_ID)
          return candidateTypes.find(
            (t) => t.id === env.DEMO_PEOPLE_ENTITY_TYPE_ID,
          )?.id;
        const score = (t: { name: string; pluralName: string }) => {
          const n = `${t.name} ${t.pluralName}`.toLowerCase();
          if (n.includes("people")) return 4;
          if (n.includes("person")) return 3;
          if (n.includes("contact")) return 2;
          return 0;
        };
        let best: string | undefined;
        let bestScore = -1;
        for (const t of candidateTypes) {
          const s = score(t);
          if (s > bestScore) {
            best = t.id;
            bestScore = s;
          }
        }
        return best;
      };
      const preferredPeopleTypeId = pickPeople();

      const tools: AxFunction[] = [
        makeListEntityTypesTool({
          runtime,
          env,
          startTypingHeartbeat,
          getCache: () => cachedTypes,
          setCache: (rows) => {
            cachedTypes = rows;
          },
        }),
        makeFindEntitiesTool({
          runtime,
          env,
          startTypingHeartbeat,
          allowedEntityTypeId: preferredPeopleTypeId,
        }),
      ];

      const program = ax("message:string -> reply:string, toolPlan?:string", {
        functions: tools,
        debug: true,
      });
      program.setDescription(
        [
          "You are Max, a fast, crisp assistant.",
          "Speak plainly without technical jargon.",
          "Never mention internal terms like entity, id, column, table, or database.",
          "Be concise. Prefer short sentences and tight bullet points.",
          "Call at most one tool per user question unless strictly necessary.",
          "Use listEntityTypes once to discover ids and columns. Then call findEntities exactly once using the preferred People entity type.",
          "Tool outputs are plain strings; do not expect JSON fields.",
          "If a tool returns a line starting with 'ERROR: ', tell me what went wrong and suggest close column matches.",
          "If multiple matches: show a few names and ask me to choose.",
          "If none: say you didn’t find it and suggest a precise next step.",
          "If one: show the name and a brief status/date if relevant.",
          "Respect privacy; if restricted, say you don’t have access.",
        ].join(" "),
      );

      const llm = ai({
        name: "openai",
        model: "gpt-4o-mini",
        apiKey: env.OPENAI_API_KEY,
      });

      let typingActive = true;
      const typingFiber = yield* Effect.forkDaemon(
        Effect.gen(function* () {
          while (typingActive) {
            yield* ctx.send({
              chatId: m.chatId,
              text: ".",
              metadata: {
                telegramChatAction: "typing",
                telegramChatActionOnly: true,
                agent: AGENT_NAME,
              },
            });
            yield* Effect.promise(
              () => new Promise<void>((r) => setTimeout(r, 4000)),
            );
          }
        }),
      );
      // Use a stable program id per session and attach memory so previous tool
      // calls are in-context for the next turn.
      // Use chat-scoped session id for Ax memory
      program.setId(`max:telegram:${m.chatId}`);
      const out = yield* Effect.promise(() =>
        program.forward(
          llm,
          { message: m.text },
          {
            mem,
            sessionId: m.chatId,
          },
        ),
      );
      typingActive = false;
      const reply = out.reply ?? "Done.";
      yield* ctx.send({
        chatId: m.chatId,
        text: reply,
        metadata: { agent: AGENT_NAME, stage: "final" },
      });
    });
};

export interface MaxAgentDeps {
  readonly env: AppEnv;
}

export const makeMaxAgentBound =
  (deps: MaxAgentDeps): AgentFactory<never> =>
  (ctx) => {
    let phoneNumber: string | undefined = undefined;
    // Per-session memory for chat continuity
    const mem = new AxMemory();
    return (m) =>
      Effect.gen(function* () {
        const AGENT_NAME = "Max" as const;
        yield* Effect.annotateLogs({
          component: "MaxAgent",
          agent: AGENT_NAME,
          chatId: m.chatId,
          senderId: m.senderId,
        })(Effect.logInfo("received", m.text));
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

        const runtime2 = yield* Effect.runtime<never>();
        const startTypingHeartbeat = () => {
          let active = true;
          Runtime.runFork(
            runtime2,
            Effect.gen(function* () {
              while (active) {
                yield* ctx.send({
                  chatId: m.chatId,
                  text: ".",
                  metadata: {
                    telegramChatAction: "typing",
                    telegramChatActionOnly: true,
                    agent: AGENT_NAME,
                  },
                });
                yield* Effect.promise(
                  () => new Promise<void>((r) => setTimeout(r, 4000)),
                );
              }
            }),
          );
          return () => {
            active = false;
          };
        };

        const tools: AxFunction[] = [];
        const program = ax("message:string -> reply:string, toolPlan?:string", {
          functions: tools,
        });
        program.setDescription(
          [
            "You are Max, a fast, crisp assistant.",
            "Speak plainly without technical jargon.",
            "Never mention internal terms like entity, id, column, table, or database.",
            "Be concise. Prefer short sentences and tight bullet points.",
            "If multiple matches: show a few names and ask me to choose.",
            "If none: say you didn’t find it and suggest a precise next step.",
            "If one: show the name and a brief status/date if relevant.",
            "Respect privacy; if restricted, say you don’t have access.",
          ].join(" "),
        );
        const openaiKey = env.OPENAI_API_KEY;
        if (!openaiKey) {
          yield* ctx.send({
            chatId: m.chatId,
            text: "Missing OpenAI API key. Set OPENAI_API_KEY in .env or configure a provider.",
          });
          return;
        }
        const llm = ai({ name: "openai", apiKey: openaiKey });
        // Scope memory per Telegram chat
        program.setId(`max:telegram:${m.chatId}`);
        const out = yield* Effect.promise(() =>
          program.forward(
            llm,
            { message: m.text },
            {
              mem,
              sessionId: m.chatId,
            },
          ),
        );
        const reply = out.reply ?? "Done.";
        yield* ctx.send({
          chatId: m.chatId,
          text: reply,
          metadata: { agent: AGENT_NAME, stage: "final" },
        });
      });
  };
