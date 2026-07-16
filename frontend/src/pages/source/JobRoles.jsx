import React, { useState, useEffect } from 'react';
import { sourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Briefcase, Edit, Trash2, Plus, Users, LayoutList } from 'lucide-react';
import toast from 'react-hot-toast';

export default function JobRoles() {
  const { user } = useAuth();
  const [jobRoles, setJobRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState({ title: '', description: '', min_experience: 0, required_skills: [] });
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [addingRole, setAddingRole] = useState(false);

  const canManageRoles = ['hr', 'org_admin'].includes(user?.role);
  const canEditRoles = canManageRoles || user?.role === 'manager';

  const fetchRoles = () => {
    setLoading(true);
    sourceApi.listJobRoles()
      .then(r => setJobRoles(r.data.data || []))
      .catch(() => toast.error('Failed to load job roles'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRole.title) return;
    setAddingRole(true);
    try {
      if (editingRoleId) {
        await sourceApi.updateJobRole(editingRoleId, newRole);
        toast.success('Role updated!');
      } else {
        await sourceApi.createJobRole(newRole);
        toast.success('Role created!');
      }
      fetchRoles();
      setShowAddRole(false);
      setNewRole({ title: '', description: '', min_experience: 0, required_skills: [] });
      setEditingRoleId(null);
    } catch {
      toast.error(editingRoleId ? 'Failed to update role' : 'Failed to create role');
    } finally {
      setAddingRole(false);
    }
  };

  const resetRoleModal = () => {
    setShowAddRole(false);
    setEditingRoleId(null);
    setNewRole({ title: '', description: '', min_experience: 0, required_skills: [] });
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role.id);
    setNewRole({
      title: role.title || '',
      description: role.description || '',
      min_experience: role.min_experience || 0,
      required_skills: role.required_skills || [],
    });
    setShowAddRole(true);
  };

  const handleDeleteRole = async (roleId) => {
    if (!roleId) {
      if (!window.confirm("WARNING: Are you sure you want to delete ALL job roles? This action is permanent and cannot be undone.")) return;
      try {
        await sourceApi.deleteAllJobRoles();
        toast.success("All job roles deleted");
        fetchRoles();
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to delete all job roles");
      }
      return;
    }

    if (!window.confirm("Are you sure you want to delete this job role? This action cannot be undone.")) return;
    try {
      await sourceApi.deleteJobRole(roleId);
      toast.success("Job role deleted");
      fetchRoles();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete job role");
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>Job Roles</h1>
          <p>Define roles and standard requirements to match candidates against</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {canManageRoles && (
            <button className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteRole(null)}>
              Delete All
            </button>
          )}
          {canManageRoles && (
            <button className="btn btn-primary" onClick={() => setShowAddRole(true)}>
              <Plus size={16} /> Add Job Role
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : jobRoles.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={48} color="var(--text-muted)" style={{ opacity: 0.5, marginBottom: 16 }} />
            <p>No job roles defined. Create one to enable AI candidate scoring.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {jobRoles.map((role, i) => (
              <div key={role.id} className={`card animate-fade-in stagger-${Math.min(i + 1, 5)}`} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: 'var(--text-primary)' }}>{role.title}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} /> Min. {role.min_experience} years exp
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: 8 }}>
                    {canEditRoles && (
                      <button className="btn btn-ghost btn-sm" style={{ padding: 6, height: 'auto' }} onClick={() => handleEditRole(role)} title="Edit Role">
                        <Edit size={16} />
                      </button>
                    )}
                    {canManageRoles && (
                      <button className="btn btn-ghost btn-sm" style={{ padding: 6, height: 'auto', color: 'var(--danger)' }} onClick={() => handleDeleteRole(role.id)} title="Delete Role">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {role.required_skills && role.required_skills.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8 }}>Required Skills</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {role.required_skills.slice(0, 5).map((skill, j) => (
                        <span key={j} className="skill-tag" style={{ fontSize: '0.75rem' }}>{skill.skill} ({skill.level})</span>
                      ))}
                      {role.required_skills.length > 5 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '2px 4px' }}>+{role.required_skills.length - 5} more</span>
                      )}
                    </div>
                  </div>
                )}
                
                {!role.required_skills || role.required_skills.length === 0 && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No specific skills extracted from JD.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Role Modal ── */}
      {showAddRole && (
        <div className="modal-overlay" onClick={resetRoleModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>{editingRoleId ? 'Edit Job Role' : 'Create Job Role'}</h4>
              <button className="btn btn-ghost btn-sm" onClick={resetRoleModal}>✕</button>
            </div>
            <form onSubmit={handleCreateRole}>
              <div className="modal-body">
                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {editingRoleId
                    ? 'Update the role details and latest job description. The system will refresh required skills from the updated JD.'
                    : 'Create a role to measure candidates against. AI Fit Scores will compare candidate skills vs. role requirements.'}
                </p>
                <div className="form-group">
                  <label className="form-label">Role Title *</label>
                  <input required className="form-control" placeholder="e.g. Senior Backend Engineer" value={newRole.title} onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))} />
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Minimum Experience (Years)</label>
                  <input type="number" min="0" className="form-control" value={newRole.min_experience} onChange={e => setNewRole(r => ({ ...r, min_experience: parseInt(e.target.value || '0', 10) }))} />
                </div>
                <div className="form-group" style={{ marginTop: 16 }}>
                  <label className="form-label">Job Description (Optional, for ATS matching)</label>
                  <textarea className="form-control" rows={4} placeholder="Paste the full job description here. Our AI will automatically extract required skills." value={newRole.description} onChange={e => setNewRole(r => ({ ...r, description: e.target.value }))} />
                </div>
                {editingRoleId && (
                  <div className="form-group" style={{ marginTop: 16 }}>
                    <label className="form-label">System-Extracted Skills (What AI Wrote)</label>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                      If you provided a Job Description, the AI extracted these skills. If you left it blank, the AI inferred them from the Title.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      {newRole.required_skills && newRole.required_skills.length > 0 ? (
                        newRole.required_skills.map((s, idx) => (
                          <div key={idx} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: 20, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600 }}>{s.skill}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>({s.level})</span>
                            <button type="button" onClick={() => {
                              const updated = [...newRole.required_skills];
                              updated.splice(idx, 1);
                              setNewRole(r => ({ ...r, required_skills: updated }));
                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, display: 'flex' }} title="Remove Skill">✕</button>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No skills generated.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={resetRoleModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addingRole}>
                  {addingRole ? (editingRoleId ? 'Saving...' : 'Creating...') : (editingRoleId ? 'Save Changes' : 'Create Role')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
