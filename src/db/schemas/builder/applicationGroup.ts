import { text, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";

export const application_group = builder("application_group", {
  id: varchar("id").notNull().primaryKey(),
  name: varchar("name"),
  description: varchar("description"),
  user_id: varchar("user_id"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  emoji: text("emoji"),
  organization_id: varchar("organization_id"),
  color: text("color"),
});

