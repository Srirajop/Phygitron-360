import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Search, Filter, Upload, Users, Send, Star, Trash2, Layers, BarChart2, Zap, X, ChevronDown, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

/* ── Score Badge ─────────────────────────────────────────────────────────── */
function CircularScore({ score, title }) {
  const valid = score != null && score >= 0;
  const fillPct = valid ? score : 0;
  const radius = 18; 
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (fillPct / 100) * circumference;
  const color = score == null ? 'var(--border)' : score >= 70 ? '#10B981' : score >= 40 ? '#F59E0B' : '#EF4444';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ position: 'relative', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="44" height="44" style={{ transform: 'rotate(-90deg)', filter: valid ? `drop-shadow(0 2px 4px ${color}30)` : 'none' }}>
          <circle cx="22" cy="22" r={radius} fill="none" stroke="#F3F4F6" strokeWidth="4" />
          <circle 
            cx="22" cy="22" r={radius} fill="none" 
            stroke={color} strokeWidth="4" 
            strokeDasharray={circumference} 
            strokeDashoffset={strokeDashoffset} 
            strokeLinecap="round" 
            style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} 
          />
        </svg>
        <span style={{ position: 'absolute', fontSize: '0.8rem', fontWeight: 800, color: valid ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {valid ? Math.round(score) : '-'}
        </span>
      </div>
    </div>
  );
}

