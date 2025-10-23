import { index, uuid, varchar } from "drizzle-orm/pg-core";
import { auth } from "../creators";
import type { OrganizationId, OrganizationUserId, UserId } from "../../ids";

export const organization_user = auth(
  "organization_user",
  {
    id: uuid("id").$type<OrganizationUserId>().notNull().primaryKey(),
    user_id: varchar("user_id").$type<UserId>().notNull(),
    organization_id: varchar("organization_id")
      .$type<OrganizationId>()
      .notNull(),
    role: varchar("role").notNull().default("member"),
  },
  (t) => [index("idx_organization_user_user_id").on(t.user_id)],
);
