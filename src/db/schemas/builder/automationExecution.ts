import { timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { AutomationRuleId, EntityId } from "../../ids";

export const automation_execution = builder(
  "automation_execution",
  {
    rule_id: varchar("rule_id").$type<AutomationRuleId>().notNull(),
    entity_id: varchar("entity_id").$type<EntityId>().notNull(),
    scheduled_time: timestamp("scheduled_time").notNull(),
    status: varchar("status").notNull(),
    execution_start_time: timestamp("execution_start_time").notNull(),
  },
  (t) => [
    uniqueIndex("unique_automation_execution_id").on(
      t.rule_id,
      t.entity_id,
      t.scheduled_time,
    ),
  ],
);
