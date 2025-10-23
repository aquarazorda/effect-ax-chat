import { jsonb, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { ColumnId, EntityTypeId, EntityTypeVersionId } from "../../ids";

export const derived_column_metadata = builder("derived_column_metadata", {
  entity_type_id: varchar("entity_type_id").$type<EntityTypeId>(),
  entity_type_version_id: varchar("entity_type_version_id")
    .$type<EntityTypeVersionId>()
    .notNull(),
  column_id: varchar("column_id").$type<ColumnId>().notNull(),
  derivation: jsonb("derivation").notNull(),
  dependencies: jsonb("dependencies").notNull(),
});
