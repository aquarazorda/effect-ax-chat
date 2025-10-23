import { integer, varchar } from "drizzle-orm/pg-core";
import { pub } from "../creators";

export const kysely_migration_lock = pub("kysely_migration_lock", {
  id: varchar("id", { length: 255 }).notNull().primaryKey(),
  is_locked: integer("is_locked").notNull().default(0),
});
