import { boolean, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { CategoryId, OrganizationId } from "../../ids";

export const category = builder("category", {
  id: varchar("id").$type<CategoryId>().notNull().primaryKey(),
  name: varchar("name").notNull(),
  display_order: integer("display_order").notNull().default(0),
  is_default: boolean("is_default").notNull().default(false),
  organization_id: varchar("organization_id").$type<OrganizationId>().notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
