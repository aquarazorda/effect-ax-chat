import {
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { EmailId, ViewFieldId, ActionId, EntityId } from "../../ids";

export const action_draft_email_extracted_input = builder(
  "action_draft_email_extracted_input",
  {
    email_id: varchar("email_id").$type<EmailId>().notNull(),
    view_field_id: varchar("view_field_id").$type<ViewFieldId>().notNull(),
    action_id: varchar("action_id").$type<ActionId>().notNull(),
    draft_entity_id: varchar("draft_entity_id").$type<EntityId>().notNull(),
    version_type: varchar("version_type").notNull(),
    found_in_field: varchar("found_in_field").notNull(),
    start_char_index_inclusive: integer("start_char_index_inclusive").notNull(),
    end_char_index_exclusive: integer("end_char_index_exclusive").notNull(),
    parsed_value: jsonb("parsed_value").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("action_draft_email_extracted_input_pkey").on(
      t.action_id,
      t.draft_entity_id,
      t.version_type,
      t.view_field_id,
    ),
  ],
);
