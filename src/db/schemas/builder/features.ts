import { jsonb, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ActionId,
  ApplicationGroupId,
  ColumnId,
  EntityTypeId,
  FeatureId,
  FeatureSuggestionsRunId,
  OrganizationId,
  RelationId,
  StateId,
  UserId,
  WorkspaceVersionId,
} from "../../ids";

export const features = builder("features", {
  id: varchar("id").$type<FeatureId>().notNull().primaryKey(),
  client_description: varchar("client_description").notNull(),
  internal_description: varchar("internal_description"),
  created_by_user_id: varchar("created_by_user_id").$type<UserId>(),
  suggestion_run_id:
    varchar("suggestion_run_id").$type<FeatureSuggestionsRunId>(),
  based_on_feature_suggestion_run_id: varchar(
    "based_on_feature_suggestion_run_id",
  ).$type<FeatureSuggestionsRunId>(),
  based_on_workspace_version_id: varchar("based_on_workspace_version_id")
    .$type<WorkspaceVersionId>()
    .notNull(),
  ctx_type: varchar("ctx_type").notNull(),
  ctx_organization_id: varchar("ctx_organization_id")
    .$type<OrganizationId>()
    .notNull(),
  ctx_application_group_id: varchar(
    "ctx_application_group_id",
  ).$type<ApplicationGroupId>(),
  ctx_entity_type_id: varchar("ctx_entity_type_id").$type<EntityTypeId>(),
  ctx_action_id: varchar("ctx_action_id").$type<ActionId>(),
  ctx_state_id: varchar("ctx_state_id").$type<StateId>(),
  ctx_column_id: varchar("ctx_column_id").$type<ColumnId>(),
  ctx_relation_id: varchar("ctx_relation_id").$type<RelationId>(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  metadata: jsonb("metadata"),
});
