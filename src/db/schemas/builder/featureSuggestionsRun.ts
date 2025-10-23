import { timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ActionId,
  ApplicationGroupId,
  ColumnId,
  EntityTypeId,
  FeatureSuggestionsRunId,
  OrganizationId,
  RelationId,
  StateId,
  UserId,
  WorkspaceVersionId,
} from "../../ids";

export const feature_suggestions_run = builder("feature_suggestions_run", {
  id: varchar("id").$type<FeatureSuggestionsRunId>().notNull().primaryKey(),
  triggered_by_user_id: varchar("triggered_by_user_id").$type<UserId>(),
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
  temporal_workflow_id: varchar("temporal_workflow_id"),
  temporal_run_id: varchar("temporal_run_id"),
  result_status: varchar("result_status"),
  result_error: varchar("result_error"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
