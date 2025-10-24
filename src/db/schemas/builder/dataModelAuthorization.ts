import { boolean, index, jsonb, text, varchar } from "drizzle-orm/pg-core";
import { builderSchema } from "../creators";
import type {
  ActionVersionId,
  EntityTypeVersionId,
  OrganizationId,
} from "../../ids";

export const data_model_authorization = builderSchema.table(
  "data_model_authorization",
  {
    organization_id: varchar("organization_id")
      .$type<OrganizationId>()
      .notNull(),
    authorize_read_on_entities_of_type_version_id: varchar(
      "authorize_read_on_entities_of_type_version_id",
    ).$type<EntityTypeVersionId>(),
    authorize_execute_on_action_version_id: varchar(
      "authorize_execute_on_action_version_id",
    ).$type<ActionVersionId>(),
    authorized_by_relation_path: jsonb("authorized_by_relation_path"),
    relation_path_user_type_filters: jsonb("relation_path_user_type_filters"),
    relation_path_starting_entity_type_id: varchar(
      "relation_path_starting_entity_type_id",
    ),
    relation_path_starting_entity_type_filters: jsonb(
      "relation_path_starting_entity_type_filters",
    ),
    authorized_for_anyone_with_link: boolean("authorized_for_anyone_with_link")
      .notNull()
      .default(false),
    authorize_activity_log: boolean("authorize_activity_log")
      .notNull()
      .default(false),
    authorize_read_on_entities_per_field_group_id: text(
      "authorize_read_on_entities_per_field_group_id",
    ),
  },
  (t) => [
    index("data_model_authorization_actv_idx").on(
      t.authorize_execute_on_action_version_id,
    ),
    index("data_model_authorization_etv_idx").on(
      t.authorize_read_on_entities_of_type_version_id,
    ),
  ],
);
