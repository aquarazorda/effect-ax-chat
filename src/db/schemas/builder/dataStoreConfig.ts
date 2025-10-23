import { jsonb, text } from "drizzle-orm/pg-core";
import { builder } from "../creators";

export const data_store_config = builder("data_store_config", {
  key: text("key").notNull().primaryKey(),
  config: jsonb("config"),
});
