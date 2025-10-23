import { jsonb, text, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { ActionId, EntityTypeVersionId, FieldGroupId } from "../../ids";

export const field_group = builder("field_group", {
  id: varchar("id").$type<FieldGroupId>().notNull().primaryKey(),
  entity_type_version_id: varchar("entity_type_version_id")
    .$type<EntityTypeVersionId>()
    .notNull(),
  name: varchar("name").notNull(),
  description: varchar("description"),
  fields: jsonb("fields").notNull(),
  support_create_action_id: varchar(
    "support_create_action_id",
  ).$type<ActionId>(),
  support_update_action_id: varchar(
    "support_update_action_id",
  ).$type<ActionId>(),
  state_id: text("state_id"),
});
