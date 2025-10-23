import { text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { auth } from "../creators";
import type { UserId } from "../../ids";

export const user_preferences = auth(
  "user_preferences",
  {
    user_id: varchar("user_id").$type<UserId>().notNull(),
    last_selected_country: text("last_selected_country"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    latest_country_selection: text("latest_country_selection").array(),
  },
  (t) => [uniqueIndex("unique_user_id").on(t.user_id)],
);
