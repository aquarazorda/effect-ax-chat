import { index, jsonb, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { RelationId, RelationVersionId } from "../../ids";

export const data_model_ai_relation_metadata = builder(
  "data_model_ai_relation_metadata",
  {
    relation_id: varchar("relation_id").$type<RelationId>(),
    relation_version_id: varchar(
      "relation_version_id",
    ).$type<RelationVersionId>(),
    config: jsonb("config").notNull(),
    dependencies: jsonb("dependencies"),
  },
  (t) => [
    index("idx_data_model_ai_relation_metadata_relation_version_id").on(
      t.relation_version_id,
    ),
  ],
);
