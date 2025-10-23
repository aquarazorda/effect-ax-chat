import { text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { billing_tracking } from "../creators";

export const customer = billing_tracking(
  "customer",
  {
    id: varchar("id").notNull().primaryKey(),
    organization_id: varchar("organization_id").notNull(),
    external_id: varchar("external_id").notNull(),
    external_provider: varchar("external_provider").notNull(),
    payment_provider: varchar("payment_provider"),
    status: varchar("status").notNull(),
  },
  (t) => [
    uniqueIndex("unique_customer_external_id").on(t.external_id),
    uniqueIndex("unique_org_provider").on(
      t.organization_id,
      t.external_provider,
    ),
  ],
);
