import { integer, timestamp, varchar, index } from "drizzle-orm/pg-core";
import { billing_tracking } from "../creators";

export const usage_metrics = billing_tracking(
  "usage_metrics",
  {
    organization_id: varchar("organization_id").notNull().primaryKey(),
    seats_count: integer("seats_count").notNull(),
    edit_permission_users_count: integer(
      "edit_permission_users_count",
    ).notNull(),
    process_entities_count: integer("process_entities_count").notNull(),
    support_entities_count: integer("support_entities_count").notNull(),
    columns_count: integer("columns_count").notNull(),
    relations_count: integer("relations_count").notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("usage_metrics_organization_id_idx").on(t.organization_id)],
);
