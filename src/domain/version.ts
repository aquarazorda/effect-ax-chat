import * as S from "effect/Schema";

// Keep VersionType flexible but branded for type safety
export const VersionTypeSchema = S.String.pipe(S.brand("VersionType"));
export type VersionType = typeof VersionTypeSchema.Type;
