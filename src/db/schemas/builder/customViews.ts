import {
  index,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ActionId,
  CustomViewId,
  EntityTypeId,
  FieldGroupId,
  StateId,
} from "../../ids";

export const custom_views = builder(
  "custom_views",
  {
    id: varchar("id").$type<CustomViewId>().notNull().primaryKey(),
    // Enum in DB (public.CustomViewType)
    type: varchar("type").notNull(),
    name: varchar("name", { length: 255 }),
    description: text("description"),
    content: jsonb("content").notNull(),
    settings: jsonb("settings"),
    action_id: varchar("action_id").$type<ActionId>(),
    entity_type_id: varchar("entity_type_id").$type<EntityTypeId>(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    state_id: varchar("state_id").$type<StateId>(),
    field_group_id: varchar("field_group_id").$type<FieldGroupId>(),
  },
  (t) => [
    uniqueIndex("idx_custom_view_action_id").on(t.action_id),
    index("idx_custom_view_entity_type_id").on(t.entity_type_id),
    index("idx_custom_views_action_entity").on(t.action_id, t.entity_type_id),
    index("idx_custom_views_entity_state").on(t.entity_type_id, t.state_id),
  ],
);
