import { text, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ColumnId,
  ColumnValidationId,
  EntityTypeVersionId,
} from "../../ids";

export const data_model_entity_type_column_validation = builder(
  "data_model_entity_type_column_validation",
  {
    id: varchar("id").$type<ColumnValidationId>().notNull(),
    column_id: varchar("column_id").$type<ColumnId>().notNull(),
    entity_type_version_id: varchar("entity_type_version_id")
      .$type<EntityTypeVersionId>()
      .notNull(),
    raw_logic: text("raw_logic"),
    logic: text("logic"),
  },
);