/* ── Comparison Modal ────────────────────────────────────────────────────── */
function CompareModal({ candidates, onClose, requiredSkills = [] }) {
  if (!candidates || candidates.length < 2) return null;
  const levelRank = { expert: 4, advanced: 3, intermediate: 2, beginner: 1 };
  const levelColor = { expert: '#7C3AED', advanced: '#10B981', intermediate: '#3B82F6', beginner: '#F59E0B' };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(12px)', backgroundColor: 'rgba(15, 23, 42, 0.7)' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1000, width: '95%', background: '#fff', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <div className="modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(to right, #f8fafc, #fff)' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>Rational Talent Duel</h4>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Comparison based on Role Fit & Unique Value</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ borderRadius: '50%', width: 36, height: 36, padding: 0 }}><X size={20} /></button>
        </div>
        
        <div className="modal-body" style={{ padding: '32px', overflowY: 'auto', maxHeight: '75vh' }}>
          {/* Top Profile Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${candidates.length}, 1fr)`, gap: 24, marginBottom: 40 }}>
            {candidates.map(c => {
              const bestScore = Math.max(...candidates.map(x => x.ats_score || 0));
              const isLeader = c.ats_score === bestScore && bestScore > 0;
              return (
                <div key={c.id} style={{ padding: '24px', borderRadius: 20, border: isLeader ? '2px solid var(--primary)' : '1px solid var(--border)', background: isLeader ? 'rgba(124, 58, 237, 0.03)' : '#fdfdfd', textAlign: 'center', position: 'relative', boxShadow: isLeader ? '0 10px 15px -3px rgba(124, 58, 237, 0.1)' : 'none' }}>
                  {isLeader && (
                    <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: 'white', padding: '4px 14px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 6px -1px rgba(124, 58, 237, 0.3)' }}>
                      <Zap size={12} fill="white" /> PRIMARY CHOICE
                    </div>
                  )}
                  
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary) 0%, #4f46e5 100%)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 800, margin: '0 auto 16px', boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.2)' }}>
                    {c.name?.charAt(0)}
                  </div>
                  
                  <h5 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: 800 }}>{c.name}</h5>
                  <p style={{ margin: '0 0 24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.location || 'Remote'} · {c.exp_years}y Exp</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
                    <CircularScore score={c.ats_score} title="Role Fit" />
                    <CircularScore score={c.resume_ats_score} title="Resume ATS" />

                  </div>
                </div>
              );
            })}
          </div>

          {/* Rational Section 1: Role Alignment */}
          <div style={{ marginBottom: 40 }}>
            <h5 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Filter size={18} /> Role Requirement Alignment
            </h5>
            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 16 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '16px 24px', textAlign: 'left', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Metric / Skill Required</th>
                    {candidates.map(c => (
                      <th key={c.id} style={{ padding: '16px 24px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>{c.name?.split(' ')[0]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {requiredSkills.length > 0 ? requiredSkills.map(req => {
                    const reqName = req.skill?.toLowerCase()?.trim();
                    if (!reqName) return null;
                    return (
                      <tr key={req.skill} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '16px 24px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e293b' }}>{req.skill}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>Target: {req.level}</div>
                        </td>
                        {candidates.map(c => {
                          const candSkill = (c.skills || []).find(s => {
                            const sName = s.name?.toLowerCase()?.trim();
                            return sName === reqName || sName?.includes(reqName);
                          });
                          const met = candSkill && (levelRank[candSkill.level?.toLowerCase()] ?? 0) >= (levelRank[req.level?.toLowerCase()] ?? 0);
                          const hasSkill = !!candSkill;

                          return (
                            <td key={c.id} style={{ padding: '16px 24px', textAlign: 'center' }}>
                              {met ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  <div style={{ background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 800 }}>ALIGNED</div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#444' }}>{candSkill.level}</span>
                                </div>
                              ) : hasSkill ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                  <div style={{ background: '#fef3c7', color: '#92400e', padding: '4px 12px', borderRadius: 20, fontSize: '0.7rem', fontWeight: 800 }}>GAP: {req.level}</div>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#444' }}>{candSkill.level}</span>
                                </div>
                              ) : (
                                <div style={{ color: '#cbd5e1', fontSize: '0.75rem', fontWeight: 700 }}>NOT DETECTED</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  }) : (
                    <tr>
                      <td colSpan={candidates.length + 1} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        No specific skills were required for this role query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rational Section 2: Unique Edge & Bonus Value */}
          <div>
            <h5 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <Zap size={18} /> Candidate "Unique Edge" (Bonus Strengths)
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${candidates.length}, 1fr)`, gap: 24 }}>
              {candidates.map(c => {
                const reqNames = requiredSkills.map(r => r.skill?.toLowerCase()?.trim()).filter(Boolean);
                const bonusSkills = (c.skills || [])
                  .filter(s => {
                    const sName = s.name?.toLowerCase()?.trim();
                    return sName && !reqNames.some(rn => sName.includes(rn) || rn.includes(sName));
                  })
                  .sort((a, b) => levelRank[b.level?.toLowerCase()] - levelRank[a.level?.toLowerCase()])
                  .slice(0, 3);

                return (
                  <div key={c.id} style={{ padding: '24px', borderRadius: 16, background: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', marginBottom: 12, textTransform: 'uppercase' }}>Extra Value Props</div>
                    {bonusSkills.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {bonusSkills.map(s => (
                          <div key={s.name} style={{ background: '#fff', border: '1px solid #e2e8f0', padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Star size={12} fill="var(--warning)" color="var(--warning)" /> {s.name}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No additional distinct skills detected.</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        <div className="modal-footer" style={{ padding: '20px 32px', background: '#f8fafc', borderRadius: '0 0 24px 24px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ fontWeight: 600 }}>Close Duel</button>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary" disabled style={{ opacity: 0.5 }}>Export Analysis</button>
            <button className="btn btn-primary" onClick={onClose} style={{ padding: '10px 24px' }}>Finalize Review</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */
let cachedCandidates = null;
let cachedFiltersStr = null;

export default function SourceDashboard() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState(cachedCandidates || []);
  const [jobRoles, setJobRoles] = useState([]);
  const [loading, setLoading] = useState(!cachedCandidates);
  const [selected, setSelected] = useState(new Set());
  const [filters, setFilters] = useState(() => {
    try {
      const saved = sessionStorage.getItem('talentVaultFilters');
      return saved ? JSON.parse(saved) : { pool: 'all', sort_by: 'newest', limit: 100, role_id: '', search: '', location: '', exp_range: '' };
    } catch {
      return { pool: 'all', sort_by: 'newest', limit: 100, role_id: '', search: '', location: '', exp_range: '' };
    }
  });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showAddRole, setShowAddRole] = useState(false);
  const [newRole, setNewRole] = useState({ title: '', description: '', min_experience: 0 });
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [addingRole, setAddingRole] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [sortCriteria, setSortCriteria] = useState(() => {
    try {
      const saved = sessionStorage.getItem('talentVaultSort');
      return saved ? JSON.parse(saved) : ['newest'];
    } catch {
      return ['newest'];
    }
  });

  useEffect(() => {
    sessionStorage.setItem('talentVaultFilters', JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    sessionStorage.setItem('talentVaultSort', JSON.stringify(sortCriteria));
  }, [sortCriteria]);
  const searchTimer = useRef(null);
  const nav = useNavigate();
  const candidateKey = (c) => `${c.is_employee ? 'employee' : 'candidate'}-${c.id}`;
  const canManageRoles = ['hr', 'org_admin'].includes(user?.role);
  const canEditRoles = canManageRoles || user?.role === 'manager';

  useEffect(() => {
    sourceApi.listJobRoles().then(r => setJobRoles(r.data.data || []));
  }, []);

  const fetchCandidates = useCallback(() => {
    const apiParams = { ...filters };
    apiParams.sort_by = sortCriteria.join(',');
    if (!apiParams.role_id) {
      delete apiParams.role_id;
      // If no role, remove fit_score from sort
      const filteredSort = sortCriteria.filter(s => s !== 'fit_score');
      if (filteredSort.length !== sortCriteria.length) {
         apiParams.sort_by = filteredSort.length > 0 ? filteredSort.join(',') : 'newest';
      }
    }
    if (!apiParams.search) delete apiParams.search;
    if (!apiParams.location) delete apiParams.location;
    if (!apiParams.exp_range) delete apiParams.exp_range;
    
    const currentFiltersStr = JSON.stringify(apiParams);
    if (cachedCandidates && cachedFiltersStr === currentFiltersStr) {
      setCandidates(cachedCandidates);
      setLoading(false);
      return;
    }

    setLoading(true);
    sourceApi.searchCandidates(apiParams)
      .then(r => {
        const data = r.data.data || [];
        setCandidates(data);
        cachedCandidates = data;
        cachedFiltersStr = currentFiltersStr;
      })
      .catch(() => { setCandidates([]); toast.error('Failed to load candidates'); })
      .finally(() => setLoading(false));
  }, [filters, sortCriteria]);

  // Debounced search
  const handleSearchChange = (val) => {
    setFilters(f => ({ ...f, search: val }));
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      // triggers fetchCandidates via useEffect
    }, 400);
  };

  useEffect(() => { fetchCandidates(); }, [filters.role_id, filters.pool, filters.search, filters.location, filters.exp_range, filters.limit, sortCriteria]);

  const toggleSort = (key) => {
    setSortCriteria(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key);
        return next.length === 0 ? ['newest'] : next;
      } else {
        // Move newest click to the front to make it the PRIMARY sort
        return [key, ...prev.filter(k => k !== key)];
      }
    });
  };

  const toggleSelect = (candidate) => {
    const key = candidateKey(candidate);
    setSelected(s => { const ns = new Set(s); ns.has(key) ? ns.delete(key) : ns.add(key); return ns; });
  };

  const handleDeleteCandidate = async (id) => {
    if (!window.confirm("Are you sure you want to delete this resume?")) return;
    try {
      await sourceApi.deleteCandidate(id);
      toast.success("Resume deleted");
      setSelected(s => {
        const ns = new Set(s);
        candidates.filter(x => !x.is_employee && x.id === id).forEach(x => ns.delete(candidateKey(x)));
        return ns;
      });
      setCandidates(c => {
        const nextC = c.filter(x => x.id !== id);
        if (cachedCandidates) cachedCandidates = nextC;
        return nextC;
      });
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete");
    }
  };

  const handleDeleteRole = async (roleId) => {
    if (!roleId) {
      if (!window.confirm("WARNING: Are you sure you want to delete ALL job roles? This action is permanent and cannot be undone.")) return;
      try {
        await sourceApi.deleteAllJobRoles();
        toast.success("All job roles deleted");
        setFilters(f => ({ ...f, role_id: '' }));
        setSortCriteria(prev => prev.filter(k => k !== 'fit_score'));
        sourceApi.listJobRoles().then(r => setJobRoles(r.data.data || []));
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to delete all job roles");
      }
      return;
    }

    if (!window.confirm("Are you sure you want to delete this job role? This action cannot be undone.")) return;
    try {
      await sourceApi.deleteJobRole(roleId);
      toast.success("Job role deleted");
      setFilters(f => ({ ...f, role_id: '' }));
      setSortCriteria(prev => prev.filter(k => k !== 'fit_score'));
      sourceApi.listJobRoles().then(r => setJobRoles(r.data.data || []));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete job role");
    }
  };

  /* ── AI Score Generation ─── */
  const handleScoreCandidates = async () => {
    if (!filters.role_id) { toast.error('Select a Job Role first to generate AI scores'); return; }
    const selectedCandidateRows = candidates.filter(c => !c.is_employee && selected.has(candidateKey(c)));
    const ids = selectedCandidateRows.length > 0
      ? selectedCandidateRows.map(c => c.id)
      : candidates.filter(c => !c.is_employee).map(c => c.id);
    if (ids.length === 0) { toast.error('No candidates to score'); return; }
    setScoring(true);
    try {
      const res = await sourceApi.scoreCandidates({ role_id: parseInt(filters.role_id), candidate_ids: ids });
      toast.success(res.data.message || `Scored ${ids.length} candidates`);
      cachedFiltersStr = null; // force refetch
      fetchCandidates(); // Reload to show new scores
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Scoring failed — check if AI agent is configured');
    } finally {
      setScoring(false);
    }
  };

  const sendInvites = async () => {
    if (!inviteRoleId) { toast.error('Select a job role'); return; }
    const candidateIds = candidates.filter(c => !c.is_employee && selected.has(candidateKey(c))).map(c => c.id);
    if (candidateIds.length === 0) { toast.error('Select at least one candidate or trainee to invite'); return; }
    try {
      const payload = { candidate_ids: candidateIds, job_role_id: parseInt(inviteRoleId) };
      if (candidateIds.length === 1 && inviteEmail) payload.email_addresses = [inviteEmail];
      await sourceApi.sendInvite(payload);
      toast.success(`Invites sent to ${candidateIds.length} candidates!`);
      setSelected(new Set()); setShowInviteModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send invites');
    }
  };

  const handleOpenInvite = () => {
    if (selected.size === 1) {
      const key = [...selected][0];
      const cand = candidates.find(c => candidateKey(c) === key && !c.is_employee);
      if (cand) setInviteEmail(cand.email || '');
    } else { setInviteEmail(''); }
    setShowInviteModal(true);
  };

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
      sourceApi.listJobRoles().then(r => setJobRoles(r.data.data || []));
      setShowAddRole(false);
      setNewRole({ title: '', description: '', min_experience: 0 });
      setEditingRoleId(null);
    } catch { toast.error(editingRoleId ? 'Failed to update role' : 'Failed to create role'); }
    finally { setAddingRole(false); }
  };

  const resetRoleModal = () => {
    setShowAddRole(false);
    setEditingRoleId(null);
    setNewRole({ title: '', description: '', min_experience: 0 });
  };

  const handleEditRole = () => {
    if (!filters.role_id) {
      toast.error('Select a role first');
      return;
    }
    const role = jobRoles.find(r => r.id === parseInt(filters.role_id, 10));
    if (!role) {
      toast.error('Role not found');
      return;
    }
    setEditingRoleId(role.id);
    setNewRole({
      title: role.title || '',
      description: role.description || '',
      min_experience: role.min_experience || 0,
    });
    setShowAddRole(true);
  };

  const selectedCandidates = candidates.filter(c => selected.has(candidateKey(c)));
  const scoredCount = candidates.filter(c => c.ats_score != null && c.ats_score > 0).length;

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>Talent Vault</h1>
          <p>Search, compare, and score candidates against roles</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
{/*
          <button className="btn btn-secondary" disabled={!filters.role_id || scoring} onClick={handleScoreCandidates}>
            <Star size={16} /> {scoring ? 'Scoring...' : 'Refresh Fit Scores'}
          </button>
*/}

          {canManageRoles && <Link to="/source/upload" className="btn btn-shimmer"><Upload size={16} /> Upload Resumes</Link>}
        </div>
      </div>

      <div className="page-body">
        {/* ── Stats ── */}
        <div className="stats-grid animate-fade-in">
          {[
            { label: 'Total Results', value: candidates.length, icon: <Users size={18} /> },
            { label: 'ATS Scored', value: scoredCount, icon: <Star size={18} /> },
            { label: 'Selected', value: selected.size, icon: <ArrowUpDown size={18} /> },
            { label: 'Active Roles', value: jobRoles.length, icon: <Filter size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Search Bar ── */}
        <div className="card animate-fade-in" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <Search size={18} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={filters.search}
              onChange={e => handleSearchChange(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '0.95rem', color: 'var(--text-primary)' }}
            />
            {filters.search && (
              <button className="btn btn-ghost btn-sm" onClick={() => handleSearchChange('')} style={{ padding: 4 }}><X size={14} /></button>
            )}
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 250 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Job Role</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {canEditRoles && (
                    <button
                      type="button"
                      onClick={handleEditRole}
                      disabled={!filters.role_id}
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '0 4px', height: 18, fontSize: 11, color: filters.role_id ? 'var(--primary)' : 'var(--text-muted)' }}
                    >
                      Edit Role
                    </button>
                  )}
                  {canManageRoles && (
                    <button 
                      type="button" 
                      onClick={() => handleDeleteRole(filters.role_id)} 
                      className="btn btn-ghost btn-sm" 
                      style={{ padding: '0 4px', height: 18, fontSize: 11, color: 'var(--danger)' }}
                    >
                      - Delete {filters.role_id ? 'Role' : 'All Roles'}
                    </button>
                  )}
                  {canManageRoles && <button type="button" onClick={() => setShowAddRole(true)} className="btn btn-ghost btn-sm" style={{ padding: '0 4px', height: 18, fontSize: 11, color: 'var(--primary)' }}>+ Add New</button>}
                </div>
              </div>
              <select className="form-control" value={filters.role_id} onChange={e => {
                const newRoleId = e.target.value;
                setFilters(f => ({ ...f, role_id: newRoleId }));
                if (!newRoleId) {
                  setSortCriteria(prev => prev.filter(k => k !== 'fit_score'));
                } else {
                  setSortCriteria(prev => ['fit_score', ...prev.filter(k => k !== 'fit_score')]);
                }
              }}>
                <option value="">All Roles</option>
                {jobRoles.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="form-label">Talent Pool</label>
              <select className="form-control" value={filters.pool} onChange={e => setFilters(f => ({ ...f, pool: e.target.value }))}>
                <option value="all">All Talent</option>
                <option value="candidate">Candidates</option>
                <option value="trainee">Trainees</option>
                <option value="employee">Employees</option>
              </select>
            </div>
            <div style={{ minWidth: 150 }}>
              <label className="form-label">Experience</label>
              <select className="form-control" value={filters.exp_range} onChange={e => setFilters(f => ({ ...f, exp_range: e.target.value }))}>
                <option value="">Any Experience</option>
                <option value="fresher">Fresher (0 yrs)</option>
                <option value="1-2">1-2 Years</option>
                <option value="2-5">2-5 Years</option>
                <option value="5+">5+ Years</option>
              </select>
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="form-label">Location</label>
              <input type="text" className="form-control" placeholder="City / Remote" value={filters.location} onChange={e => setFilters(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div style={{ minWidth: 140 }}>
              <label className="form-label">Show Results</label>
              <select 
                className="form-control" 
                value={filters.limit} 
                onChange={e => setFilters(f => ({ ...f, limit: parseInt(e.target.value) }))}
              >
                <option value="100">All Resumes</option>
                <option value="5">Top 5 {filters.role_id && sortCriteria.includes('fit_score') ? '(Best Fit)' : ''}</option>
                <option value="10">Top 10 {filters.role_id && sortCriteria.includes('fit_score') ? '(Best Fit)' : ''}</option>
                <option value="15">Top 15</option>
                <option value="20">Top 20</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Sort By</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  type="button"
                  className={`btn btn-sm ${sortCriteria.includes('newest') ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => toggleSort('newest')}
                  style={{ borderRadius: 20, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  Recent
                </button>
                <button 
                  type="button"
                  disabled={!filters.role_id}
                  className={`btn btn-sm ${sortCriteria.includes('fit_score') ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => toggleSort('fit_score')}
                  style={{ borderRadius: 20, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600 }}
                >
                  Fit Score
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Candidate Grid ── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : candidates.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🔍</div><p>No candidates found. Upload resumes or adjust filters.</p></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            {candidates.map((c, i) => (
              <div key={candidateKey(c)} className={`card animate-fade-in stagger-${Math.min(i+1,5)}`} style={{ padding: '16px 20px', border: selected.has(candidateKey(c)) ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer', transition: 'var(--transition)', width: '100%', maxWidth: '100%', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flexWrap: 'wrap' }}>
                  {/* Checkbox */}
                  <input type="checkbox" style={{ accentColor: 'var(--primary)', width: 16, height: 16, flexShrink: 0 }}
                    checked={selected.has(candidateKey(c))} onChange={() => toggleSelect(c)} />

                  {/* Avatar */}
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                    {c.name?.[0] || '?'}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', overflowWrap: 'anywhere' }}>{c.name}</span>
                      <span className={`badge badge-${c.type === 'Employee' ? 'primary' : c.type === 'Trainee' ? 'info' : 'success'}`} style={{ fontSize: '0.7rem' }}>{c.type}</span>
                      <span className={`badge badge-${c.status === 'active' ? 'success' : c.status === 'shortlisted' ? 'info' : 'muted'}`} style={{ fontSize: '0.7rem' }}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
                      {c.location} · {c.exp_years > 0 ? `${c.exp_years} yrs exp` : 'Fresher'} · {c.email}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {(c.skills || []).slice(0, 6).map((s, j) => (
                        <span key={j} className="skill-tag" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{s.name}</span>
                      ))}
                      {(c.skills || []).length > 6 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 4px' }}>+{c.skills.length - 6} more</span>}
                    </div>
                  </div>

                  {/* Scores */}
                  <div style={{ display: 'flex', gap: 16, minWidth: 80, flexShrink: 0, justifyContent: 'flex-end', paddingRight: 16 }}>
                    {(filters.role_id || c.ats_score != null) ? (
                      <CircularScore score={c.ats_score} title="Fit Score" />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 44, opacity: 0.4 }}>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Fit Score</div>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {!c.is_employee && <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteCandidate(c.id)} title="Delete"><Trash2 size={15} color="var(--danger)" /></button>}
                    <Link to={c.is_employee ? `/deploy/employee/${c.id}` : `/source/candidates/${c.id}${filters.role_id ? `?role_id=${filters.role_id}` : ''}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem' }}>View</Link>

                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Floating Action Bar ── */}
      {selected.size > 0 && (
        <div className="fab-bar">
          <span style={{ fontWeight: 700 }}>{selected.size} selected</span>
          <div style={{ display: 'flex', gap: 10 }}>
            {selected.size >= 2 && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCompare(true)} style={{ color: 'var(--primary)', background: 'white', gap: 6 }}>
                <BarChart2 size={15} /> Compare
              </button>
            )}
            {canManageRoles && <button className="btn btn-primary btn-sm" onClick={handleOpenInvite} style={{ gap: 6 }}><Send size={15} /> Invite</button>}
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())} style={{ color: 'rgba(255,255,255,0.7)' }}>Clear</button>
          </div>
        </div>
      )}

      {/* ── Compare Modal ── */}
      {showCompare && (
        <CompareModal 
          candidates={selectedCandidates} 
          requiredSkills={jobRoles.find(r => r.id === parseInt(filters.role_id))?.required_skills || []}
          onClose={() => setShowCompare(false)} 
        />
      )}

      {/* ── Invite Modal ── */}
      {canManageRoles && showInviteModal && (
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
                  <input type="email" className="form-control" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="e.g. candidate@example.com" />
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
