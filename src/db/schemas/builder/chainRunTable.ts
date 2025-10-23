import { boolean, integer, jsonb, numeric, text, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { builder } from "../creators";

export const chain_run_table = builder(
  "chain_run_table",
  {
    id: varchar("id").notNull().primaryKey(),
    thread_id: text("thread_id").notNull(),
    thread_name: text("thread_name").notNull(),
    chain_name: text("chain_name").notNull(),
    inputs: jsonb("inputs").notNull(),
    context_inputs: jsonb("context_inputs"),
    formatted_prompt: text("formatted_prompt"),
    duration: numeric("duration"),
    result_type: text("result_type"),
    result: jsonb("result"),
    error: text("error"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    total_tokens: integer("total_tokens"),
    autohealed: boolean("autohealed"),
    organization_id: varchar("organization_id"),
    user_id: varchar("user_id"),
    application_group_id: varchar("application_group_id"),
    entity_type_id: varchar("entity_type_id"),
    entity_id: varchar("entity_id"),
    column_id: varchar("column_id"),
    relation_id: varchar("relation_id"),
    model: varchar("model"),
    prompt_tokens: integer("prompt_tokens"),
    completion_tokens: integer("completion_tokens"),
    cache_key: text("cache_key"),
    was_cached: boolean("was_cached").default(false),
    cached_input_tokens: integer("cached_input_tokens").default(0),
  },
  (t) => [index("chain_run_table_cache_key_idx").on(t.cache_key)],
);

