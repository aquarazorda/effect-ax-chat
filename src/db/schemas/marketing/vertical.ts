import { varchar } from "drizzle-orm/pg-core";
import { marketing } from "../creators";

export const vertical = marketing("vertical", {
  id: varchar("id").notNull().primaryKey(),
  name: varchar("name").notNull(),
});
