import { pgSchema, pgTableCreator } from "drizzle-orm/pg-core";

export const auth = pgTableCreator((name) => `auth.${name}`);
export const authSchema = pgSchema("auth");
export const builder = pgTableCreator((name) => `builder.${name}`);
// Also export proper schema-qualified handle for new definitions
export const builderSchema = pgSchema("builder");
export const billing_tracking = pgTableCreator(
  (name) => `billing_tracking.${name}`,
);
export const marketing = pgTableCreator((name) => `marketing.${name}`);
export const pub = pgTableCreator((name) => `public.${name}`);
