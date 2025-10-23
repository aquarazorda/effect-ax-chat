import { timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { FeatureApplicationRunId, FeatureId } from "../../ids";

export const feature_application_run_features = builder(
  "feature_application_run_features",
  {
    feature_application_run_id: varchar("feature_application_run_id")
      .$type<FeatureApplicationRunId>()
      .notNull(),
    feature_id: varchar("feature_id").$type<FeatureId>().notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
);
