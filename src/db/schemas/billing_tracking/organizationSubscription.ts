import {
  boolean,
  integer,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { billing_tracking } from "../creators";

export const organization_subscription = billing_tracking(
  "organization_subscription",
  {
    id: varchar("id").notNull().primaryKey(),
    organization_id: varchar("organization_id").notNull(),
    external_plan_id: varchar("external_plan_id").notNull(),
    status: varchar("status").notNull(),
    auto_collection: boolean("auto_collection").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    start_date: timestamp("start_date", { withTimezone: true }).defaultNow(),
    end_date: timestamp("end_date", { withTimezone: true }),
    trial_end_date: timestamp("trial_end_date", { withTimezone: true }),
    trial_extended: boolean("trial_extended").notNull(),
    net_terms: integer("net_terms"),
    external_id: varchar("external_id").notNull(),
    external_provider: varchar("external_provider").notNull(),
    redeemed_coupon_id: varchar("redeemed_coupon_id"),
    plan_name: varchar("plan_name").notNull(),
  },
  (t) => [
    uniqueIndex("unique_subscription_created_at").on(
      t.external_id,
      t.created_at,
    ),
    uniqueIndex("unique_subscription_external_id").on(t.external_id),
  ],
);
