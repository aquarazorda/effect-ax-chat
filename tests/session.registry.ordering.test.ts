import { expect, test } from "bun:test";
import { Effect, Layer, Queue, Stream } from "effect";
import {
  ChatClientTag,
  type ChatClient,
  type OutgoingMessage,
} from "../src/clients/ChatClient";
import { makeInMemoryMailboxFactoryLayer } from "../src/runtime/Mailbox";
import { makeInMemorySessionIndexLayer } from "../src/runtime/SessionIndex";
import { makeSessionRegistryLayer } from "../src/runtime/SessionRegistry";
import { makeEchoAgent } from "../src/app/agents/EchoAgent";
import { SessionRegistryTag } from "../src/runtime/SessionRegistry";

test.todo(
  "preserves per-user ordering across sessions and allows concurrency",
  async () => {
    await Effect.runPromise(
      Effect.gen(function* () {
        // create out queue
        const outQ = yield* Queue.unbounded<OutgoingMessage>();
        // base deps that the registry needs
        const clientLayer = Layer.effect(
          ChatClientTag,
          Effect.succeed<ChatClient>({
            platform: "test",
            connect: Effect.succeed(undefined),
            disconnect: Effect.succeed(undefined),
            incoming: Stream.empty,
            send: (m) => Queue.offer(outQ, m).pipe(Effect.asVoid),
          }),
        );
        const baseDeps = Layer.mergeAll(
          clientLayer,
          makeInMemoryMailboxFactoryLayer,
          makeInMemorySessionIndexLayer,
        );
        const registryLive = Layer.provide(baseDeps)(
          makeSessionRegistryLayer(
            {
              policy: {
                idleTtlMillis: 60_000,
                mailbox: { capacity: 64, strategy: "bounded" },
              },
              getUserKey: (m) => ({ platform: "test", id: m.senderId }),
            },
            makeEchoAgent,
          ),
        );
        // run the rest with only SessionRegistryTag required
        yield* Effect.provide(registryLive)(
          Effect.gen(function* () {
            const outQ = yield* Queue.unbounded<OutgoingMessage>();

            // Client that writes outbound messages to outQ; incoming not used here
            // Using the registry directly within the provided environment
            const route = (senderId: string, text: string) =>
              Effect.flatMap(SessionRegistryTag, (r) =>
                r.route({
                  chatId: "c",
                  senderId,
                  text,
                  receivedAt: new Date(),
                }),
              );

            // Two users A and B with interleaved messages
            yield* route("A", "A1");
            yield* route("B", "B1");
            yield* route("A", "A2");
            yield* route("B", "B2");

            // Collect four outgoing echo messages
            const outs: OutgoingMessage[] = [];
            // small yield to allow processing
            yield* Effect.sleep(100);
            const takeWithTimeout = Queue.take(outQ).pipe(
              Effect.timeoutFail({
                duration: 3000,
                onTimeout: () => new Error("timeout"),
              }),
            );
            outs.push(yield* takeWithTimeout);
            outs.push(yield* takeWithTimeout);
            outs.push(yield* takeWithTimeout);
            outs.push(yield* takeWithTimeout);

            // Filter by sender using reply text; order must be preserved per user
            const a = outs.filter((o) => o.text.includes("A"));
            const b = outs.filter((o) => o.text.includes("B"));
            expect(a.map((x) => x.text)).toEqual([
              "You said: A1",
              "You said: A2",
            ]);
            expect(b.map((x) => x.text)).toEqual([
              "You said: B1",
              "You said: B2",
            ]);
          }),
        );
      }),
    );
  },
);
