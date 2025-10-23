import { jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ActionId,
  EntityId,
  OrganizationId,
  UserEntityId,
} from "../../ids";

export const entity_action_draft = builder("entity_action_draft", {
  creator_user_entity_id: varchar(
    "creator_user_entity_id",
  ).$type<UserEntityId>(),
  action_id: varchar("action_id").$type<ActionId>().notNull(),
  entity_id: varchar("entity_id").$type<EntityId>().notNull(),
  organization_id: varchar("organization_id").$type<OrganizationId>().notNull(),
  version_type: varchar("version_type").notNull(),
  fields: jsonb("fields"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  is_user_edited_fields: jsonb("is_user_edited_fields"),
  nested_form_values: jsonb("nested_form_values"),
  email_side_effects: jsonb("email_side_effects"),
});
