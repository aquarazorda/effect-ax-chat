import {
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ColumnId,
  DerivedColumnComputationId,
  EntityId,
  EntityTypeId,
} from "../../ids";

export const derived_column_computation = builder(
  "derived_column_computation",
  {
    computation_id: varchar("computation_id")
      .$type<DerivedColumnComputationId>()
      .notNull(),
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow(),
    column_id: text("column_id").$type<ColumnId>().notNull(),
    version_type: text("version_type").notNull(),
    entity_id: text("entity_id").$type<EntityId>().notNull(),
    entity_type_id: text("entity_type_id").$type<EntityTypeId>().notNull(),
    derivation_logic: text("derivation_logic").notNull(),
    expected_output_type: jsonb("expected_output_type").notNull(),
    input_values: jsonb("input_values").notNull(),
    status: text("status").notNull(),
  },
  (t) => [
    uniqueIndex("unique__derived_column_computation").on(
      t.version_type,
      t.entity_type_id,
      t.entity_id,
      t.column_id,
    ),
    uniqueIndex("unique__derived_column_computation__computation_id").on(
      t.computation_id,
    ),
  ],
);
