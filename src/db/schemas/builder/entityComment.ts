import { index, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { EntityCommentId, EntityId, UserId } from "../../ids";

export const entity_comment = builder(
  "entity_comment",
  {
    id: varchar("id").$type<EntityCommentId>().notNull().primaryKey(),
    entity_id: varchar("entity_id").$type<EntityId>().notNull(),
    comment_text: text("comment_text").notNull(),
    author: varchar("author").$type<UserId>(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    ai_persona_id: text("ai_persona_id"),
    deleted_at: timestamp("deleted_at", { withTimezone: true }),
    parent_comment_id: varchar("parent_comment_id").$type<EntityCommentId>(),
  },
  (t) => [
    index("idx_entity_comment_entity_deleted").on(t.entity_id, t.deleted_at),
  ],
);
