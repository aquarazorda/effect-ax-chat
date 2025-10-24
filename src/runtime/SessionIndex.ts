import { Context, Effect, Layer } from "effect";
import type { Session } from "./Session";

export interface SessionIndex<V> {
  readonly get: (k: string) => Effect.Effect<V | undefined>;
  readonly set: (k: string, v: V) => Effect.Effect<void>;
  readonly delete: (k: string) => Effect.Effect<void>;
}

export class SessionIndexTag extends Context.Tag("effect-ax/SessionIndex")<
  SessionIndexTag,
  SessionIndex<Session>
>() {}

export const makeInMemorySessionIndexLayer: Layer.Layer<SessionIndexTag> =
  Layer.effect(
    SessionIndexTag,
    Effect.succeed(
      (() => {
        const map = new Map<string, Session>();
        const get: SessionIndex<Session>["get"] = (k) =>
          Effect.sync(() => map.get(k));
        const set: SessionIndex<Session>["set"] = (k, v) =>
          Effect.sync(() => {
            map.set(k, v);
          });
        const del: SessionIndex<Session>["delete"] = (k) =>
          Effect.sync(() => {
            map.delete(k);
          });
        return { get, set, delete: del } satisfies SessionIndex<Session>;
      })(),
    ),
  );
