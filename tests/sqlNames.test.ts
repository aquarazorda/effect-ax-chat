import { expect, test } from "bun:test";
import {
  entityTableName,
  relationTableName,
  columnSqlName,
} from "../src/orgdb/sqlNames";

test("entityTableName strips etv_ and normalizes", () => {
  expect(entityTableName("prod", "etv_ABC-DEF")).toBe(
    "entity_prod_abc_def",
  );
  expect(entityTableName("dev", "123-456")).toBe("entity_dev_123_456");
});

test("relationTableName strips erv_ and normalizes", () => {
  expect(relationTableName("prod", "erv_ABC-DEF")).toBe(
    "relation_prod_abc_def",
  );
  expect(relationTableName("dev", "XYZ-1")).toBe("relation_dev_xyz_1");
});

test("columnSqlName avoids double col_ and normalizes", () => {
  expect(columnSqlName("col_FOO-BAR")).toBe("col_foo_bar");
  expect(columnSqlName("baz-qux")).toBe("col_baz_qux");
});

