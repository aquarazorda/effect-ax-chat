import { integer, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  CategoryId,
  CategoryWithEntityTypeId,
  EntityTypeId,
  OrganizationId,
} from "../../ids";

export const category_with_entity_type = builder(
  "category_with_entity_type",
  {
    id: varchar("id").$type<CategoryWithEntityTypeId>().notNull().primaryKey(),
    organization_id: varchar("organization_id")
      .$type<OrganizationId>()
      .notNull(),
    category_id: varchar("category_id").$type<CategoryId>().notNull(),
    entity_type_id: varchar("entity_type_id").$type<EntityTypeId>().notNull(),
    display_order: integer("display_order").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("entity_type_category_with_entities_unique").on(
      t.entity_type_id,
      t.category_id,
    ),
    uniqueIndex("entity_type_single_category").on(t.entity_type_id),
    uniqueIndex("org_cat_entity_unique").on(
      t.organization_id,
      t.category_id,
      t.entity_type_id,
    ),
  ],
);
