import { index, jsonb, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { marketing } from "../creators";

export const homepage_generation = marketing(
  "homepage_generation",
  {
    id: varchar("id").notNull().primaryKey(),
    utm_campaign: text("utm_campaign"),
    input: jsonb("input").notNull(),
    output: jsonb("output").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    ip_address: text("ip_address"),
  },
  (t) => [
    index("marketing.homepage_generation_utm_campaign_idx").on(t.utm_campaign),
  ],
);
