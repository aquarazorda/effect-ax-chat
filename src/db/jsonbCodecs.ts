import * as S from "effect/Schema";
import {
  AutomationTriggerConfigSchema,
  ChainRunContextInputsSchema,
  ChainRunInputsSchema,
  ChainRunResultSchema,
  ClerkDataSchema,
  EmailDataSchema,
  EmailRecipientsSchema,
} from "./jsonbSchemas";

// Small helpers to validate JSONB payloads at boundaries.

const makeDecoder = <A>(schema: S.Schema<A>) =>
  S.decodeUnknownSync(schema);

export const decodeChainRunInputs = makeDecoder(ChainRunInputsSchema);
export const decodeChainRunContextInputs = makeDecoder(
  ChainRunContextInputsSchema,
);
export const decodeChainRunResult = makeDecoder(ChainRunResultSchema);

export const decodeAutomationTriggerConfig = makeDecoder(
  AutomationTriggerConfigSchema,
);

export const decodeEmailRecipients = makeDecoder(EmailRecipientsSchema);
export const decodeEmailData = makeDecoder(EmailDataSchema);

export const decodeClerkData = makeDecoder(ClerkDataSchema);

// For writes, we validate the outgoing value and return it typed
export const validateChainRunInputsForWrite = decodeChainRunInputs;
export const validateChainRunContextInputsForWrite = decodeChainRunContextInputs;
export const validateChainRunResultForWrite = decodeChainRunResult;
export const validateAutomationTriggerConfigForWrite =
  decodeAutomationTriggerConfig;
export const validateEmailRecipientsForWrite = decodeEmailRecipients;
export const validateEmailDataForWrite = decodeEmailData;
export const validateClerkDataForWrite = decodeClerkData;

