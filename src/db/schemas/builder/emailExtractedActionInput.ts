import { integer, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { ActionLogId, EmailId, ViewFieldId } from "../../ids";

export const email_extracted_action_input = builder(
  "email_extracted_action_input",
  {
    email_id: varchar("email_id").$type<EmailId>().notNull(),
    view_field_id: varchar("view_field_id").$type<ViewFieldId>().notNull(),
    action_log_id: varchar("action_log_id").$type<ActionLogId>().notNull(),
    found_in_field: varchar("found_in_field").notNull(),
    start_char_index_inclusive: integer("start_char_index_inclusive").notNull(),
    end_char_index_exclusive: integer("end_char_index_exclusive").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("email_extracted_action_input_pkey").on(
      t.action_log_id,
      t.view_field_id,
    ),
  ],
);
