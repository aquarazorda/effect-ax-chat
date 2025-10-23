import { varchar } from "drizzle-orm/pg-core";
import { pub } from "../creators";

export const kysely_migration = pub("kysely_migration", {
  name: varchar("name", { length: 255 }).notNull().primaryKey(),
  timestamp: varchar("timestamp", { length: 255 }).notNull(),
});
