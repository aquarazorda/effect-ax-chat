import { expect, test } from "bun:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { dbSchema } from "../src/db/schema";
import {
  validateChainRunInputsForWrite,
  decodeChainRunInputs,
} from "../src/db/jsonbCodecs";
import * as S from "effect/Schema";
import { ChainRunIdSchema } from "../src/db/ids";
import { eq } from "drizzle-orm";

// Minimal DDL for builder.chain_run_table
const DDL = `
CREATE SCHEMA IF NOT EXISTS builder;
CREATE TABLE IF NOT EXISTS builder.chain_run_table (
  id varchar PRIMARY KEY,
  thread_id text NOT NULL,
  thread_name text NOT NULL,
  chain_name text NOT NULL,
  inputs jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
`;

test("insert/select builder.chain_run_table with JSONB", async () => {
  const client = new PGlite();
  await client.exec(DDL);
  const db = drizzlePglite(client, { schema: dbSchema });

  const payload = { foo: "bar", nested: { x: 1 } };
  const id = S.decodeUnknownSync(ChainRunIdSchema)("run_1");

  await db.insert(dbSchema.chain_run_table).values({
    id,
    thread_id: "t1",
    thread_name: "Thread 1",
    chain_name: "test_chain",
    inputs: validateChainRunInputsForWrite(payload),
  });

  const rows = await db
    .select()
    .from(dbSchema.chain_run_table)
    .where(eq(dbSchema.chain_run_table.id, id));

  expect(rows.length).toBe(1);
  expect(decodeChainRunInputs(rows[0]!.inputs)).toEqual(payload);
});
