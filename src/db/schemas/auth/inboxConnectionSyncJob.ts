import {
  boolean,
  index,
  integer,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { auth } from "../creators";
import type { InboxConnectionId, InboxConnectionSyncJobId } from "../../ids";

export const inbox_connection_sync_job = auth(
  "inbox_connection_sync_job",
  {
    id: varchar("id").$type<InboxConnectionSyncJobId>().notNull().primaryKey(),
    connection_id: varchar("connection_id")
      .$type<InboxConnectionId>()
      .notNull(),
    status: varchar("status").notNull(),
    sync_mode: varchar("sync_mode").notNull(),
    error: text("error"),
    processed_emails: integer("processed_emails"),
    full_sync_total_size_estimate: integer("full_sync_total_size_estimate"),
    workflow_id: varchar("workflow_id").notNull(),
    workflow_run_id: varchar("workflow_run_id").notNull(),
    is_deleted: boolean("is_deleted").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_inbox_sync_job_connection_created").on(
      t.connection_id,
      t.created_at,
    ),
  ],
);
