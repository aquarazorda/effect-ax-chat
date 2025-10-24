import {
  boolean,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
  index,
} from "drizzle-orm/pg-core";
import { builderSchema } from "../creators";
import type {
  ActionId,
  EntityTypeId,
  EntityTypeVersionId,
  ColumnId,
} from "../../ids";

export const data_model_entity_type_version = builderSchema.table(
  "data_model_entity_type_version",
  {
    version_id: varchar("version_id")
      .$type<EntityTypeVersionId>()
      .notNull()
      .primaryKey(),
    id: varchar("id").$type<EntityTypeId>(),
    based_on: varchar("based_on"),
    version_major: integer("version_major"),
    version_minor: integer("version_minor"),
    version_patch: integer("version_patch"),
    columns: jsonb("columns"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    computed_from_id: varchar("computed_from_id"),
    computed_from_version_id: varchar("computed_from_version_id"),
    origin_version_id: varchar("origin_version_id"),
    is_preview: boolean("is_preview"),
    authorizations: jsonb("authorizations"),
    support_create_action_id: varchar(
      "support_create_action_id",
    ).$type<ActionId>(),
    support_update_action_id: varchar(
      "support_update_action_id",
    ).$type<ActionId>(),
    delete_action_id: varchar("delete_action_id").$type<ActionId>().notNull(),
    user_entity_type_version: integer("user_entity_type_version"),
    support_invite_action_id: varchar(
      "support_invite_action_id",
    ).$type<ActionId>(),
    primary_key_column_id: text("primary_key_column_id")
      .$type<ColumnId>()
      .notNull(),
    display_name_column_id: text("display_name_column_id")
      .$type<ColumnId>()
      .notNull(),
    status_column_id: text("status_column_id").$type<ColumnId>(),
    authorized_for_anyone_with_link: boolean("authorized_for_anyone_with_link")
      .notNull()
      .default(false),
    company_entity_type_version: integer("company_entity_type_version"),
    meetings_entity_type_version: integer("meetings_entity_type_version"),
    meetings_create_action_id: varchar("meetings_create_action_id"),
    meetings_start_action_id: varchar("meetings_start_action_id"),
    meetings_complete_action_id: varchar("meetings_complete_action_id"),
    meetings_cancel_action_id: varchar("meetings_cancel_action_id"),
    meetings_mark_no_show_action_id: varchar("meetings_mark_no_show_action_id"),
    profile_picture_column_id: varchar("profile_picture_column_id"),
    view_fields_order: jsonb("view_fields_order"),
  },
  (t) => [index("data_model_entity_type_version_id_idx").on(t.id)],
);
