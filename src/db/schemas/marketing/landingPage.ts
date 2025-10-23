import { boolean, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { marketing } from "../creators";

export const landing_page = marketing("landing_page", {
  id: varchar("id").notNull().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  content: jsonb("content").notNull(),
  app_generation_input: text("app_generation_input").notNull(),
  published: boolean("published"),
  published_at: timestamp("published_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  keywords: text("keywords").array(),
  industry_id: varchar("industry_id").notNull(),
  vertical_id: varchar("vertical_id").notNull(),
  description: text("description"),
});
