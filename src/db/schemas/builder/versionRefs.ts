import { boolean, index, text, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  ActionVersionId,
  EntityTypeVersionId,
  OrganizationId,
  VersionedEntityId,
} from "../../ids";

export const version_refs = builder(
  "version_refs",
  {
    table_name: text("table_name").notNull(),
    id: varchar("id").$type<VersionedEntityId>().notNull(),
    version_id: varchar("version_id")
      .$type<ActionVersionId | EntityTypeVersionId>()
      .notNull(),
    version_type: text("version_type").notNull(),
    application_group_id: varchar("application_group_id"),
    application_id: varchar("application_id"),
    computed_from_id: varchar("computed_from_id"),
    computed_from_version_id: varchar("computed_from_version_id"),
    origin_version_id: varchar("origin_version_id"),
    organization_id: varchar("organization_id").$type<OrganizationId>(),
    entity_type_id: text("entity_type_id"),
    is_user_entity_type: boolean("is_user_entity_type"),
    other_entity_type_id: varchar("other_entity_type_id"),
  },
  (t) => [
    index("version_refs_organization_id_idx").on(
      t.organization_id,
      t.version_type,
      t.table_name,
    ),
    index("version_refs_version_id_idx").on(t.version_id),
  ],
);
