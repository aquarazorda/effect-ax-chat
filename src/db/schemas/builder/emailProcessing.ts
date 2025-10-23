import {
  boolean,
  index,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  EmailId,
  EmailProcessingId,
  MessageId,
  OrganizationId,
  UserId,
} from "../../ids";

export const email_processing = builder(
  "email_processing",
  {
    id: text("id").$type<EmailProcessingId>().notNull().primaryKey(),
    organization_id: text("organization_id").$type<OrganizationId>().notNull(),
    user_id: text("user_id").$type<UserId>().notNull(),
    email_id: text("email_id").$type<EmailId>().notNull(),
    message_id: text("message_id").$type<MessageId>().notNull(),
    processing_status: text("processing_status").notNull(),
    processing_error: text("processing_error"),
    action_executed: boolean("action_executed").notNull().default(false),
    action_id: text("action_id"),
    entity_type_id: text("entity_type_id"),
    entity_id: text("entity_id"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_email_processing_unique_message_id").on(t.message_id),
    index("idx_email_processing_organization_id").on(t.organization_id),
  ],
);
