// Utilities to mirror Archetype customer data table naming

export const normalizeId = (id: string): string =>
  id.replace(/-/g, "_").toLowerCase();

export const entityTableName = (
  versionType: string,
  entityTypeVersionId: string,
): string => {
  // Builder version ids often carry a prefix like "etv_"; org tables omit it
  const norm = normalizeId(entityTypeVersionId).replace(/^etv_/, "");
  return `entity_${versionType}_${norm}`;
};

export const relationTableName = (
  versionType: string,
  relationVersionId: string,
): string => {
  // Relation version ids can be prefixed (e.g., "erv_"); org tables omit it
  const norm = normalizeId(relationVersionId).replace(/^erv_/, "");
  return `relation_${versionType}_${norm}`;
};

export const entityTypeSqlName = (entityTypeId: string): string =>
  `entity_${normalizeId(entityTypeId)}`;

export const relationColumnA = (entityTypeIdA: string): string =>
  `a_${entityTypeSqlName(entityTypeIdA)}`;
export const relationColumnB = (entityTypeIdB: string): string =>
  `b_${entityTypeSqlName(entityTypeIdB)}`;

export const columnSqlName = (columnId: string): string => {
  const norm = normalizeId(columnId);
  return norm.startsWith("col_") ? norm : `col_${norm}`;
};

export const META = {
  ENTITY_ID: "__entity_id",
  RELATION_ID: "__relation_id",
  RECORD_ID: "__record_id",
  UPDATED_AT: "__updated_at",
  IS_DELETED: "__is_deleted",
  IN_STATUS_SINCE: "__in_status_since",
};
