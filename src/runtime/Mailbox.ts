import { Context, Effect, Layer, Queue } from "effect";
import { IncomingMessageSchema } from "../clients/MessageSchemas";
import type { UserKey } from "./UserKey";

export interface Mailbox<A> {
  readonly offer: (a: A) => Effect.Effect<void>;
  readonly take: Effect.Effect<A>;
  readonly shutdown: Effect.Effect<void>;
}

export interface MailboxPolicy {
  readonly capacity: number; // 0 => unbounded
  readonly strategy: "unbounded" | "bounded" | "sliding" | "dropping";
}

export interface MailboxFactory<A> {
  readonly create: (
    key: UserKey,
    policy: MailboxPolicy,
  ) => Effect.Effect<Mailbox<A>>;
}

export class MailboxFactoryTag extends Context.Tag("effect-ax/MailboxFactory")<
  MailboxFactoryTag,
  MailboxFactory<typeof IncomingMessageSchema.Type>
>() {}

// In-memory MailboxFactory, wrapping Effect Queue
export const makeInMemoryMailboxFactoryLayer: Layer.Layer<MailboxFactoryTag> =
  Layer.effect(
    MailboxFactoryTag,
    Effect.succeed({
      create: (_key, policy) =>
        Effect.gen(function* () {
          const queue: Queue.Queue<typeof IncomingMessageSchema.Type> =
            yield* makeQueue<typeof IncomingMessageSchema.Type>(policy);
          const mailbox: Mailbox<typeof IncomingMessageSchema.Type> = {
            offer: (a) => Queue.offer(queue, a).pipe(Effect.asVoid),
            take: Queue.take(queue),
            shutdown: Queue.shutdown(queue).pipe(Effect.asVoid),
          };
          return mailbox;
        }),
    }),
  );

const makeQueue = <A>(policy: MailboxPolicy) =>
  policy.strategy === "unbounded"
    ? (Queue.unbounded<A>())
    : policy.strategy === "bounded"
      ? Queue.bounded<A>(policy.capacity)
      : policy.strategy === "sliding"
        ? Queue.sliding<A>(policy.capacity)
        : Queue.dropping<A>(policy.capacity);
