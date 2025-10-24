// Utilities to mirror Archetype customer data table naming

export const normalizeId = (id: string): string =>
  id.replace(/-/g, "_").toLowerCase();

export const entityTableName = (
  versionType: string,
  entityTypeVersionId: string,
): string => `entity_${versionType}_${normalizeId(entityTypeVersionId)}`;

export const relationTableName = (
  versionType: string,
  relationVersionId: string,
): string => `relation_${versionType}_${normalizeId(relationVersionId)}`;

export const entityTypeSqlName = (entityTypeId: string): string =>
  `entity_${normalizeId(entityTypeId)}`;

export const relationColumnA = (entityTypeIdA: string): string =>
  `a_${entityTypeSqlName(entityTypeIdA)}`;
export const relationColumnB = (entityTypeIdB: string): string =>
  `b_${entityTypeSqlName(entityTypeIdB)}`;

export const columnSqlName = (columnId: string): string =>
  `col_${normalizeId(columnId)}`;

export const META = {
  ENTITY_ID: "__entity_id",
  RELATION_ID: "__relation_id",
  RECORD_ID: "__record_id",
  UPDATED_AT: "__updated_at",
  IS_DELETED: "__is_deleted",
  IN_STATUS_SINCE: "__in_status_since",
};
