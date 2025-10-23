import {
  boolean,
  index,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { marketing } from "../creators";

export const blog_posts = marketing(
  "blog_posts",
  {
    id: varchar("id").notNull().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    content: text("content").notNull(),
    excerpt: text("excerpt"),
    published: boolean("published").notNull().default(false),
    published_at: timestamp("published_at", { withTimezone: true }),
    author: text("author").notNull(),
    tags: text("tags").array().notNull().default([]),
    cover_image: varchar("cover_image", { length: 255 }),
    avatar_url: varchar("avatar_url", { length: 255 }),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    uniqueIndex("blog_posts_slug_key").on(t.slug),
    index("marketing_blog_posts_published_idx").on(t.published),
    index("marketing_blog_posts_slug_idx").on(t.slug),
  ],
);
