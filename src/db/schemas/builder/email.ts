import { jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";

export const email = builder("email", {
  id: varchar("id").notNull().primaryKey(),
  from_user_id: varchar("from_user_id"),
  organization_id: varchar("organization_id").notNull(),
  from_user_entity_id: varchar("from_user_entity_id"),
  type: varchar("type").notNull(),
  message_id: varchar("message_id").notNull(),
  in_reply_to_message_id: varchar("in_reply_to_message_id"),
  references: varchar("references"),
  from_name: varchar("from_name"),
  from_email_address: varchar("from_email_address"),
  subject: varchar("subject"),
  body: text("body"),
  sent_to: jsonb("sent_to"),
  email_data: jsonb("email_data"),
  webhook_message_id: varchar("webhook_message_id"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  sent_cc: jsonb("sent_cc"),
  sent_bcc: jsonb("sent_bcc"),
  body_html: text("body_html").notNull(),
});

