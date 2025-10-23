import { varchar } from "drizzle-orm/pg-core";
import { marketing } from "../creators";

export const industry = marketing("industry", {
  id: varchar("id").notNull().primaryKey(),
  name: varchar("name").notNull(),
});
