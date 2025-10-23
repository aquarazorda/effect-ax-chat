import { text, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  AthenaOnboardingStateId,
  OrganizationId,
  UserId,
} from "../../ids";

export const athena_onboarding_state = builder("athena_onboarding_state", {
  id: varchar("id").$type<AthenaOnboardingStateId>().notNull().primaryKey(),
  // Enum in DB (public.AthenaOnboardingStatus); model as text for compatibility
  type: varchar("type").notNull(),
  phone_number: varchar("phone_number").notNull(),
  initial_message: text("initial_message").notNull(),
  code: varchar("code"),
  user_id: varchar("user_id").$type<UserId>(),
  organization_id: varchar("organization_id").$type<OrganizationId>(),
  completed_at: timestamp("completed_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
