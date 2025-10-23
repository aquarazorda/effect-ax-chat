import { index, jsonb, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { ColumnId, EntityTypeId, EntityTypeVersionId } from "../../ids";

export const data_model_ai_column_metadata = builder(
  "data_model_ai_column_metadata",
  {
    entity_type_id: varchar("entity_type_id").$type<EntityTypeId>(),
    column_id: varchar("column_id").$type<ColumnId>(),
    config: jsonb("config").notNull(),
    dependencies: jsonb("dependencies"),
    entity_type_version_id: varchar(
      "entity_type_version_id",
    ).$type<EntityTypeVersionId>(),
  },
  (t) => [
    index("idx_data_model_ai_column_metadata_entity_type_version_id").on(
      t.entity_type_version_id,
    ),
  ],
);
