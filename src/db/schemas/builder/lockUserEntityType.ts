import { timestamp, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { OrganizationId } from "../../ids";

export const lock_user_entity_type = builder("lock_user_entity_type", {
  organization_id: varchar("organization_id")
    .$type<OrganizationId>()
    .notNull()
    .primaryKey(),
  acquired_at: timestamp("acquired_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
