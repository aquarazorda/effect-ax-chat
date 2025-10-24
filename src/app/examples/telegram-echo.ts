import { Effect, Layer, Logger, LogLevel, Stream, Context } from "effect";
import { AppEnvTag, makeEnvLayer } from "../../env";
import { makeTelegramClientLayer } from "../../clients/telegram/TelegramClient";
import { makeInMemoryMailboxFactoryLayer } from "../../runtime/Mailbox";
import { makeInMemorySessionIndexLayer } from "../../runtime/SessionIndex";
import { makeSessionRegistryLayer } from "../../runtime/SessionRegistry";
import { makeEchoAgent } from "../agents/EchoAgent";
import { ChatClientTag } from "../../clients/ChatClient";
import { SessionRegistryTag } from "../../runtime/SessionRegistry";

const program = Effect.gen(function* () {
  const env = yield* AppEnvTag;
  const token = env.TELEGRAM_TOKEN;
  if (!token) {
    yield* Effect.die(
      new Error(
        "Missing TELEGRAM_TOKEN in environment. Set it in .env to run the Telegram example.",
      ),
    );
  }

  const telegramLayer = makeTelegramClientLayer({
    botToken: token!,
    launchOptions: { dropPendingUpdates: true },
    // turn off once verified
    debugEcho: false,
  });

  const sessionRegistry = makeSessionRegistryLayer(
    {
      policy: {
        idleTtlMillis: 10 * 60_000,
        mailbox: { capacity: 1024, strategy: "bounded" },
      },
      getUserKey: (m) => ({ platform: "telegram", id: m.senderId }),
    },
    makeEchoAgent,
    Layer.succeedContext(Context.empty()),
  );

  // Provide registry's dependencies explicitly, then expose ChatHandler
  const baseDeps = Layer.mergeAll(
    telegramLayer,
    makeInMemoryMailboxFactoryLayer,
    makeInMemorySessionIndexLayer,
  );
  const registryLive = Layer.provide(baseDeps)(sessionRegistry);
  const layer = Layer.mergeAll(baseDeps, registryLive, Logger.pretty);

  yield* Effect.logInfo("starting telegram echo app");

  // Minimal router: connect client, route incoming via SessionRegistry
  const run = Effect.gen(function* () {
    const client = yield* ChatClientTag;
    const registry = yield* SessionRegistryTag;

    // connect first
    yield* client.connect;
    yield* Effect.logInfo("connected");

    // tap incoming to verify stream consumption
    const tapped = Stream.tap(client.incoming, (message) =>
      Effect.logInfo("stream got", message.text).pipe(
        Effect.annotateLogs({
          component: "ExampleRouter",
          chatId: message.chatId,
          senderId: message.senderId,
        }),
      ),
    );

    // run router
    yield* Effect.logInfo("start stream consumption");
    yield* Stream.runForEach(tapped, (message) =>
      Effect.gen(function* () {
        yield* Effect.annotateLogs({
          component: "ExampleRouter",
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
      }),
    )
      .pipe(Logger.withMinimumLogLevel(LogLevel.Debug))
      .pipe(Effect.scoped);
  });

  yield* run.pipe(Effect.provide(layer));
}).pipe(Effect.provide(makeEnvLayer));

// Run the example
Effect.runPromise(program).catch(() => {
  process.exit(1);
});
