import { timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { ActionVersionId, WorkspaceVersionId } from "../../ids";

export const workspace_version_action_version = builder(
  "workspace_version_action_version",
  {
    workspace_version_id: varchar("workspace_version_id")
      .$type<WorkspaceVersionId>()
      .notNull(),
    action_version_id: varchar("action_version_id")
      .$type<ActionVersionId>()
      .notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
);
