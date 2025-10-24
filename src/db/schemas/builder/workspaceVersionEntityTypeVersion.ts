import { timestamp, varchar } from "drizzle-orm/pg-core";
import { builderSchema } from "../creators";
import type { EntityTypeVersionId, WorkspaceVersionId } from "../../ids";

export const workspace_version_entity_type_version = builderSchema.table(
  "workspace_version_entity_type_version",
  {
    workspace_version_id: varchar("workspace_version_id")
      .$type<WorkspaceVersionId>()
      .notNull(),
    entity_type_version_id: varchar("entity_type_version_id")
      .$type<EntityTypeVersionId>()
      .notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
);
