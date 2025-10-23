import { index, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { marketing } from "../creators";

export const homepage_generation_share_view = marketing(
  "homepage_generation_share_view",
  {
    id: varchar("id").notNull().primaryKey(),
    homepage_generation_share_id: varchar(
      "homepage_generation_share_id",
    ).notNull(),
    ip_address: text("ip_address").notNull(),
    cookie_id: text("cookie_id"),
    viewed_at: timestamp("viewed_at").notNull(),
  },
  (t) => [
    index("marketing.homepage_generation_share_view_share_id_idx").on(
      t.homepage_generation_share_id,
    ),
  ],
);
