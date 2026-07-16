import { usePermission } from './usePermission';
import { useAuth } from '../auth/AuthContext';

/**
 * <HasPermission> — Zero-Tease UI guard component
 * =================================================
 * Completely hides children from the DOM when the current user
 * does not have the required permission. No "locked" states, no
 * disabled buttons — the element simply does not exist.
 *
 * Props:
 *   perm      {string}    Required permission key (from P.xxx)
 *   fallback  {ReactNode} Optional fallback (default: null = hidden)
 *   children  {ReactNode} Content to show when authorized
 *
 * Usage:
 *   import { HasPermission } from '@/core/permissions/HasPermission';
 *   import { P } from '@/core/permissions';
 *
 *   <HasPermission perm={P.DEPLOY_EMP_DELETE}>
 *     <button>Delete Employee</button>
 *   </HasPermission>
 *
 *   // With a fallback element:
 *   <HasPermission perm={P.DEPLOY_EMP_EDIT} fallback={<span>Read-only</span>}>
 *     <EditForm />
 *   </HasPermission>
 */
export function HasPermission({ perm, children, fallback = null }) {
  const allowed = usePermission(perm);
  return allowed ? children : fallback;
}

/**
 * <RequireAllPermissions> — AND gate (user must hold ALL listed perms)
 *
 * Usage:
 *   <RequireAllPermissions perms={[P.DEPLOY_EMP_VIEW, P.DEPLOY_EMP_EDIT]}>
 *     <EditPanel />
 *   </RequireAllPermissions>
 */
export function RequireAllPermissions({ perms = [], children, fallback = null }) {
  const { user } = useAuth();
  if (!user) return fallback;

  const roles = (user.roles || [user.role]).map(r => r?.toLowerCase() ?? '');
  if (roles.includes('super_admin') || roles.includes('superadmin')) return children;

  const userPerms = user.permissions ?? {};
  const check = (key) => Array.isArray(userPerms) ? userPerms.includes(key) : Boolean(userPerms[key]);

  return perms.every(check) ? children : fallback;
}

export default HasPermission;
