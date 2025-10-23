import { index, text, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ApplicationGroupId,
  ColumnId,
  EntityTypeId,
  OrganizationId,
  RelationId,
} from "../../ids";

export const data_model_entity_type = builder(
  "data_model_entity_type",
  {
    id: varchar("id").$type<EntityTypeId>().notNull().primaryKey(),
    organization_id: varchar("organization_id")
      .$type<OrganizationId>()
      .notNull(),
    name: text("name").notNull(),
    plural_name: text("plural_name").notNull(),
    description: text("description"),
    emoji: text("emoji"),
    color: text("color"),
    target_entity_type_application_group_id: varchar(
      "target_entity_type_application_group_id",
    ).$type<ApplicationGroupId>(),
    primary_key_column_id: varchar("primary_key_column_id").$type<ColumnId>(),
    display_name_column_id: varchar("display_name_column_id").$type<ColumnId>(),
    status_column_id: varchar("status_column_id").$type<ColumnId>(),
    shape: varchar("shape").notNull(),
    embedded_through_relation_id: varchar(
      "embedded_through_relation_id",
    ).$type<RelationId>(),
  },
  (t) => [index("data_model_entity_type_id_idx").on(t.id)],
);
