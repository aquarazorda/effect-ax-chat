import { pgTableCreator } from "drizzle-orm/pg-core";

export const auth = pgTableCreator((name) => `auth.${name}`);
export const builder = pgTableCreator((name) => `builder.${name}`);
export const billing_tracking = pgTableCreator(
  (name) => `billing_tracking.${name}`,
);
export const marketing = pgTableCreator((name) => `marketing.${name}`);
export const pub = pgTableCreator((name) => `public.${name}`);
