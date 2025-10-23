import { boolean, index, text, timestamp } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { StateId, StateMachineMetadataVersionId } from "../../ids";

export const state_machine_state = builder(
  "state_machine_state",
  {
    state_machine_metadata_version_id: text("state_machine_metadata_version_id")
      .$type<StateMachineMetadataVersionId>()
      .notNull(),
    state_id: text("state_id").$type<StateId>().notNull(),
    is_archived: boolean("is_archived").notNull(),
    label: text("label").notNull(),
    color: text("color").notNull(),
    ai_agent_enabled: boolean("ai_agent_enabled").notNull(),
    ai_agent_instructions: text("ai_agent_instructions"),
    ai_agent_raw_instructions: text("ai_agent_raw_instructions"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_state_machine_state_transition_id").on(
      t.state_machine_metadata_version_id,
    ),
  ],
);
