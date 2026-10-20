/**
 * Roles are internal values; every visible label comes from this map so the
 * auth form, the app bar, the nav and the badges never drift apart.
 */
export const ROLES = {
  OPERATOR: 'operator',
  FIELD_CREW: 'field_crew',
  ADMINISTRATOR: 'administrator',
};

export const ROLE_LABELS = {
  [ROLES.OPERATOR]: 'Operator',
  [ROLES.FIELD_CREW]: 'Field crew',
  [ROLES.ADMINISTRATOR]: 'Administrator',
};

/** Accepted spellings for each role, used when reading a session. */
export const ROLE_ALIASES = {
  [ROLES.OPERATOR]: [ROLES.OPERATOR, 'dispatch_operator'],
  [ROLES.FIELD_CREW]: [ROLES.FIELD_CREW, 'field', 'field_crew'],
  [ROLES.ADMINISTRATOR]: [ROLES.ADMINISTRATOR, 'admin', 'administrator'],
};

export const normalizeRole = (role) => {
  const value = (role || '').toLowerCase();
  const match = Object.entries(ROLE_ALIASES).find(([, aliases]) => aliases.includes(value));
  return match ? match[0] : null;
};

export const roleLabel = (role) => ROLE_LABELS[normalizeRole(role)] ?? 'Unknown role';
