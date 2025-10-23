import { jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { billing_tracking } from "../creators";

export const billing_event_queue = billing_tracking("billing_event_queue", {
  event_name: text("event_name").notNull(),
  organization_id: varchar("organization_id").notNull(),
  meta: jsonb("meta").notNull(),
  event_id: varchar("event_id").notNull(),
  status: text("status").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  processed_at: timestamp("processed_at", { withTimezone: true }),
});
