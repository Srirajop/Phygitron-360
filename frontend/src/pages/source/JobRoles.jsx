import React, { useState, useEffect } from 'react';
import { sourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Briefcase, Edit, Trash2, Plus, Users, Sparkles, Loader, X, Info, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const LEVEL_CONFIG = {
  expert: { label: 'Expert', bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe', weight: 4 },
  advanced: { label: 'Advanced', bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', weight: 3 },
  intermediate: { label: 'Intermediate', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0', weight: 2 },
  beginner: { label: 'Beginner', bg: '#fffbeb', color: '#d97706', border: '#fde68a', weight: 1 },
};

export default function JobRoles() {
  const { user } = useAuth();
  const [jobRoles, setJobRoles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState({ title: '', description: '', min_experience: 0, required_skills: [] });
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [addingRole, setAddingRole] = useState(false);

  // Skill Extraction & Manual Editing State
  const [extractingSkills, setExtractingSkills] = useState(false);
  const [customSkill, setCustomSkill] = useState({ skill: '', level: 'intermediate' });

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
    if (!newRole.title.trim()) {
      toast.error('Role Title is required');
      return;
    }
    setAddingRole(true);
    try {
      const payload = {
        title: newRole.title.trim(),
        description: newRole.description.trim() || undefined,
        min_experience: Number(newRole.min_experience) || 0,
        required_skills: newRole.required_skills || [],
      };

      if (editingRoleId) {
        await sourceApi.updateJobRole(editingRoleId, payload);
        toast.success('Role updated successfully!');
      } else {
        await sourceApi.createJobRole(payload);
        toast.success('Role created successfully!');
      }
      fetchRoles();
      resetRoleModal();
    } catch (err) {
      toast.error(err?.response?.data?.detail || (editingRoleId ? 'Failed to update role' : 'Failed to create role'));
    } finally {
      setAddingRole(false);
    }
  };

  const resetRoleModal = () => {
    setShowAddRole(false);
    setEditingRoleId(null);
    setNewRole({ title: '', description: '', min_experience: 0, required_skills: [] });
    setCustomSkill({ skill: '', level: 'intermediate' });
    setExtractingSkills(false);
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role.id);
    setNewRole({
      title: role.title || '',
      description: role.description || '',
      min_experience: role.min_experience || 0,
      required_skills: role.required_skills || [],
    });
    setCustomSkill({ skill: '', level: 'intermediate' });
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

  // On-demand AI Extraction from JD
  const handleExtractSkills = async () => {
    if (!newRole.description?.trim() && !newRole.title?.trim()) {
      toast.error('Please enter a Role Title or paste a Job Description first');
      return;
    }
    setExtractingSkills(true);
    try {
      const res = await sourceApi.extractJdSkills({
        description: newRole.description,
        title: newRole.title,
      });
      const extracted = res.data.data || [];
      if (extracted.length === 0) {
        toast('No skills could be extracted automatically. You can add them manually below.', { icon: 'ℹ️' });
      } else {
        // Merge without duplicates (case-insensitive)
        const existingNames = new Set((newRole.required_skills || []).map(s => (s.skill || '').toLowerCase().trim()));
        const newlyAdded = extracted.filter(s => !existingNames.has((s.skill || '').toLowerCase().trim()));
        const merged = [...(newRole.required_skills || []), ...newlyAdded];
        setNewRole(r => ({ ...r, required_skills: merged }));
        toast.success(`Extracted ${extracted.length} skills! Review and tweak proficiency levels below.`);
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to extract skills with AI');
    } finally {
      setExtractingSkills(false);
    }
  };

  // Add a custom skill manually
  const handleAddCustomSkill = (e) => {
    if (e) e.preventDefault();
    const name = (customSkill.skill || '').trim();
    if (!name) return;
    const exists = (newRole.required_skills || []).some(s => (s.skill || '').toLowerCase().trim() === name.toLowerCase());
    if (exists) {
      toast.error(`Skill "${name}" is already in the list`);
      return;
    }
    setNewRole(r => ({
      ...r,
      required_skills: [...(r.required_skills || []), { skill: name, level: customSkill.level || 'intermediate' }],
    }));
    setCustomSkill({ skill: '', level: 'intermediate' });
  };

  // Update skill level
  const handleUpdateSkillLevel = (index, newLevel) => {
    setNewRole(r => {
      const updated = [...(r.required_skills || [])];
      updated[index] = { ...updated[index], level: newLevel };
      return { ...r, required_skills: updated };
    });
  };

  // Remove single skill
  const handleRemoveSkill = (index) => {
    setNewRole(r => {
      const updated = [...(r.required_skills || [])];
      updated.splice(index, 1);
      return { ...r, required_skills: updated };
    });
  };

  // Clear all skills
  const handleClearAllSkills = () => {
    setNewRole(r => ({ ...r, required_skills: [] }));
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
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
                      <button className="btn btn-ghost btn-sm" style={{ padding: 6, height: 'auto' }} onClick={() => handleEditRole(role)} title="Edit Role & Skills">
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

                {role.description && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {role.description}
                  </div>
                )}

                {role.required_skills && role.required_skills.length > 0 ? (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Required Skills ({role.required_skills.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {role.required_skills.slice(0, 8).map((skill, j) => {
                        const lvl = (skill.level || 'intermediate').toLowerCase();
                        const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.intermediate;
                        return (
                          <span 
                            key={j} 
                            style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 500,
                              padding: '3px 8px', 
                              borderRadius: 6,
                              background: cfg.bg, 
                              color: cfg.color, 
                              border: `1px solid ${cfg.border}`,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <span>{skill.skill}</span>
                            <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 600 }}>• {cfg.label}</span>
                          </span>
                        );
                      })}
                      {role.required_skills.length > 8 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '3px 6px', alignSelf: 'center' }}>
                          +{role.required_skills.length - 8} more
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No explicit skills defined. AI will infer from title keywords.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add / Edit Role Modal ── */}
      {showAddRole && (
        <div className="modal-overlay" onClick={resetRoleModal}>
          <div className="modal" style={{ maxWidth: 680, width: '95vw', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Briefcase size={20} color="var(--primary)" />
                <h4 style={{ margin: 0 }}>{editingRoleId ? 'Edit Job Role & Skill Criteria' : 'Create Job Role & Skill Criteria'}</h4>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={resetRoleModal}>✕</button>
            </div>
            
            <form onSubmit={handleCreateRole} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', padding: '20px 24px', flex: 1 }}>
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Define the role details and job description. You can have AI automatically extract skills with suggested proficiency levels, and then manually edit or add any skill requirements to ensure candidate matching fits your exact criteria.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Role Title *</label>
                    <input 
                      required 
                      className="form-control" 
                      placeholder="e.g. Senior Backend Engineer" 
                      value={newRole.title} 
                      onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Min Experience (Years)</label>
                    <input 
                      type="number" 
                      min="0" 
                      max="40"
                      className="form-control" 
                      value={newRole.min_experience} 
                      onChange={e => setNewRole(r => ({ ...r, min_experience: parseInt(e.target.value || '0', 10) }))} 
                    />
                  </div>
                </div>

                {/* Job Description with Extract Button */}
                <div className="form-group" style={{ marginTop: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label className="form-label" style={{ margin: 0 }}>Job Description (JD)</label>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleExtractSkills}
                      disabled={extractingSkills || (!newRole.description?.trim() && !newRole.title?.trim())}
                      style={{ fontSize: '0.78rem', padding: '4px 12px', height: 'auto', gap: 6 }}
                      title="Analyze Job Description with AI and extract required skills"
                    >
                      {extractingSkills ? <Loader size={13} className="spinner" /> : <Sparkles size={13} color="#8b5cf6" />}
                      {extractingSkills ? 'Extracting with AI...' : '⚡ Extract Skills with AI'}
                    </button>
                  </div>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    placeholder="Paste the full job description here. Click 'Extract Skills with AI' above to inspect and customize skills and levels." 
                    value={newRole.description} 
                    onChange={e => setNewRole(r => ({ ...r, description: e.target.value }))} 
                  />
                </div>

                {/* Required Skills & Proficiency Levels Editor */}
                <div className="form-group" style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>Required Skills & Proficiency Levels</span>
                        <span style={{ 
                          fontSize: '0.72rem', 
                          fontWeight: 600, 
                          color: 'var(--primary)', 
                          background: 'rgba(99, 102, 241, 0.1)', 
                          padding: '2px 8px', 
                          borderRadius: 12 
                        }}>
                          {(newRole.required_skills || []).length} defined
                        </span>
                      </label>
                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        HR has full control: choose whether each skill requires Beginner, Intermediate, Advanced, or Expert.
                      </span>
                    </div>
                    {(newRole.required_skills || []).length > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.72rem', color: 'var(--danger)', padding: '2px 8px', height: 'auto' }}
                        onClick={handleClearAllSkills}
                      >
                        Clear All
                      </button>
                    )}
                  </div>

                  {/* Skills Grid */}
                  <div style={{ 
                    background: 'var(--bg-secondary)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 10, 
                    padding: 12,
                    minHeight: 80,
                    maxHeight: 220,
                    overflowY: 'auto'
                  }}>
                    {(newRole.required_skills || []).length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        No skills defined yet. Click <strong>"⚡ Extract Skills with AI"</strong> above or add skills manually below.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {newRole.required_skills.map((item, idx) => {
                          const lvl = (item.level || 'intermediate').toLowerCase();
                          const cfg = LEVEL_CONFIG[lvl] || LEVEL_CONFIG.intermediate;
                          return (
                            <div 
                              key={idx} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6, 
                                background: '#fff', 
                                border: `1px solid ${cfg.border}`, 
                                padding: '4px 8px', 
                                borderRadius: 8,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                              }}
                            >
                              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                                {item.skill}
                              </span>

                              {/* Level Selector */}
                              <select
                                value={lvl}
                                onChange={e => handleUpdateSkillLevel(idx, e.target.value)}
                                style={{
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: cfg.bg,
                                  color: cfg.color,
                                  border: `1px solid ${cfg.border}`,
                                  cursor: 'pointer',
                                  outline: 'none',
                                }}
                              >
                                <option value="beginner">Beginner (1 pt)</option>
                                <option value="intermediate">Intermediate (2 pts)</option>
                                <option value="advanced">Advanced (3 pts)</option>
                                <option value="expert">Expert (4 pts)</option>
                              </select>

                              {/* Remove Button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveSkill(idx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: 'var(--danger)',
                                  padding: '2px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  opacity: 0.75,
                                }}
                                title="Remove skill"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Add Manual Skill Form */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Add skill manually (e.g. Java, Docker, React)..."
                      value={customSkill.skill}
                      onChange={e => setCustomSkill(s => ({ ...s, skill: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomSkill();
                        }
                      }}
                      style={{ flex: 1, fontSize: '0.82rem', borderRadius: 8 }}
                    />
                    
                    <select
                      className="form-control"
                      value={customSkill.level}
                      onChange={e => setCustomSkill(s => ({ ...s, level: e.target.value }))}
                      style={{ width: 140, fontSize: '0.82rem', borderRadius: 8 }}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleAddCustomSkill}
                      style={{ fontSize: '0.8rem', padding: '6px 14px', height: 'auto', gap: 4 }}
                    >
                      <Plus size={14} /> Add Skill
                    </button>
                  </div>

                  {/* Informational Guidance Box */}
                  <div style={{ 
                    marginTop: 12, padding: '10px 12px', borderRadius: 8, 
                    background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)',
                    display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.75rem', color: 'var(--text-secondary)'
                  }}>
                    <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Manual Control & Priority:</strong> You can elevate critical skills to <strong>Expert</strong> so candidates with proven expert mastery rank highest. Candidates with lower proficiency (e.g., Intermediate) will receive proportional penalty deductions during ATS scoring.
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn btn-ghost" onClick={resetRoleModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addingRole || extractingSkills}>
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
