import * as S from "effect/Schema";

// Recursive JSON type and schema: null | boolean | number | string | Json[] | { [k: string]: Json }
export type Json =
  | null
  | boolean
  | number
  | string
  | ReadonlyArray<Json>
  | { readonly [k: string]: Json };

export const JsonSchema: S.Schema<any, any, never> = S.suspend(
  () =>
    S.Union(
      S.Null,
      S.Boolean,
      S.Number,
      S.String,
      S.Array(JsonSchema),
      S.Record({ key: S.String, value: JsonSchema }),
    ),
);
