import { timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { RelationVersionId, WorkspaceVersionId } from "../../ids";

export const workspace_version_relation_version = builder(
  "workspace_version_relation_version",
  {
    workspace_version_id: varchar("workspace_version_id")
      .$type<WorkspaceVersionId>()
      .notNull(),
    relation_version_id: varchar("relation_version_id")
      .$type<RelationVersionId>()
      .notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
);
