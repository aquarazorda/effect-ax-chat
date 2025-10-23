import { pgTableCreator } from "drizzle-orm/pg-core";

export const auth = pgTableCreator((name) => `auth.${name}`);
export const builder = pgTableCreator((name) => `builder.${name}`);
