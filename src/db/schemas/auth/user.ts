import {
  jsonb,
  text,
  uniqueIndex,
  varchar,
  timestamp,
} from "drizzle-orm/pg-core";
import { auth } from "../creators";

export const user = auth(
  "user",
  {
    id: varchar("id").notNull().primaryKey(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    clerk_user_id: varchar("clerk_user_id").notNull(),
    clerk_data: jsonb("clerk_data"),
    first_name: text("first_name"),
    last_name: text("last_name"),
    image_url: text("image_url"),
    email_address: text("email_address"),
    primary_organization_id: varchar("primary_organization_id"),
  },
  (t) => [uniqueIndex("user_clerk_user_id_key").on(t.clerk_user_id)],
);
