import { varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { EntityTypeVersionId } from "../../ids";

export const fake_data_entity_type_retrieval_pointer = builder(
  "fake_data_entity_type_retrieval_pointer",
  {
    entity_type_version_id: varchar("entity_type_version_id")
      .$type<EntityTypeVersionId>()
      .notNull()
      .primaryKey(),
    retrieve_at_entity_type_version_id: varchar(
      "retrieve_at_entity_type_version_id",
    ).$type<EntityTypeVersionId>(),
  },
);
