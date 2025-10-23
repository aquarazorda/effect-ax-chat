import * as S from "effect/Schema";

// Keep JSONB schemas permissive to start; refine incrementally.
export const JsonRecordSchema = S.Record({ key: S.String, value: S.Unknown });

export const ClerkDataSchema = JsonRecordSchema; // auth.organization.clerk_data
export const ChainInputsSchema = JsonRecordSchema; // builder.chain_run_table.inputs
export const ChainResultSchema = JsonRecordSchema; // builder.chain_run_table.result
