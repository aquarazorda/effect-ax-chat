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
  ApplicationGroupId,
  EntityTypeId,
  StateId,
  StateMachineMetadataId,
  StateMachineMetadataVersionId,
} from "../../ids";

export const state_machine_metadata = builder("state_machine_metadata", {
  version_id: varchar("version_id")
    .$type<StateMachineMetadataVersionId>()
    .notNull()
    .primaryKey(),
  id: varchar("id").$type<StateMachineMetadataId>(),
  based_on: varchar("based_on"),
  version_major: integer("version_major"),
  version_minor: integer("version_minor"),
  version_patch: integer("version_patch"),
  application_group_id: varchar(
    "application_group_id",
  ).$type<ApplicationGroupId>(),
  process_state_machine_playbook: jsonb("process_state_machine_playbook"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  computed_from_id: varchar("computed_from_id"),
  computed_from_version_id: varchar("computed_from_version_id"),
  origin_version_id: varchar("origin_version_id"),
  is_preview: boolean("is_preview"),
  happy_path: text("happy_path").array().notNull(),
  data_model_target_entity_type_id: text("data_model_target_entity_type_id")
    .$type<EntityTypeId>()
    .notNull(),
  initial_state_state_id: text("initial_state_state_id")
    .$type<StateId>()
    .notNull(),
  initial_state_action_id: text("initial_state_action_id")
    .$type<ActionId>()
    .notNull(),
});
