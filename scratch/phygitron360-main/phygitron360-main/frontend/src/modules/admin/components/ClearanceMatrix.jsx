import React from 'react';
import { Shield, Check, X, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const PERMISSIONS_CATEGORIES = [
  {
    group: 'Module Access',
    perms: [
      { key: 'module.source.access', label: 'Source Module' },
      { key: 'module.forge.access', label: 'Forge Module' },
      { key: 'module.verify.access', label: 'Verify Module' },
      { key: 'module.deploy.access', label: 'Deploy Module' },
    ]
  },
  {
    group: 'Deployment: Personnel',
    perms: [
      { key: 'deploy.employees.view', label: 'View Directory' },
      { key: 'deploy.employees.create', label: 'Add Employee' },
      { key: 'deploy.employees.edit', label: 'Edit Employee' },
      { key: 'deploy.employees.delete', label: 'Delete Employee' },
      { key: 'deploy.employees.offboard', label: 'Offboard Access' },
    ]
  },
  {
    group: 'Deployment: Core Ops',
    perms: [
      { key: 'deploy.assets.view', label: 'View Assets' },
      { key: 'deploy.assets.manage', label: 'Manage Assets' },
      { key: 'deploy.attendance.view_personal', label: 'Personal Attendance' },
      { key: 'deploy.attendance.view_team', label: 'Team Attendance' },
      { key: 'deploy.attendance.manage', label: 'Manage Attendance' },
      { key: 'deploy.onboarding.view', label: 'View Onboarding' },
      { key: 'deploy.onboarding.manage', label: 'Manage Onboarding' },
      { key: 'deploy.notifications.view_admin', label: 'Admin Notifications' },
      { key: 'deploy.dashboard.view_admin', label: 'Admin Analytics' },
    ]
  },
  {
    group: 'Deployment: Learning',
    perms: [
      { key: 'deploy.assessments.view', label: 'View Assessments' },
      { key: 'deploy.assessments.manage', label: 'Manage Assessments' },
      { key: 'deploy.training.view', label: 'View Training' },
      { key: 'deploy.training.manage', label: 'Manage Training' },
    ]
  },
  {
    group: 'Verify & Source Ops',
    perms: [
      { key: 'source.jobs.manage', label: 'Manage Recruitment' },
      { key: 'source.candidates.view', label: 'View Candidates' },
      { key: 'source.candidates.manage', label: 'Manage Candidates' },
      { key: 'verify.assessments.manage', label: 'Assessment Builder' },
      { key: 'verify.assessments.assign', label: 'Assign Tests' },
      { key: 'verify.assessments.view_results', label: 'View Results' },
    ]
  },
  {
    group: 'Governance',
    perms: [
      { key: 'admin.users.manage', label: 'User Management' },
      { key: 'admin.tenants.provision', label: 'Tenant Provisioning' },
      { key: 'manage_system', label: 'System Settings' },
      { key: 'view_reports', label: 'Global Analytics' },
    ]
  }
];

export default function ClearanceMatrix({ rolesPerms, onUpdate }) {

  const roles = Object.keys(rolesPerms);

  const togglePermission = async (role, permKey) => {
    const currentList = rolesPerms[role] || [];
    const newList = currentList.includes(permKey)
      ? currentList.filter(p => p !== permKey)
      : [...currentList, permKey];

    try {
      const res = await fetch('/api/admin/permissions/roles', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role,
          permissions: newList
        })
      });

      if (!res.ok) throw new Error();
      onUpdate(role, newList);
      toast.success('Clearance Updated');
    } catch {
      toast.error('Sync Error');
    }
  };

  return (
    <div className="bg-white/70 backdrop-blur-2xl border border-primary/10 shadow-[0_10px_60px_rgba(180,140,255,0.08)] overflow-hidden animate-fade-in-up rounded-[2.5rem]">
      {/* HEADER */}
      <div className="p-8 border-b border-primary/10 flex justify-between items-center bg-gradient-to-r from-primary/[0.08] to-transparent">
  <div>
    <h3 className="text-2xl font-bold text-black uppercase tracking-tight flex items-center gap-3">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary shadow-[0_0_30px_rgba(180,140,255,0.15)]">
        <Shield size={22} />
      </div>
      Identity Clearance Matrix
    </h3>
    <p className="text-[10px] text-gray-500 mt-2 uppercase tracking-[0.25em] font-medium">
      Standard Role Permission Governance
    </p>
  </div>

  <div className="flex gap-3 flex-wrap">
    {roles.map(r => (
      <div
        key={r}
        className="px-4 py-2 bg-white border border-black rounded-2xl text-[10px] font-semibold uppercase tracking-[0.12em] text-black shadow-[0_0_20px_rgba(0,0,0,0.08)]"
      >
        {r}
      </div>
    ))}
  </div>
</div>

      {/* TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gradient-to-r from-primary/[0.08] to-transparent border-b border-primary/10">
              <th className="p-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 w-1/3">
                Clearance Key
              </th>
              {roles.map(r => (
                <th
                  key={r}
                  className="p-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 text-center"
                >
                  {r}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-primary/[0.05]">
            {PERMISSIONS_CATEGORIES.map(cat => (
              <React.Fragment key={cat.group}>
                {/* CATEGORY HEADER */}
                <tr className="bg-primary/[0.04]">
                <td
                  colSpan={roles.length + 1}
                  className="px-6 py-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-black border-y border-primary/10"
                >
                  {cat.group}
                </td>
              </tr>

                {/* PERMISSIONS */}
                {cat.perms.map(p => (
                  <tr
                    key={p.key}
                    className="hover:bg-primary/[0.03] group transition-all duration-300"
                  >
                    {/* PERMISSION LABEL */}
                    <td className="p-6 border-b border-primary/[0.04]">
                      <p className="text-sm font-semibold text-black transition-colors group-hover:text-violet-700">
                        {p.label}
                      </p>
                      <p className="text-[10px] text-slate-500 font-normal font-mono mt-1 uppercase tracking-tight">
                        {p.key}
                      </p>
                    </td>

                    {/* ROLES */}
                    {roles.map(r => {
                      const isAllowed = rolesPerms[r]?.includes(p.key);
                      return (
                        <td
                          key={`${r}-${p.key}`}
                          className="p-6 border-b border-primary/[0.04] text-center"
                        >
                          <button
                            onClick={() => togglePermission(r, p.key)}
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 border ${
                              isAllowed
                                ? 'bg-gradient-to-br from-primary/20 to-primary/5 text-violet-700 border-primary/20 shadow-[0_0_25px_rgba(180,140,255,0.18)] hover:scale-105'
                                : 'bg-white text-black/20 border-primary/10 hover:border-primary/30 hover:text-primary hover:bg-primary/[0.04]'
                            }`}
                          >
                            {isAllowed
                              ? <Check size={18} strokeWidth={3} />
                              : <X size={16} strokeWidth={2.5} />
                            }
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* FOOTER */}
      <div className="p-8 bg-gradient-to-r from-primary/[0.04] to-transparent border-t border-primary/10">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary">
            <Zap size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-tight text-primary italic">
              Permission Management
            </p>
            <p className="text-sm text-gray-500 font-normal mt-3 leading-relaxed max-w-4xl">
              Changes to module permissions take effect immediately. Removing access to a module will instantly
              disable that module for users without special permissions within this workspace.
              User data is preserved across access changes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}