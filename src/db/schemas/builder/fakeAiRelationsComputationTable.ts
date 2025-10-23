import {
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  DerivedRelationComputationId,
  EntityId,
  RelationId,
} from "../../ids";

export const fake_ai_relations_computation_table = builder(
  "fake_ai_relations_computation_table",
  {
    computation_id: varchar("computation_id")
      .$type<DerivedRelationComputationId>()
      .notNull(),
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow(),
    relation_id: varchar("relation_id").$type<RelationId>().notNull(),
    direction: varchar("direction").notNull(),
    version_type: text("version_type").notNull(),
    entity_id: text("entity_id").$type<EntityId>().notNull(),
    details: jsonb("details").notNull(),
  },
  (t) => [
    uniqueIndex("unique__fake_ai_relations_computation_table").on(
      t.version_type,
      t.relation_id,
      t.entity_id,
      t.direction,
    ),
    uniqueIndex(
      "unique__fake_ai_relations_computation_table__computation_id",
    ).on(t.computation_id),
  ],
);
