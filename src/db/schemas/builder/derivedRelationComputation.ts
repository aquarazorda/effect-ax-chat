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

export const derived_relation_computation = builder(
  "derived_relation_computation",
  {
    computation_id: varchar("computation_id")
      .$type<DerivedRelationComputationId>()
      .notNull(),
    started_at: timestamp("started_at", { withTimezone: true }).defaultNow(),
    relation_id: varchar("relation_id").$type<RelationId>().notNull(),
    direction: varchar("direction").notNull(),
    version_type: text("version_type").notNull(),
    entity_id: text("entity_id").$type<EntityId>().notNull(),
    status: text("status").notNull(),
    derivation_logic: text("derivation_logic").notNull(),
    input_values: jsonb("input_values").notNull(),
  },
  (t) => [
    uniqueIndex("unique__derived_relation_computation").on(
      t.version_type,
      t.relation_id,
      t.entity_id,
      t.direction,
    ),
    uniqueIndex("unique__derived_relation_computation__computation_id").on(
      t.computation_id,
    ),
  ],
);
