import { index, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ActionId,
  ActionLogId,
  ActionVersionId,
  EmailId,
  EntityId,
  EntityTypeId,
  EntityTypeVersionId,
  UserEntityId,
  UserId,
} from "../../ids";

export const action_log = builder(
  "action_log",
  {
    id: varchar("id").$type<ActionLogId>().notNull().primaryKey(),
    entity_id: varchar("entity_id").$type<EntityId>().notNull(),
    action_id: varchar("action_id").$type<ActionId>(),
    action_version_id: varchar("action_version_id").$type<ActionVersionId>(),
    inputs: jsonb("inputs"),
    user_id: varchar("user_id").$type<UserId>(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    ai_persona_id: text("ai_persona_id"),
    comment: text("comment"),
    entity_type_id: varchar("entity_type_id").$type<EntityTypeId>().notNull(),
    entity_type_version_id: varchar("entity_type_version_id")
      .$type<EntityTypeVersionId>()
      .notNull(),
    entity_snapshot_before_action: jsonb("entity_snapshot_before_action"),
    entity_snapshot_after_action: jsonb("entity_snapshot_after_action"),
    email_id: varchar("email_id").$type<EmailId>(),
    relation_version_ids: jsonb("relation_version_ids"),
    user_entity_id: varchar("user_entity_id").$type<UserEntityId>(),
    sent_email_ids: jsonb("sent_email_ids"),
  },
  (t) => [
    index("idx__action_log__email_id").on(t.email_id),
    index("idx_action_log_entity_id").on(t.entity_id),
  ],
);
