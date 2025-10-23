import { jsonb, text, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { EntityTypeId, EntityTypeVersionId } from "../../ids";

export const data_model_validation_group = builder(
  "data_model_validation_group",
  {
    entity_type_id: varchar("entity_type_id").$type<EntityTypeId>(),
    validations: jsonb("validations").notNull(),
    index_type: text("index_type"),
    index_id: varchar("index_id"),
    entity_type_version_id: varchar(
      "entity_type_version_id",
    ).$type<EntityTypeVersionId>(),
  },
);
