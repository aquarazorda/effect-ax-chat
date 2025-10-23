import { boolean, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  FeatureApplicationRunId,
  OrganizationId,
  WorkspaceVersionId,
} from "../../ids";

export const workspace_version = builder("workspace_version", {
  id: varchar("id").$type<OrganizationId>().notNull(),
  version_id: varchar("version_id")
    .$type<WorkspaceVersionId>()
    .notNull()
    .primaryKey(),
  feature_application_run_id: varchar(
    "feature_application_run_id",
  ).$type<FeatureApplicationRunId>(),
  based_on: varchar("based_on").$type<WorkspaceVersionId>(),
  computed_from_id: varchar("computed_from_id"),
  computed_from_version_id: varchar("computed_from_version_id"),
  origin_version_id: varchar("origin_version_id"),
  version_major: integer("version_major").notNull(),
  version_minor: integer("version_minor").notNull(),
  version_patch: integer("version_patch").notNull(),
  is_preview: boolean("is_preview"),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
