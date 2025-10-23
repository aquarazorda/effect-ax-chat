import { index, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { CRMCacheId } from "../../ids";

export const crm_cache = builder(
  "crm_cache",
  {
    id: text("id").$type<CRMCacheId>().notNull().primaryKey(),
    provenance: text("provenance").notNull(),
    entity_type: text("entity_type").notNull(),
    entity_identifier: text("entity_identifier").notNull(),
    enrichment: jsonb("enrichment").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_crm_cache_unique_lookup_email").on(
      t.provenance,
      t.entity_type,
      t.entity_identifier,
    ),
  ],
);
