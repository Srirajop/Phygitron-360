import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Shield, Users, Activity, Plus, Trash2, Link, Lock, Unlock, Key } from 'lucide-react';
import ClearanceMatrix from './ClearanceMatrix';
import UserClearanceOverrides from './UserClearanceOverrides';
import ModuleControl from './ModuleControl';
import "../styles/adminPanel.css";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [rolesPerms, setRolesPerms] = useState({});
  const [tenantOps, setTenantOps] = useState({ modules_enabled: [] });
  const [userOverrides, setUserOverrides] = useState({});
  const [selectedUserForOverride, setSelectedUserForOverride] = useState(null);
  const [loading, setLoading] = useState(true);

  const [showAddForm, setShowAddForm] = useState(false);

  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'employee',
    employee_code: ''
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);

    try {
      if (activeTab === 'users') {
        const res = await fetch(`/api/admin/users?t=${Date.now()}`, {
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });

        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);

      } else if (activeTab === 'permissions') {
        const res = await fetch('/api/admin/permissions/roles', {
          credentials: 'include'
        });

        const data = await res.json();
        setRolesPerms(data || {});

      } else if (activeTab === 'modules') {
        const res = await fetch('/api/org/billing-status', {
          credentials: 'include'
        });

        const data = await res.json();

        setTenantOps({
          modules_enabled: data.modules || []
        });

      } else if (activeTab === 'logs') {
        const res = await fetch('/api/admin/logs', {
          credentials: 'include'
        });

        const data = await res.json();
        setLogs(Array.isArray(data) ? data : []);
      }

    } catch {
      toast.error('Connection Error');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Identity Creation failed');
      }

      toast.success('User Created');

      setShowAddForm(false);

      setForm({
        username: '',
        password: '',
        role: 'employee',
        employee_code: ''
      });

      loadData();

    } catch (e) {
      toast.error(e.message);
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user permanently?')) return;

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!res.ok) throw new Error('User deletion failed');

      toast.success('User Deleted');
      loadData();

    } catch (e) {
      toast.error(e.message);
    }
  };

  const toggleActive = async (id, currentStatus) => {
    // currentStatus = true means user is currently active; we want to lock them
    // currentStatus = false means user is currently locked; we want to restore them
    const newActiveValue = currentStatus ? 0 : 1;
    try {
      // Optimistic update first so UI is instant
      setUsers(prev =>
        prev.map(user =>
          user.id === id ? { ...user, is_active: newActiveValue } : user
        )
      );

      const res = await fetch(`/api/admin/users/${id}/toggle`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      });

      if (!res.ok) {
        // Revert on failure
        setUsers(prev =>
          prev.map(user =>
            user.id === id ? { ...user, is_active: currentStatus ? 1 : 0 } : user
          )
        );
        throw new Error('Lock sequence failed');
      }

      toast.success(currentStatus ? 'User Locked' : 'User Restored');

    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateRole = async (id, newRole) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          role: newRole
        })
      });

      if (!res.ok) throw new Error('User role update failed');

      toast.success('Role Updated');

      loadData();

    } catch (e) {
      toast.error(e.message);
    }
  };

  const updateEmployeeCode = async (id, code) => {
    try {
      const res = await fetch(`/api/admin/users/${id}/employee-code`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_code: code || null
        })
      });

      if (!res.ok) throw new Error('Update failed');

      toast.success('Employee Code Updated');

      loadData();

    } catch (e) {
      toast.error(e.message);
    }
  };

  const loadUserOverrides = async (id) => {
    try {
      const res = await fetch(`/api/admin/permissions/users/${id}`, {
        credentials: 'include'
      });

      const data = await res.json();

      setUserOverrides(data || {});

    } catch {
      toast.error('Failed to load user permissions');
    }
  };

  const updateOverride = async (userId, perm, value) => {
    try {
      const res = await fetch(`/api/admin/permissions/users/${userId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          overrides: {
            [perm]: value
          }
        })
      });

      if (!res.ok) throw new Error();

      toast.success('User Permissions Updated');

      loadUserOverrides(userId);

    } catch {
      toast.error('Override Error');
    }
  };

  const TABS = [
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'permissions', label: 'Permissions', icon: Shield },
    { id: 'modules', label: 'Modules', icon: Activity },
    { id: 'logs', label: 'Activity Log', icon: Activity },
  ];

  return (
    <div className="admin-panel">

      <div className="admin-header">

        <div>
          <p className="admin-kicker">
            Administration
          </p>

          <h1 className="admin-title text-black">
            Workspace Settings
          </h1>

          <p className="admin-subtitle">
            Platform management & security
          </p>
        </div>

        <div className="admin-tabs">

          {TABS.map(t => (

            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={
                activeTab === t.id
                  ? "admin-tab active"
                  : "admin-tab"
              }
            >
              <t.icon size={14} />
              {t.label}
            </button>

          ))}

        </div>

      </div>

      {loading ? (

        <div className="flex flex-col justify-center h-64 items-center gap-4">

          <div className="relative">
            <div className="w-12 h-12 border-2 border-primary/20 rounded-full" />

            <div className="absolute inset-0 w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>

          <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] animate-pulse">
            Syncing Neural Nodes...
          </p>

        </div>

      ) : (

        <div className="animate-fade-in-up">

          {activeTab === 'users' && (

            <div className="space-y-6">

              {/* TOP PANEL */}

              <div className="flex justify-between items-center bg-white/75 backdrop-blur-2xl border border-primary/10 shadow-[0_10px_50px_rgba(180,140,255,0.12)] p-8 rounded-[2.5rem]">

                <div className="flex items-center gap-5">

                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 text-primary shadow-[0_0_30px_rgba(180,140,255,0.15)]">
                    <Users size={24} />
                  </div>

                  <div>

                    <h3 className="text-2xl font-black text-black uppercase tracking-tight">
                      Active Identity Index
                    </h3>

                    <p className="text-[10px] text-black/80 uppercase font-black tracking-[0.25em] mt-2">
                      Total provisioning for this workspace environment
                    </p>

                  </div>

                </div>

              </div>

              {/* TABLE */}

              <div className="light-table bg-white/70 backdrop-blur-2xl border border-primary/10 shadow-[0_10px_60px_rgba(180,140,255,0.08)] overflow-hidden rounded-[2.5rem]">

                <table className="w-full text-left border-collapse">

                  <thead>

                    <tr className="bg-gradient-to-r from-primary/[0.08] to-transparent border-b border-primary/10">

                      <th className="px-10 py-6 text-[10px] font-normal uppercase tracking-[0.2em] text-black">

                        Identity Context
                      </th>

                      <th className="px-10 py-6 text-[10px] font-normal uppercase tracking-[0.2em] text-black">
                        Clearance Level
                      </th>

                      <th className="px-10 py-6 text-[10px] font-normal uppercase tracking-[0.2em] text-black">
                        Personnel Link
                      </th>

                      <th className="px-10 py-6 text-[10px] font-normal uppercase tracking-[0.2em] text-black text-right">
                        Node Controls
                      </th>

                    </tr>

                  </thead>

                  <tbody className="divide-y divide-primary/[0.06]">

                    {users.map(u => (

                      <tr
                        key={u.id}
                        className="hover:bg-primary/[0.045] group transition-all duration-300"
                      >

                        {/* USER */}

                        <td className="px-10 py-8">

                          <div className="flex items-center gap-5">

                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-normal uppercase tracking-tighter shadow-inner ${
                              u.is_active !== 0
                                ? 'bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-[0_0_20px_rgba(180,140,255,0.12)]'
                                : 'bg-red-500/10 text-red-500 border border-red-500/10'
                            }`}>
                              {u.username.substring(0, 2)}
                            </div>

                            <div>

                              <p className="text-base font-medium text-black group-hover:text-violet-700 transition-colors">
                                {u.username}
                              </p>

                              <p className="text-[9px] text-black font-mono mt-1 tracking-widest uppercase">
                                ID: NODE_{u.id.toString().padStart(4, '0')}
                              </p>

                            </div>

                          </div>

                        </td>

                        {/* ROLE */}

                        <td className="px-10 py-8">

                          <select
                            value={u.role}
                            onChange={e => updateRole(u.id, e.target.value)}
                            className="bg-[#ece8f8] border border-primary/15 text-black text-[10px] font-normal uppercase tracking-[0.15em] px-5 py-3 rounded-2xl focus:outline-none hover:border-primary/40 hover:shadow-[0_0_20px_rgba(180,140,255,0.12)] transition-all cursor-pointer"
                          >

                            {['org_admin', 'manager', 'employee', 'trainee'].map(r => (

                              <option
                                key={r}
                                value={r}
                                className="bg-white text-black font-normal"
                              >
                                {r.replace('_', ' ')}
                              </option>

                            ))}

                          </select>

                        </td>

                        {/* PERSONNEL LINK */}

                        <td className="px-10 py-8">

                          <div className="flex items-center gap-3 bg-[#ece8f8] backdrop-blur-xl border border-primary/15 px-4 py-3 rounded-2xl hover:border-primary/30 hover:shadow-[0_0_20px_rgba(180,140,255,0.1)] transition-all">

                            <Link size={12} className="text-primary/70" />

                            <input
                              type="text"
                              defaultValue={u.employee_code || ''}
                              onBlur={e => updateEmployeeCode(u.id, e.target.value)}
                              placeholder="Link Neural Code"
                              className="w-28 bg-transparent text-[10px] text-black/90 font-mono focus:outline-none placeholder:text-black/20"
                            />

                          </div>

                        </td>

                        {/* ACTIONS */}

                        <td className="px-10 py-8 text-right">

                          <div className="flex items-center justify-end gap-3">

                            <button
                              onClick={() => {
                                setSelectedUserForOverride(u);
                                loadUserOverrides(u.id);
                              }}
                              className="w-11 h-11 flex items-center justify-center bg-white/90 backdrop-blur-xl text-black hover:text-violet-700 hover:bg-primary/10 rounded-2xl transition-all border border-primary/10 hover:border-primary/30 hover:shadow-[0_0_20px_rgba(180,140,255,0.12)] active:scale-95"
                              title="Adjust Neural Clearance"
                            >
                              <Key size={16} strokeWidth={2.5} />
                            </button>

                            <button
                              onClick={() => toggleActive(u.id, u.is_active !== 0)}
                              className={`w-11 h-11 flex items-center justify-center rounded-2xl transition-all border active:scale-95 ${
                                u.is_active !== 0
                                  ? 'bg-white border-primary/10 text-black hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20 hover:text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/30'
                              }`}
                              title={u.is_active !== 0 ? "Lock Node" : "Restore Node"}
                            >
                              {u.is_active !== 0 ? <Lock size={16} strokeWidth={2.5} /> : <Unlock size={16} strokeWidth={2.5} />}
                            </button>

                            <button
                              onClick={() => deleteUser(u.id)}
                              className="w-11 h-11 flex items-center justify-center bg-white border border-primary/10 text-black hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 rounded-2xl transition-all active:scale-95"
                              title="Purge Identity"
                            >
                              <Trash2 size={16} strokeWidth={2.5} />
                            </button>

                          </div>

                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </div>

          )}

          {activeTab === 'permissions' && (

            <ClearanceMatrix
              rolesPerms={rolesPerms}
              onUpdate={(role, newList) =>
                setRolesPerms(prev => ({
                  ...prev,
                  [role]: newList
                }))
              }
            />

          )}

          {activeTab === 'modules' && (

            <ModuleControl
              tenantOps={tenantOps}
              onUpdate={setTenantOps}
            />

          )}

          {activeTab === 'logs' && (

  <div
    className="
      overflow-hidden
      rounded-[2.8rem]
      border
      border-[#ebe5fa]
      bg-white
      shadow-[0_20px_60px_rgba(180,140,255,0.08)]
    "
  >

    <table className="w-full text-left border-collapse">

      <thead>

        <tr className="bg-gradient-to-r from-[#faf7ff] to-[#f3ecff]">

          {[
            'Timeline',
            'User',
            'Action',
            'Details'
          ].map(h => (

            <th
              key={h}
              className="
                px-10
                py-7
                text-[11px]
                font-normal
                uppercase
                tracking-[0.2em]
                text-black
                border-b
                border-[#ece7fa]
              "
            >
              {h}
            </th>

          ))}

        </tr>

      </thead>

      <tbody>

        {logs.map((l, index) => (

          <tr
            key={l.id}
            className="
              border-b
              border-[#f1edf8]
              hover:bg-[#faf7ff]
              transition-all
              duration-300
            "
          >

            {/* DATE */}

            <td className="px-10 py-8">

              <p className="text-[12px] font-normal text-black">
                {new Date(l.timestamp).toLocaleDateString()}
              </p>

              <p className="text-[10px] text-[#8b5cf6] font-normal mt-1">
                {new Date(l.timestamp).toLocaleTimeString()}
              </p>

            </td>

            {/* SUBJECT */}

            <td className="px-10 py-8">

              <div
                className="
                  inline-flex
                  items-center
                  px-4
                  py-2
                  rounded-xl
                  bg-[#f5efff]
                  border
                  border-[#ddd0ff]
                  text-[#8b5cf6]
                  text-[10px]
                  font-normal
                  uppercase
                  tracking-[0.15em]
                "
              >
                USER
              </div>

            </td>

            {/* ACTION */}

            <td className="px-10 py-8">

              <span
                className="
                  text-[11px]
                  font-normal
                  uppercase
                  tracking-[0.18em]
                  text-[#8b5cf6]
                  italic
                "
              >
                {l.action.replaceAll('_', ' ')}
              </span>

            </td>

            {/* DETAILS */}

            <td className="px-10 py-8">

              <p
                className="
                  text-[14px]
                  text-[#4b5563]
                  leading-relaxed
                "
              >
                {l.details}
              </p>

            </td>

          </tr>

        ))}

      </tbody>

    </table>

  </div>

)}


        </div>

      )}
      {selectedUserForOverride && (
        <UserClearanceOverrides
          user={selectedUserForOverride}
          overrides={userOverrides}
          onUpdate={(userId, perm, value) => updateOverride(userId, perm, value)}
          onClose={() => setSelectedUserForOverride(null)}
        />
      )}

    </div>
  );
}