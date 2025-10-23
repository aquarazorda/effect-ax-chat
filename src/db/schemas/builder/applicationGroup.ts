import { text, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { ApplicationGroupId, OrganizationId, UserId } from "../../ids";

export const application_group = builder("application_group", {
  id: varchar("id").$type<ApplicationGroupId>().notNull().primaryKey(),
  name: varchar("name"),
  description: varchar("description"),
  user_id: varchar("user_id").$type<UserId>(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  emoji: text("emoji"),
  organization_id: varchar("organization_id").$type<OrganizationId>(),
  color: text("color"),
});
