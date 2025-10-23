import { boolean, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";

export const automation_rule = builder("automation_rule", {
  id: varchar("id").notNull().primaryKey(),
  organization_id: varchar("organization_id").notNull(),
  entity_type_id: varchar("entity_type_id").notNull(),
  state_id: varchar("state_id"),
  trigger_type: varchar("trigger_type").notNull(),
  trigger_config: jsonb("trigger_config").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  raw_description: text("raw_description"),
  instructions: text("instructions"),
  is_deleted: boolean("is_deleted").default(false).notNull(),
  action_id: varchar("action_id"),
});

