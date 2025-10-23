import { index, primaryKey, text, varchar } from "drizzle-orm/pg-core";
import { auth } from "../creators";
import type { OrganizationId, UserEntityId, UserId } from "../../ids";

export const organization_user_entity_id = auth(
  "organization_user_entity_id",
  {
    organization_id: varchar("organization_id")
      .$type<OrganizationId>()
      .notNull(),
    user_id: varchar("user_id").$type<UserId>().notNull(),
    entity_id: varchar("entity_id").$type<UserEntityId>().notNull(),
    version_type: text("version_type").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.organization_id, t.user_id, t.version_type] }),
    index("idx__organization_user_entity_id__organization_id__entity_id").on(
      t.organization_id,
      t.entity_id,
    ),
  ],
);
