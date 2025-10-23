import { expect, test } from "bun:test";
import {
  decodeAutomationTriggerConfig,
  decodeChainRunContextInputs,
  decodeChainRunInputs,
  decodeChainRunResult,
  decodeClerkData,
  decodeEmailData,
  decodeEmailRecipients,
  validateChainRunInputsForWrite,
} from "../src/db/jsonbCodecs";

test("chain run inputs round-trip", () => {
  const input = { a: 1, b: { c: "x" }, d: [1, 2, 3] } as const;
  const validated = validateChainRunInputsForWrite(input);
  const decoded = decodeChainRunInputs(validated);
  expect(decoded).toEqual(input);
});

test("chain run context inputs round-trip", () => {
  const ctx = { orgId: "org_1", flags: { preview: true } } as const;
  expect(decodeChainRunContextInputs(ctx)).toEqual(ctx);
});

test("chain run result accepts arbitrary JSON", () => {
  const result = { ok: true, data: [1, { k: "v" }] } as const;
  expect(decodeChainRunResult(result)).toEqual(result);
});

test("automation trigger config arbitrary JSON", () => {
  const cfg = { type: "cron", schedule: "0 * * * *" } as const;
  expect(decodeAutomationTriggerConfig(cfg)).toEqual(cfg);
});

test("email recipients - string and object forms", () => {
  const recipients = ["a@example.com", { email: "b@example.com", name: "B" }];
  expect(decodeEmailRecipients(recipients)).toEqual(recipients);
});

test("email data arbitrary JSON", () => {
  const data = { headers: { "x-id": "1" }, size: 123 } as const;
  expect(decodeEmailData(data)).toEqual(data);
});

test("clerk data arbitrary JSON", () => {
  const clerk = { externalId: "usr_123", attrs: { role: "admin" } } as const;
  expect(decodeClerkData(clerk)).toEqual(clerk);
});
