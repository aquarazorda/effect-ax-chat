import { index, text, timestamp } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ActionId,
  StateId,
  StateMachineMetadataVersionId,
  TransitionId,
} from "../../ids";

export const state_machine_transition = builder(
  "state_machine_transition",
  {
    state_machine_metadata_version_id: text("state_machine_metadata_version_id")
      .$type<StateMachineMetadataVersionId>()
      .notNull(),
    transition_id: text("transition_id").$type<TransitionId>().notNull(),
    from_state_id: text("from_state_id").$type<StateId>().notNull(),
    to_state_id: text("to_state_id").$type<StateId>().notNull(),
    action_id: text("action_id").$type<ActionId>().notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_state_machine_transition_metadata_version_id").on(
      t.state_machine_metadata_version_id,
    ),
  ],
);
