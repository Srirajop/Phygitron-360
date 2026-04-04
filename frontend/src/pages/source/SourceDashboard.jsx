import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sourceApi } from '../../api';
import { Search, Filter, Upload, Users, Send, CheckSquare, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function ScoreBadge({ score }) {
  if (score == null) return <span className="badge badge-muted">—</span>;
  const cls = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return <div className={`score-badge ${cls}`}>{Math.round(score)}%</div>;
}

export default function SourceDashboard() {
  const [candidates, setCandidates] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [filters, setFilters] = useState({ pool: 'all', location: '', min_exp: 0, sort_by: 'newest', limit: 20, role_id: '' });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState({ title: '', min_experience: 0 });
  const [addingRole, setAddingRole] = useState(false);
  const [scoring, setScoring] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    sourceApi.listJobRoles().then(r => setJobRoles(r.data.data || []));
  }, []);

  const fetchCandidates = useCallback(() => {
    setLoading(true);
    const apiParams = { ...filters };
    if (!apiParams.role_id) delete apiParams.role_id;
    sourceApi.searchCandidates(apiParams)
      .then(r => setCandidates(r.data.data || []))
      .catch((err) => { setCandidates([]); toast.error('Failed to load candidates'); })
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => { fetchCandidates(); }, [filters.sort_by, filters.limit, filters.role_id, filters.pool, filters.location]);

  const toggleSelect = (id) => setSelected(s => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm("Are you sure you want to delete this resume? This action cannot be undone.")) return;
    try {
      await sourceApi.deleteCandidate(id);
      toast.success("Resume deleted");
      setSelected(s => { const ns = new Set(s); ns.delete(id); return ns; });
      setCandidates(c => c.filter(x => x.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete resume");
    }
  };

  const sendInvites = async () => {
    if (!inviteRoleId) { toast.error('Select a job role'); return; }
    try {
      const payload = { 
        candidate_ids: [...selected], 
        job_role_id: parseInt(inviteRoleId) 
      };
      if (selected.size === 1 && inviteEmail) {
        payload.email_addresses = [inviteEmail];
      }
      await sourceApi.sendInvite(payload);

      toast.success(`Invites sent to ${selected.size} candidates!`);
      setSelected(new Set()); setShowInviteModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send invites');
    }
  };

  const handleOpenInvite = () => {
    if (selected.size === 1) {
      const id = [...selected][0];
      const cand = candidates.find(c => c.id === id);
      if (cand) setInviteEmail(cand.email || '');
    } else {
      setInviteEmail('');
    }
    setShowInviteModal(true);
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRole.title) return;
    setAddingRole(true);
    try {
      await sourceApi.createJobRole(newRole);
      toast.success('Role created successfully!');
      sourceApi.listJobRoles().then(r => setJobRoles(r.data.data || []));
      setShowAddRole(false);
      setNewRole({ title: '', min_experience: 0 });
    } catch {
      toast.error('Failed to create role');
    } finally {
      setAddingRole(false);
    }
  };



  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>Talent Vault</h1>
          <p>Manage resumes, score candidates, and send invitations</p>
        </div>
        <Link to="/source/upload" className="btn btn-shimmer"><Upload size={16} /> Upload Resumes</Link>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div className="stats-grid animate-fade-in">
          {[
            { label: 'Total Resumes', value: candidates.length, icon: <Users size={18} /> },
            { label: 'Scored (AI)', value: candidates.filter(c => c.fit_score != null).length, icon: <Star size={18} /> },
            { label: 'Shortlisted', value: selected.size, icon: <CheckSquare size={18} /> },
            { label: 'Active Roles', value: jobRoles.length, icon: <Filter size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Job Role</label>
                <button type="button" onClick={() => setShowAddRole(true)} className="btn btn-ghost btn-sm" style={{ padding: '0 4px', height: '18px', fontSize: '11px', color: 'var(--primary)' }}>+ Add New</button>
              </div>
              <select className="form-control" value={filters.role_id} onChange={e => {
                setFilters(f => {
                  const nf = { ...f, role_id: e.target.value };
                  if (!e.target.value && nf.sort_by === 'fit_score') nf.sort_by = 'newest';
                  return nf;
                });
              }}>
                <option value="">All Roles</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="form-label">Talent Pool</label>
              <select className="form-control" value={filters.pool} onChange={e => setFilters(f => ({ ...f, pool: e.target.value }))}>
                <option value="all">All Pools</option>
                <option value="candidate">Candidates (Resumes)</option>
                <option value="trainee">Trainees (Testing)</option>
                <option value="employee">Employees (Hired)</option>
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="form-label">Min Experience</label>
              <input type="number" className="form-control" min={0} max={20} value={filters.min_exp} onChange={e => setFilters(f => ({ ...f, min_exp: parseInt(e.target.value) }))} />
            </div>
            <div style={{ minWidth: 160 }}>
              <label className="form-label">Location</label>
              <input type="text" className="form-control" placeholder="City / Remote" value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="form-label">Sort By</label>
              <select className="form-control" value={filters.sort_by} onChange={e => setFilters(f => ({ ...f, sort_by: e.target.value }))}>
                <option value="newest">Newest First</option>
                {filters.role_id && <option value="fit_score">Fit Score (High → Low)</option>}
                <option value="experience">Experience</option>
              </select>
            </div>
            <div style={{ minWidth: 120 }}>
              <label className="form-label">Show</label>
              <select className="form-control" value={filters.limit} onChange={e => setFilters(f => ({ ...f, limit: parseInt(e.target.value) }))}>
                {[5, 10, 20, 50].map(n => <option key={n} value={n}>Top {n}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" onClick={fetchCandidates}><Search size={16} /> Search</button>
          </div>
        </div>

        {/* Candidate List */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : candidates.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🔍</div><p>No candidates found. Upload resumes to get started.</p></div>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {candidates.map((c, i) => (
              <div key={c.id} className={`candidate-card animate-fade-in stagger-${Math.min(i+1,5)} ${selected.has(c.id) ? 'selected' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <input type="checkbox" style={{ marginTop: 4, accentColor: 'var(--primary)', width: 16, height: 16 }}
                    checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>
                        {c.name?.[0] || '?'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name} <span style={{ fontWeight: 400, fontSize: '0.8rem', opacity: 0.7 }}>({c.type})</span></div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.location} · {c.exp_years > 0 ? `${c.exp_years} yrs exp` : 'New'}</div>
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ScoreBadge score={c.fit_score} />
                        <span className={`badge badge-${c.status === 'active' ? 'success' : c.status === 'shortlisted' ? 'info' : 'muted'}`}>{c.status}</span>
                      </div>
                    </div>
                    <div className="chip-list">
                      {(c.skills || []).slice(0, 5).map((s, j) => (
                        <span key={j} className="skill-tag">{s.name} · {s.level}</span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteCandidate(c.id)} title="Delete Resume"><Trash2 size={16} color="var(--danger)" /></button>
                    <Link to={`/source/candidates/${c.id}`} className="btn btn-secondary btn-sm">View Profile</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating action bar */}
      {selected.size > 0 && (
        <div className="fab-bar">
          <span>{selected.size} selected</span>
          <button className="btn btn-primary" onClick={handleOpenInvite}><Send size={16} /> Send Invite</button>
          <button className="btn btn-ghost" onClick={() => setSelected(new Set())} style={{ color: 'rgba(255,255,255,0.7)' }}>Clear</button>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Send Invitations</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInviteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16 }}>Sending invites to <strong>{selected.size}</strong> candidate(s).</p>
              
              {selected.size === 1 && (
                <div className="form-group">
                  <label className="form-label">Candidate Email *</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    value={inviteEmail} 
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="e.g. candidate@example.com"
                  />
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Job Role *</label>
                <select className="form-control" value={inviteRoleId} onChange={e => setInviteRoleId(e.target.value)}>
                  <option value="">Select role</option>
                  {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowInviteModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={sendInvites}><Send size={14} /> Send {selected.size} Invite{selected.size !== 1 ? 's' : ''}</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Role Modal */}
      {showAddRole && (
        <div className="modal-overlay" onClick={() => setShowAddRole(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Create Job Role</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowAddRole(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateRole}>
              <div className="modal-body">
                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Add a real job description instead of dummy data to measure AI fit scores accurately.
                </p>
                <div className="form-group">
                  <label className="form-label">Role Title *</label>
                  <input required className="form-control" placeholder="e.g. Senior Backend Engineer" value={newRole.title} onChange={e => setNewRole(r => ({ ...r, title: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Required Min Experience (Years)</label>
                  <input type="number" min="0" className="form-control" value={newRole.min_experience} onChange={e => setNewRole(r => ({ ...r, min_experience: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAddRole(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={addingRole}>{addingRole ? 'Creating...' : 'Create Role'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
