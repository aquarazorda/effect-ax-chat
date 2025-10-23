import { jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { OnboardingSessionId, OrganizationId, UserId } from "../../ids";

export const onboarding_session = builder("onboarding_session", {
  id: varchar("id").$type<OnboardingSessionId>().notNull().primaryKey(),
  user_id: varchar("user_id").$type<UserId>().notNull(),
  state: jsonb("state"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  organization_id: varchar("organization_id").$type<OrganizationId>(),
});
