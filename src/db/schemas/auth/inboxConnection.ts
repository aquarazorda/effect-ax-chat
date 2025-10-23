import {
  boolean,
  index,
  jsonb,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { auth } from "../creators";
import type { InboxConnectionId, OrganizationId, UserId } from "../../ids";

export const inbox_connection = auth(
  "inbox_connection",
  {
    id: varchar("id").$type<InboxConnectionId>().notNull().primaryKey(),
    organization_id: varchar("organization_id")
      .$type<OrganizationId>()
      .notNull(),
    user_id: varchar("user_id").$type<UserId>().notNull(),
    email_address: varchar("email_address").notNull(),
    mode: varchar("mode").notNull(),
    last_synced_at: timestamp("last_synced_at"),
    last_synced_history_id: varchar("last_synced_history_id"),
    last_available_history_id: varchar("last_available_history_id"),
    last_available_history_id_at: timestamp("last_available_history_id_at"),
    watch_set_at: timestamp("watch_set_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    snapshot_stop_condition: jsonb("snapshot_stop_condition").notNull(),
  },
  (t) => [
    uniqueIndex("unique_inbox_connection_user_org_email").on(
      t.user_id,
      t.organization_id,
      t.email_address,
    ),
    index("idx_inbox_connection_email_org").on(
      t.email_address,
      t.organization_id,
    ),
    index("idx_inbox_connection_user_org").on(t.user_id, t.organization_id),
  ],
);
