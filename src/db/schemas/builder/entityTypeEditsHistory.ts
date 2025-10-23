import { jsonb, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { EntityTypeVersionId, UserId } from "../../ids";

export const entity_type_edits_history = builder("entity_type_edits_history", {
  version_id: varchar("version_id")
    .$type<EntityTypeVersionId>()
    .notNull()
    .primaryKey(),
  edited_by_user: varchar("edited_by_user").$type<UserId>(),
  edit_transaction_id: varchar("edit_transaction_id"),
  feature_context: jsonb("feature_context"),
  operations: jsonb("operations"),
});
