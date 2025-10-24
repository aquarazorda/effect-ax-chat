import { Effect, Layer, Logger, LogLevel, Stream } from "effect";
import { AppEnvTag, makeEnvLayer, makeDbConfigFromEnvLayer } from "../../env";
import { makeTelegramClientLayer } from "../../clients/telegram/TelegramClient";
import { makeInMemoryMailboxFactoryLayer } from "../../runtime/Mailbox";
import { makeInMemorySessionIndexLayer } from "../../runtime/SessionIndex";
import {
  makeSessionRegistryLayer,
  SessionRegistryTag,
} from "../../runtime/SessionRegistry";
import { ChatClientTag } from "../../clients/ChatClient";
import { makeMaxAgent } from "../agents/MaxAgent";
import type { AgentFactory } from "../../runtime/Session";
import { makeBuilderDbLayer, makeOrgDbResolverLayer } from "../../db/connect";
import { makeAuthorizationServiceLayer } from "../../permissions/Authorization";
import { makePermissionEngineLayer } from "../../permissions/PermissionEngine";
import { makeLinkTokenVerifierLayer } from "../../permissions/LinkToken";
import { makeUserEntityResolverLayer } from "../../services/UserEntityResolver";
import { makeEntityTypeCatalogLayer } from "../../services/EntityTypeCatalog";
import { makeOrgEntityStoreLayer } from "../../services/OrgEntityStore";

// Add DB/service layers to support catalog + org store
// No catalog/store layers wired for bound MVP

const program = Effect.gen(function* () {
  const env = yield* AppEnvTag;
  const telegramLayer = makeTelegramClientLayer({
    botToken: env.TELEGRAM_TOKEN,
    launchOptions: { dropPendingUpdates: true },
    debugEcho: false,
  });

  // Build agent deps layer (env + data + permissions). Provide dependencies so
  // DbConfig is internal and not part of outward context.
  const envL = makeEnvLayer;
  const dbConfigL = Layer.provide(envL)(makeDbConfigFromEnvLayer);
  const builderDbL = Layer.provide(Layer.mergeAll(envL, dbConfigL))(makeBuilderDbLayer);
  const orgResolverL = Layer.provide(Layer.mergeAll(builderDbL, envL))(makeOrgDbResolverLayer);
  const authorizationL = Layer.provide(builderDbL)(makeAuthorizationServiceLayer);
  const userResolverL = Layer.provide(builderDbL)(makeUserEntityResolverLayer);
  const entityCatalogL = Layer.provide(builderDbL)(makeEntityTypeCatalogLayer);
  const orgStoreL = Layer.provide(Layer.mergeAll(orgResolverL, builderDbL))(makeOrgEntityStoreLayer);
  // Permission engine has no deps; link token verifier no deps
  const agentDeps = Layer.mergeAll(
    envL,
    builderDbL,
    orgResolverL,
    authorizationL,
    makeLinkTokenVerifierLayer,
    userResolverL,
    makePermissionEngineLayer,
    entityCatalogL,
    orgStoreL,
  );

  const sessionRegistry = makeSessionRegistryLayer(
    {
      policy: {
        idleTtlMillis: 10 * 60_000,
        mailbox: { capacity: 1024, strategy: "bounded" },
      },
      getUserKey: (m) => ({ platform: "telegram", id: m.senderId }),
    },
    makeMaxAgent,
    agentDeps,
  );

  // Base deps
  const baseDeps = Layer.mergeAll(
    telegramLayer,
    makeInMemoryMailboxFactoryLayer,
    makeInMemorySessionIndexLayer,
  );

  const registryLive = Layer.provide(baseDeps)(sessionRegistry);

  yield* Effect.logInfo("starting telegram max app");

  const run = Effect.gen(function* () {
    const client = yield* ChatClientTag;
    yield* Effect.logInfo("got ChatClientTag");
    const registry = yield* SessionRegistryTag;
    yield* Effect.logInfo("got SessionRegistryTag");

    // Start connect in the background so we don't block stream setup
    yield* Effect.forkDaemon(
      client.connect.pipe(
        Effect.tap(() => Effect.logInfo("connected")),
        Effect.tapError((e) => Effect.logError("connect error", e)),
      ),
    );
    yield* Effect.logInfo("connect started");

    const tapped = Stream.tap(client.incoming, (message) =>
      Effect.logInfo("stream got", message.text).pipe(
        Effect.annotateLogs({
          component: "MaxRouter",
          chatId: message.chatId,
          senderId: message.senderId,
        }),
      ),
    );

    yield* Effect.logInfo("start stream consumption");
    yield* Stream.runForEach(tapped, (message) =>
      Effect.gen(function* () {
        yield* Effect.annotateLogs({
          component: "MaxRouter",
          chatId: message.chatId,
          senderId: message.senderId,
        })(Effect.logInfo("router got", message.text));
        yield* registry.route({
          chatId: message.chatId,
          senderId: message.senderId,
          text: message.text,
          receivedAt: message.receivedAt,
          metadata: message.metadata,
        });
      }).pipe(Effect.tapError((e) => Effect.logError("route error", e))),
    )
      .pipe(Logger.withMinimumLogLevel(LogLevel.Debug))
      .pipe(Effect.scoped)
      .pipe(Effect.catchAll((e) => Effect.logError("stream error", e)));
  });

  const layer = Layer.mergeAll(baseDeps, registryLive, Logger.pretty);
  yield* run.pipe(Effect.provide(layer));
}).pipe(Effect.provide(makeEnvLayer));

Effect.runPromise(program).catch(() => {
  process.exit(1);
});
