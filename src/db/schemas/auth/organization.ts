import { jsonb, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { auth } from "../creators";
import type { OrganizationId } from "../../ids";

export const organization = auth(
  "organization",
  {
    id: varchar("id").$type<OrganizationId>().notNull().primaryKey(),
    clerk_org_id: varchar("clerk_org_id").notNull(),
    name: varchar("name").notNull(),
    slug: varchar("slug").notNull(),
    image_url: varchar("image_url").notNull(),
    clerk_data: jsonb("clerk_data"),
    store_branch_name: varchar("store_branch_name"),
    store_connection_string_encrypted: varchar(
      "store_connection_string_encrypted",
    ),
    social_media_twitter: varchar("social_media_twitter"),
    social_media_linkedin: varchar("social_media_linkedin"),
    social_media_facebook: varchar("social_media_facebook"),
    social_media_instagram: varchar("social_media_instagram"),
    background_image_horizontal_url: varchar("background_image_horizontal_url"),
    background_image_vertical_url: varchar("background_image_vertical_url"),
    description: text("description"),
  },
  (t) => [
    uniqueIndex("organization_slug_unique").on(t.slug),
    uniqueIndex("organization_clerk_org_id_key").on(t.clerk_org_id),
  ],
);
