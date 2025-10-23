import { Context, Effect } from "effect";
import type { DbError } from "./tags";

export interface DbHealth {
  readonly checkBuilder: Effect.Effect<void, DbError>;
  readonly checkOrg: (id: string) => Effect.Effect<void, DbError>;
}

export class DbHealthTag extends Context.Tag("effect-ax/DbHealth")<
  DbHealthTag,
  DbHealth
>() {}
