import {
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  GmailMessageProcessingQueueId,
  InboxConnectionId,
  InboxConnectionSyncJobId,
  MessageId,
} from "../../ids";

export const gmail_message_processing_queue = builder(
  "gmail_message_processing_queue",
  {
    id: varchar("id")
      .$type<GmailMessageProcessingQueueId>()
      .notNull()
      .primaryKey(),
    inbox_connection_id: varchar("inbox_connection_id")
      .$type<InboxConnectionId>()
      .notNull(),
    sync_job_id: varchar("sync_job_id")
      .$type<InboxConnectionSyncJobId>()
      .notNull(),
    message_id: varchar("message_id").$type<MessageId>().notNull(),
    priority: integer("priority").notNull(),
    status: varchar("status").notNull(),
    retry_count: integer("retry_count").notNull(),
    error: text("error"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("unique_gmail_queue_sync_job_message").on(
      t.sync_job_id,
      t.message_id,
    ),
    index("idx_gmail_queue_connection_id").on(t.inbox_connection_id),
    index("idx_gmail_queue_sync_job_status_priority").on(
      t.sync_job_id,
      t.status,
      t.priority,
    ),
  ],
);
