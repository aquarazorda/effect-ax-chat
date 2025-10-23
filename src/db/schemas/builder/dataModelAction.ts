import {
  boolean,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ActionId,
  ActionVersionId,
  ApplicationGroupId,
  EntityTypeId,
  OrganizationId,
} from "../../ids";

export const data_model_action = builder("data_model_action", {
  version_id: varchar("version_id")
    .$type<ActionVersionId>()
    .notNull()
    .primaryKey(),
  id: varchar("id").$type<ActionId>(),
  based_on: varchar("based_on"),
  version_major: integer("version_major"),
  version_minor: integer("version_minor"),
  version_patch: integer("version_patch"),
  application_group_id: varchar(
    "application_group_id",
  ).$type<ApplicationGroupId>(),
  action_definition: jsonb("action_definition"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  name: varchar("name").notNull(),
  description: varchar("description"),
  computed_from_id: varchar("computed_from_id"),
  computed_from_version_id: varchar("computed_from_version_id"),
  origin_version_id: varchar("origin_version_id"),
  is_preview: boolean("is_preview"),
  entity_type_id: varchar("entity_type_id").$type<EntityTypeId>(),
  organization_id: varchar("organization_id").$type<OrganizationId>(),
  action_type: text("action_type").notNull(),
  to_state: text("to_state"),
  authorized_for_anyone_with_link: boolean("authorized_for_anyone_with_link"),
  inputs: jsonb("inputs").notNull(),
  contextual_fields: jsonb("contextual_fields").notNull(),
  from_states: jsonb("from_states"),
  side_effects: jsonb("side_effects"),
});
