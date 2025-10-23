import { timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  StateMachineMetadataVersionId,
  WorkspaceVersionId,
} from "../../ids";

export const workspace_version_state_machine_metadata_version = builder(
  "workspace_version_state_machine_metadata_version",
  {
    workspace_version_id: varchar("workspace_version_id")
      .$type<WorkspaceVersionId>()
      .notNull(),
    state_machine_metadata_version_id: varchar(
      "state_machine_metadata_version_id",
    )
      .$type<StateMachineMetadataVersionId>()
      .notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
);
