import { jsonb, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { RelationId, RelationVersionId } from "../../ids";

export const derived_relation_metadata = builder("derived_relation_metadata", {
  relation_id: varchar("relation_id").$type<RelationId>().notNull(),
  relation_version_id: varchar("relation_version_id")
    .$type<RelationVersionId>()
    .notNull(),
  direction: varchar("direction").notNull(),
  derivation_logic: varchar("derivation_logic").notNull(),
  steps: jsonb("steps").notNull(),
  dependencies: jsonb("dependencies").notNull(),
});
