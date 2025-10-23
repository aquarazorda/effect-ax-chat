import {
  integer,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { billing_tracking } from "../creators";

export const invoice = billing_tracking(
  "invoice",
  {
    id: varchar("id").notNull().primaryKey(),
    organization_id: text("organization_id").notNull(),
    external_id: text("external_id").notNull(),
    external_provider: text("external_provider").notNull(),
    payment_provider: text("payment_provider").notNull(),
    status: text("status").notNull(),
    paid_at: timestamp("paid_at", { withTimezone: true }),
    issued_at: timestamp("issued_at", { withTimezone: true }),
    voided_at: timestamp("voided_at", { withTimezone: true }),
    payment_failed_at: timestamp("payment_failed_at", { withTimezone: true }),
    amount_due: text("amount_due").notNull(),
    created_at: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    currency: text("currency").notNull(),
    due_date: timestamp("due_date", { withTimezone: true }),
    pdf: text("pdf"),
    invoice_number: text("invoice_number"),
    invoice_date: timestamp("invoice_date", { withTimezone: true }),
    invoice_type: text("invoice_type").notNull(),
    invoice_pdf_blob: text("invoice_pdf_blob"),
    invoice_pdf_url: text("invoice_pdf_url"),
  },
  (t) => [uniqueIndex("unique_invoice_external_id").on(t.external_id)],
);
