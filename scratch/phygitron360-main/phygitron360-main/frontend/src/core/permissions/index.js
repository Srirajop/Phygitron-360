/**
 * PHYGITRON 360 — Frontend Permission Key Registry
 * ==================================================
 * Mirror of backend/core/permissions.py class P.
 * Use P.XXX everywhere — never raw strings — to prevent typos and enable
 * easy refactoring when keys change.
 *
 * Usage:
 *   import { P } from '@/core/permissions';
 *   const canEdit = usePermission(P.DEPLOY_EMP_EDIT);
 *   <HasPermission perm={P.SOURCE_JOBS_MANAGE}> ... </HasPermission>
 */

export const P = {
  // ── Module access gates ──────────────────────────────────────────────────
  MODULE_SOURCE_ACCESS:  'module.source.access',
  MODULE_FORGE_ACCESS:   'module.forge.access',
  MODULE_VERIFY_ACCESS:  'module.verify.access',
  MODULE_DEPLOY_ACCESS:  'module.deploy.access',

  // ── Platform / Admin ────────────────────────────────────────────────────
  MANAGE_SYSTEM:         'manage_system',
  VIEW_REPORTS:          'view_reports',
  MANAGE_OPS:            'manage_ops',
  ADMIN_USERS_MANAGE:    'admin.users.manage',
  ADMIN_ROLES_MANAGE:    'admin.roles.manage',   // Manage role-level permission overrides

  // ── Deploy: Employees ────────────────────────────────────────────────────
  DEPLOY_EMP_VIEW:       'deploy.employees.view',
  DEPLOY_EMP_CREATE:     'deploy.employees.create',
  DEPLOY_EMP_EDIT:       'deploy.employees.edit',
  DEPLOY_EMP_DELETE:     'deploy.employees.delete',
  DEPLOY_EMP_OFFBOARD:   'deploy.employees.offboard',

  // ── Deploy: Assets ───────────────────────────────────────────────────────
  DEPLOY_ASSETS_VIEW:    'deploy.assets.view',
  DEPLOY_ASSETS_MANAGE:  'deploy.assets.manage',

  // ── Deploy: Attendance ───────────────────────────────────────────────────
  DEPLOY_ATT_PERSONAL:   'deploy.attendance.view_personal',
  DEPLOY_ATT_TEAM:       'deploy.attendance.view_team',
  DEPLOY_ATT_MANAGE:     'deploy.attendance.manage',

  // ── Deploy: Onboarding ───────────────────────────────────────────────────
  DEPLOY_ONBOARD_VIEW:   'deploy.onboarding.view',
  DEPLOY_ONBOARD_MANAGE: 'deploy.onboarding.manage',

  // ── Deploy: Learning / Performance ───────────────────────────────────────
  DEPLOY_ASSESS_VIEW:    'deploy.assessments.view',
  DEPLOY_ASSESS_MANAGE:  'deploy.assessments.manage',
  DEPLOY_TRAIN_VIEW:     'deploy.training.view',
  DEPLOY_TRAIN_MANAGE:   'deploy.training.manage',
  DEPLOY_PERF_VIEW:      'deploy.performance.view',
  DEPLOY_PERF_MANAGE:    'deploy.performance.manage',

  // ── Deploy: Dashboard / Notifications ────────────────────────────────────
  DEPLOY_DASH_ADMIN:     'deploy.dashboard.view_admin',
  DEPLOY_NOTIF_ADMIN:    'deploy.notifications.view_admin',
  DEPLOY_NOTIF_MANAGE:   'deploy.notifications.manage',

  // ── Source: Jobs ─────────────────────────────────────────────────────────
  SOURCE_JOBS_VIEW:      'source.jobs.view',
  SOURCE_JOBS_MANAGE:    'source.jobs.manage',

  // ── Source: Candidates ───────────────────────────────────────────────────
  SOURCE_CANDIDATES_VIEW:   'source.candidates.view',
  SOURCE_CANDIDATES_MANAGE: 'source.candidates.manage',

  // ── Verify: Assessments ──────────────────────────────────────────────────
  VERIFY_ASSESS_VIEW:         'verify.assessments.view',
  VERIFY_ASSESS_MANAGE:       'verify.assessments.manage',
  VERIFY_ASSESS_ASSIGN:       'verify.assessments.assign',
  VERIFY_ASSESS_VIEW_RESULTS: 'verify.assessments.view_results',
  VERIFY_SUBMISSIONS_MANAGE:  'verify.submissions.manage',

  // ── Forge ─────────────────────────────────────────────────────────────────
  FORGE_COURSES_VIEW:   'forge.courses.view',
  FORGE_COURSES_MANAGE: 'forge.courses.manage',
  FORGE_ENROLL:         'forge.courses.enroll',
};

export default P;
