import { index, text, uuid } from "drizzle-orm/pg-core";
import { builder } from "../creators";
import type { EntityRelationUUID } from "../../ids";

export const fake_m2m_table = builder(
  "fake_m2m_table",
  {
    entity_relation_id: uuid("entity_relation_id").$type<EntityRelationUUID>(),
    value_on_a: text("value_on_a"),
    value_on_b: text("value_on_b"),
  },
  (t) => [index("entity_relation_id_index").on(t.entity_relation_id)],
);
