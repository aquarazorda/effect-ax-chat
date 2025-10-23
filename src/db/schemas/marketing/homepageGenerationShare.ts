import {
  index,
  integer,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { marketing } from "../creators";

export const homepage_generation_share = marketing(
  "homepage_generation_share",
  {
    id: varchar("id").notNull().primaryKey(),
    homepage_generation_id: varchar("homepage_generation_id").notNull(),
    share_id: varchar("share_id").notNull(),
    email: varchar("email"),
    view_count: integer("view_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("homepage_generation_share_pkey").on(t.id),
    uniqueIndex("homepage_generation_share_share_id_key").on(t.share_id),
    index("marketing.homepage_generation_share_homepage_generation_id_idx").on(
      t.homepage_generation_id,
    ),
    index("marketing.homepage_generation_share_share_id_idx").on(t.share_id),
  ],
);
