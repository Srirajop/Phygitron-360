import { useAuth } from '../auth/AuthContext';

/**
 * usePermission(permKey) → boolean
 *
 * Returns true if the current user has the given permission.
 * Handles:
 *   - super_admin: always true (platform bypass)
 *   - permissions dict { [key]: true }
 *   - permissions array (legacy format)
 *
 * Usage:
 *   const canDelete = usePermission(P.DEPLOY_EMP_DELETE);
 *   if (!canDelete) return null;
 *
 * @param {string} permKey - A permission key constant from P (permissions/index.js)
 * @returns {boolean}
 */
export function usePermission(permKey) {
  const { user } = useAuth();
  if (!user) return false;

  if (permKey?.startsWith('module.') && permKey?.endsWith('.access')) {
    const mn = permKey.split('.')[1];
    const enabled = (user.modules_enabled || []).map(m => m.toLowerCase());
    if (!enabled.includes(mn.toLowerCase())) return false;
  }

  const roles = (user.roles || [user.role]).map(r => r?.toLowerCase() ?? '');

  // Only super_admin gets the platform-level bypass here.
  // org_admin access flows through seeded permissions (auditable).
  if (roles.includes('super_admin') || roles.includes('superadmin')) {
    return true;
  }

  const perms = user.permissions ?? {};
  if (Array.isArray(perms)) return perms.includes(permKey);
  return Boolean(perms[permKey]);
}

/**
 * usePermissions(permKeys) → Record<string, boolean>
 *
 * Bulk variant — checks multiple keys at once.
 *
 * Usage:
 *   const { canView, canEdit } = usePermissions({
 *     canView: P.DEPLOY_EMP_VIEW,
 *     canEdit: P.DEPLOY_EMP_EDIT,
 *   });
 *
 * @param {Record<string, string>} keyMap - { alias: permKey }
 * @returns {Record<string, boolean>}
 */
export function usePermissions(keyMap) {
  const { user } = useAuth();
  if (!user) return Object.fromEntries(Object.keys(keyMap).map(k => [k, false]));

  const roles = (user.roles || [user.role]).map(r => r?.toLowerCase() ?? '');
  const isPlatformAdmin = roles.includes('super_admin') || roles.includes('superadmin');
  const perms = user.permissions ?? {};

  const check = (permKey) => {
    if (permKey?.startsWith('module.') && permKey?.endsWith('.access')) {
      const mn = permKey.split('.')[1];
      const enabled = (user.modules_enabled || []).map(m => m.toLowerCase());
      if (!enabled.includes(mn.toLowerCase())) return false;
    }
  
    if (isPlatformAdmin) return true;
    if (Array.isArray(perms)) return perms.includes(permKey);
    return Boolean(perms[permKey]);
  };

  return Object.fromEntries(
    Object.entries(keyMap).map(([alias, permKey]) => [alias, check(permKey)])
  );
}
