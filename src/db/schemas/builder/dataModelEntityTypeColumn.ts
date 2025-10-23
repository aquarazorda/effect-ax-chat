import { boolean, index, jsonb, text, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { ColumnId, EntityTypeVersionId } from "../../ids";

export const data_model_entity_type_column = builder(
  "data_model_entity_type_column",
  {
    id: varchar("id").$type<ColumnId>().notNull(),
    name: text("name").notNull(),
    description: text("description"),
    entity_type_version_id: varchar("entity_type_version_id")
      .$type<EntityTypeVersionId>()
      .notNull(),
    column_type: jsonb("column_type").notNull(),
    is_non_nullable: boolean("is_non_nullable").notNull(),
    is_unique: boolean("is_unique").notNull(),
    conditional_formatting: jsonb("conditional_formatting"),
    autofill: jsonb("autofill"),
    static_formatting: jsonb("static_formatting"),
  },
  (t) => [
    index("data_model_entity_type_column_etv_idx").on(t.entity_type_version_id),
  ],
);
