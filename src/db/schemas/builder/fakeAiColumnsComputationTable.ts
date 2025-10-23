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

export const fake_ai_columns_computation_table = builder(
  "fake_ai_columns_computation_table",
  {
    entity_id: text("entity_id").$type<EntityId>().notNull(),
    entity_type_id: varchar("entity_type_id").$type<EntityTypeId>().notNull(),
    column_id: varchar("column_id").$type<ColumnId>().notNull(),
    details: jsonb("details").notNull(),
    version_type: text("version_type").notNull(),
    computation_id: varchar("computation_id")
      .$type<DerivedColumnComputationId>()
      .notNull(),
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("unique__fake_ai_columns_computation_table").on(
      t.version_type,
      t.entity_type_id,
      t.entity_id,
      t.column_id,
    ),
    uniqueIndex("unique__fake_ai_columns_computation_table__computation_id").on(
      t.computation_id,
    ),
  ],
);
