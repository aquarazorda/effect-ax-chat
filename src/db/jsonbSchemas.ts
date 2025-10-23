import * as S from "effect/Schema";
import { JsonSchema } from "./json";

// Chain runs
export const ChainRunInputsSchema = S.Record({
  key: S.String,
  value: JsonSchema,
});
export type ChainRunInputs = typeof ChainRunInputsSchema.Type;

export const ChainRunContextInputsSchema = S.Record({
  key: S.String,
  value: JsonSchema,
});
export type ChainRunContextInputs = typeof ChainRunContextInputsSchema.Type;

export const ChainRunResultSchema = JsonSchema;
export type ChainRunResult = typeof ChainRunResultSchema.Type;

// Automation rule
export const AutomationTriggerConfigSchema = JsonSchema;
export type AutomationTriggerConfig = typeof AutomationTriggerConfigSchema.Type;

// Email recipients: array of strings or objects with { email, name? }
export const EmailRecipientSchema = S.Union(
  S.Struct({ email: S.String, name: S.optional(S.String) }),
  S.String,
);
export type EmailRecipient = typeof EmailRecipientSchema.Type;

export const EmailRecipientsSchema = S.Array(EmailRecipientSchema);
export type EmailRecipients = typeof EmailRecipientsSchema.Type;

export const EmailDataSchema = JsonSchema;
export type EmailData = typeof EmailDataSchema.Type;

// Clerk data
export const ClerkDataSchema = JsonSchema;
export type ClerkData = typeof ClerkDataSchema.Type;
