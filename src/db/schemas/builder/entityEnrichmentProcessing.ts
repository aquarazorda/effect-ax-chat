import {
  boolean,
  index,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  EntityEnrichmentProcessingId,
  EntityId,
  OrganizationId,
} from "../../ids";

export const entity_enrichment_processing = builder(
  "entity_enrichment_processing",
  {
    id: text("id").$type<EntityEnrichmentProcessingId>().notNull().primaryKey(),
    organization_id: text("organization_id").$type<OrganizationId>().notNull(),
    entity_type: text("entity_type").notNull(),
    entity_id: text("entity_id").$type<EntityId>().notNull(),
    enrichment_identifier: text("enrichment_identifier").notNull(),
    enrichment_status: text("enrichment_status").notNull(),
    enrichment_error: text("enrichment_error"),
    force_update_all_columns: boolean("force_update_all_columns")
      .notNull()
      .default(false),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_eep_unique_active_entity").on(
      t.organization_id,
      t.entity_type,
      t.entity_id,
    ),
    index("idx_eep_pending_org_created_at").on(t.organization_id, t.created_at),
  ],
);
