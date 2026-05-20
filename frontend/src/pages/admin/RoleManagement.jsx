import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { Settings, Save, Shield, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = [
  { id: 'hr', label: 'HR / Recruiter', desc: 'Recruiters and talent acquisition.' },
  { id: 'manager', label: 'Manager', desc: 'Team leaders and department heads.' },
  { id: 'instructor', label: 'Instructor', desc: 'Course creators and trainers.' },
  { id: 'employee', label: 'Employee', desc: 'Standard team members.' },
  { id: 'candidate', label: 'Candidate', desc: 'External applicants and candidates.' },
];

const MODULES = [
  { id: 'source', label: 'Source (HR)', color: 'var(--primary)' },
  { id: 'verify', label: 'Verify (Assess)', color: '#10B981' },
  { id: 'forge', label: 'Forge (Learning)', color: '#F59E0B' },
  { id: 'deploy', label: 'Deploy (Talent)', color: '#3B82F6' },
];

export default function RoleManagement() {
  const [permissions, setPermissions] = useState({});
  const [orgModules, setOrgModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgRes, permRes] = await Promise.all([
        adminApi.orgSettings(),
        adminApi.getRolePermissions()
      ]);
      
      // Determine what modules the org actually has enabled globally
      // Wait, orgSettings currently doesn't return has_source etc.
      // But we can just allow toggling the 4 main ones anyway.
      // Or we can fetch me() to see current org modules if needed.
      // For now, let's just show all 4 and let them toggle.
      setOrgModules(['source', 'verify', 'forge', 'deploy']);
      
      // Merge fetched permissions with defaults so UI is always populated
      const defaultPerms = {
        hr: ['source', 'verify', 'forge', 'deploy'],
        manager: ['source', 'verify', 'forge', 'deploy'],
        instructor: ['source', 'verify', 'forge', 'deploy'],
        employee: ['source', 'verify', 'forge', 'deploy'],
        candidate: ['source', 'verify', 'forge', 'deploy'],
      };
      
      const merged = { ...defaultPerms };
      const fetchedData = permRes.data.data;
      
      for (const role in fetchedData) {
        if (merged[role]) {
          merged[role] = fetchedData[role];
        }
      }
      setPermissions(merged);
    } catch (e) {
      toast.error('Failed to load role permissions');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (roleId, moduleId) => {
    setPermissions(prev => {
      const current = prev[roleId] || [];
      if (current.includes(moduleId)) {
        return { ...prev, [roleId]: current.filter(m => m !== moduleId) };
      } else {
        return { ...prev, [roleId]: [...current, moduleId] };
      }
    });
  };

  const handleSave = async (roleId) => {
    setSavingRole(roleId);
    try {
      await adminApi.updateRolePermissions({
        role: roleId,
        allowed_modules: permissions[roleId]
      });
      toast.success(`${ROLES.find(r => r.id === roleId).label} permissions updated!`);
    } catch (e) {
      toast.error('Failed to update permissions');
    } finally {
      setSavingRole(null);
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;

  return (
    <div>
      <div className="page-header">
        <h1>Role Management 🛡️</h1>
        <p>Configure which modules each role can access within your organization.</p>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gap: 24 }}>
          {ROLES.map((role, idx) => (
            <div key={role.id} className={`card animate-fade-in stagger-${(idx % 5) + 1}`}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={18} style={{ color: 'var(--primary)' }} />
                    {role.label}
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>{role.desc}</div>
                </div>
                <button 
                  className="btn btn-shimmer btn-sm" 
                  onClick={() => handleSave(role.id)}
                  disabled={savingRole === role.id}
                >
                  <Save size={14} /> {savingRole === role.id ? 'Saving...' : 'Save Role'}
                </button>
              </div>
              <div className="card-body">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                  {MODULES.map(mod => {
                    const isEnabled = permissions[role.id]?.includes(mod.id);
                    return (
                      <div 
                        key={mod.id}
                        onClick={() => handleToggle(role.id, mod.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 16px',
                          borderRadius: '8px',
                          border: `1px solid ${isEnabled ? mod.color : 'var(--border)'}`,
                          background: isEnabled ? `${mod.color}15` : 'var(--bg-elevated)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          flex: '1 1 200px'
                        }}
                      >
                        <div style={{ 
                          width: 24, height: 24, borderRadius: 12, 
                          background: isEnabled ? mod.color : 'transparent',
                          border: `2px solid ${isEnabled ? mod.color : 'var(--text-muted)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff'
                        }}>
                          {isEnabled && <Check size={14} strokeWidth={3} />}
                        </div>
                        <span style={{ fontWeight: 600, color: isEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {mod.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
