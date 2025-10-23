import {
  boolean,
  integer,
  jsonb,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type {
  EntityTypeId,
  OrganizationId,
  RelationId,
  RelationVersionId,
} from "../../ids";

export const data_model_entity_relation = builder(
  "data_model_entity_relation",
  {
    version_id: varchar("version_id")
      .$type<RelationVersionId>()
      .notNull()
      .primaryKey(),
    id: varchar("id").$type<RelationId>(),
    based_on: varchar("based_on"),
    version_major: integer("version_major"),
    version_minor: integer("version_minor"),
    version_patch: integer("version_patch"),
    name_from_a_to_b: text("name_from_a_to_b"),
    description_from_a_to_b: text("description_from_a_to_b"),
    name_from_b_to_a: text("name_from_b_to_a"),
    description_from_b_to_a: text("description_from_b_to_a"),
    config: jsonb("config").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    entity_type_id_a: varchar("entity_type_id_a").$type<EntityTypeId>(),
    entity_type_id_b: varchar("entity_type_id_b").$type<EntityTypeId>(),
    computed_from_id: varchar("computed_from_id"),
    computed_from_version_id: varchar("computed_from_version_id"),
    origin_version_id: varchar("origin_version_id"),
    is_preview: boolean("is_preview"),
    organization_id: varchar("organization_id").$type<OrganizationId>(),
    autofill: jsonb("autofill"),
    new_autofill: jsonb("new_autofill"),
    team_members_to_company_version: integer("team_members_to_company_version"),
  },
);
