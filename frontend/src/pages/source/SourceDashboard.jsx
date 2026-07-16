import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sourceApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Search, Filter, Upload, Users, Send, Star, Trash2, Layers, BarChart2, Zap, X, ChevronDown, ArrowUpDown, Edit, Folder, CalendarDays, ArrowLeft } from 'lucide-react';
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
// Caching removed to prevent stale fit scores across page navigations
const DEFAULT_FILTERS = {
  pool: 'all',
  sort_by: 'newest',
  limit: 20,
  role_id: '',
  search: '',
  location: '',
  exp_range: '',
  upload_time: '',
  upload_year: '',
  upload_month: ''
};

export default function SourceDashboard() {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [jobRoles, setJobRoles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [filters, setFilters] = useState(() => ({ ...DEFAULT_FILTERS }));

  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRoleId, setInviteRoleId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
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
  const [editingEmailId, setEditingEmailId] = useState(null);
  const [editEmailVal, setEditEmailVal] = useState('');

  // AbortController ref: cancels the in-flight search request when a new one starts.
  // This prevents stale responses from overwriting fresher data and wastes no bandwidth.
  const abortRef = useRef(null);

  const handleEditEmailSave = async (id) => {
    const trimmed = editEmailVal.trim();
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    try {
      await sourceApi.updateCandidate(id, { email: trimmed });
      toast.success('Email updated successfully');
      setEditingEmailId(null);
      // Optimistically update local state — no full refetch needed
      setCandidates(prev => prev.map(c => c.id === id && !c.is_employee ? { ...c, email: trimmed } : c));
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to update email';
      toast.error(msg);
    }
  };


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
    sourceApi.candidateStats().then(r => setStats(r.data.data || null)).catch(() => {});
  }, []);

  const fetchCandidates = useCallback(() => {
    try {
      const apiParams = { ...filters };
      if (apiParams.role_id) {
        apiParams.sort_by = ['fit_score', ...sortCriteria.filter(s => s !== 'fit_score')].join(',');
      } else {
        delete apiParams.role_id;
        const filteredSort = sortCriteria.filter(s => s !== 'fit_score');
        apiParams.sort_by = filteredSort.length > 0 ? filteredSort.join(',') : 'newest';
      }
      
      // Override search with the current input value directly
      apiParams.search = searchInput;
      if (!apiParams.search) delete apiParams.search;
      if (!apiParams.location) delete apiParams.location;
      if (!apiParams.exp_range) delete apiParams.exp_range;
      if (!apiParams.upload_time) delete apiParams.upload_time;
      
      // Clean up frontend-only params
      delete apiParams.upload_year;
      delete apiParams.upload_month;
      
      // Prevent browser caching
      apiParams._t = Date.now();

      setLoading(true);
      sourceApi.searchCandidates({ ...apiParams })
        .then(r => {
          const data = r.data.data || [];
          setCandidates(data);
        })
        .catch(err => {
          // Ignore aborted requests
          if (err?.code === 'ERR_CANCELED' || err?.name === 'AbortError' || err?.message === 'canceled') return;
          console.error("Search failed:", err);
          setCandidates([]);
          toast.error(`Search failed: ${err?.message || 'Unknown error'}`);
        })
        .finally(() => setLoading(false));
    } catch (criticalError) {
      alert("CRITICAL ERROR IN FETCH: " + criticalError.message);
      console.error(criticalError);
    }
  }, [filters, sortCriteria, searchInput]);

  // Role searches are always ranked by fit score; all-role searches never are.
  useEffect(() => {
    setSortCriteria(prev => {
      if (filters.role_id) {
        return prev.includes('fit_score') ? prev : ['fit_score', ...prev];
      }
      const stripped = prev.filter(k => k !== 'fit_score');
      return stripped.length === 0 ? ['newest'] : stripped;
    });
  }, [filters.role_id]);

  const handleSearchClick = () => {
    setHasSearched(true);
    fetchCandidates();
  };

  const resetFilters = () => {
    sessionStorage.removeItem('talentVaultFilters');
    sessionStorage.removeItem('talentVaultSort');
    setFilters({ ...DEFAULT_FILTERS });
    setSearchInput('');
    setSortCriteria(['newest']);
    setSelected(new Set());
    setCandidates([]);
    setHasSearched(false);
  };

  const toggleSort = (key) => {
    if (key === 'fit_score' && filters.role_id) return;
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
      setCandidates(c => c.filter(x => x.id !== id));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to delete");
    }
  };

  const handleBulkDelete = async () => {
    const candidateIds = candidates.filter(c => !c.is_employee && selected.has(candidateKey(c))).map(c => c.id);
    if (candidateIds.length === 0) {
      toast.error('Select at least one candidate resume to delete');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${candidateIds.length} resume(s)?`)) return;
    
    try {
      await sourceApi.bulkDeleteCandidates({ candidate_ids: candidateIds });
      toast.success(`${candidateIds.length} resume(s) deleted`);
      setSelected(new Set());
      setCandidates(c => c.filter(x => !(candidateIds.includes(x.id) && !x.is_employee)));
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to bulk delete");
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
      const res = await sourceApi.sendInvite(payload);
      toast.success(res.data.message || `Invites processed for ${candidateIds.length} candidates!`);
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
          {canManageRoles && <Link to="/source/upload" className="btn btn-shimmer"><Upload size={16} /> Upload Resumes</Link>}
        </div>
      </div>

      <div className="page-body">
        {/* ── Stats ── */}
        <div className="stats-grid animate-fade-in">
          {[
            { label: 'Total CVs', value: stats ? stats.total_cvs : '...', icon: <Layers size={18} /> },
            { label: 'Total Results', value: candidates.length, icon: <Users size={18} /> },
            { label: 'ATS Scored', value: scoredCount, icon: <Star size={18} /> },
            { label: 'Selected', value: selected.size, icon: <ArrowUpDown size={18} /> },
            { label: 'Active Roles', value: jobRoles.length, icon: <Filter size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i + 1}`}>
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
              placeholder="Search by name, email, or skill..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearchClick(); }}
              style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '0.95rem', color: 'var(--text-primary)' }}
            />
            {searchInput && (
              <button className="btn btn-ghost btn-sm" onClick={() => setSearchInput('')} style={{ padding: 4, marginRight: 8 }}><X size={14} /></button>
            )}
                        <button className="btn btn-ghost" onClick={resetFilters} style={{ padding: '8px 16px', fontWeight: 600 }}>Reset</button>
            <button className="btn btn-primary" onClick={handleSearchClick} style={{ padding: '8px 24px', fontWeight: 600 }}>Search</button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 250 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label className="form-label" style={{ marginBottom: 0 }}>Job Role</label>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ minWidth: 100 }}>
                <label className="form-label">Upload Year</label>
                <select className="form-control" value={filters.upload_year || ''} onChange={e => setFilters(f => {
                  const y = e.target.value;
                  let m = f.upload_month || '';
                  if (y && parseInt(y) === new Date().getFullYear() && m && parseInt(m) > new Date().getMonth() + 1) {
                    m = '';
                  }
                  return { ...f, upload_year: y, upload_month: m, upload_time: y ? (m ? `${y}-${m}` : y) : '' };
                })}>
                  <option value="">All Time</option>
                  {Array.from({ length: new Date().getFullYear() - 2022 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div style={{ minWidth: 100 }}>
                <label className="form-label">Upload Month</label>
                <select className="form-control" disabled={!filters.upload_year} value={filters.upload_month || ''} onChange={e => setFilters(f => {
                  const m = e.target.value;
                  const y = f.upload_year || '';
                  return { ...f, upload_month: m, upload_time: y ? (m ? `${y}-${m}` : y) : '' };
                })}>
                  <option value="">All Months</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1)
                    .filter(m => !filters.upload_year || parseInt(filters.upload_year) < new Date().getFullYear() || m <= new Date().getMonth() + 1)
                    .map(m => {
                      const monthStr = m.toString().padStart(2, '0');
                      const monthName = new Date(2000, m - 1).toLocaleString('default', { month: 'long' });
                      return <option key={monthStr} value={monthStr}>{monthName}</option>;
                  })}
                </select>
              </div>
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
                <option value="20">Top 20</option>
                <option value="50">Top 50</option>
                <option value="100">Top 100</option>
                <option value="5">Top 5 {filters.role_id && sortCriteria.includes('fit_score') ? '(Best Fit)' : ''}</option>
                <option value="10">Top 10 {filters.role_id && sortCriteria.includes('fit_score') ? '(Best Fit)' : ''}</option>
                <option value="15">Top 15</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label className="form-label">Sort By</label>
              <div style={{ display: 'flex', gap: 8 }}>

                <button
                  type="button"
                  disabled={!filters.role_id}
                  className={`btn btn-sm ${filters.role_id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => toggleSort('fit_score')}
                  title={filters.role_id ? 'Fit Score is required when a job role is selected' : 'Select a role to rank by fit score'}
                  style={{ borderRadius: 20, padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, cursor: filters.role_id ? 'default' : 'not-allowed' }}
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
        ) : !hasSearched ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Ready to find candidates</p>
            <p style={{ fontSize: '0.9rem' }}>Adjust your filters and click "Search" to view results.</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🔍</div><p>No candidates found. Upload resumes or adjust filters.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
            {/* Select All Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px', marginBottom: -4 }}>
              <input 
                type="checkbox" 
                style={{ accentColor: 'var(--primary)', width: 16, height: 16, cursor: 'pointer' }}
                checked={candidates.length > 0 && selected.size === candidates.length}
                onChange={(e) => {
                  if (e.target.checked) setSelected(new Set(candidates.map(candidateKey)));
                  else setSelected(new Set());
                }}
              />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => {
                if (selected.size === candidates.length) setSelected(new Set());
                else setSelected(new Set(candidates.map(candidateKey)));
              }}>Select All</span>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
            {candidates.map((c, i) => (
              <div key={candidateKey(c)} className={`card animate-fade-in stagger-${Math.min(i + 1, 5)}`} style={{ padding: '16px 20px', border: selected.has(candidateKey(c)) ? '2px solid var(--primary)' : '1px solid var(--border)', cursor: 'pointer', transition: 'var(--transition)', width: '100%', maxWidth: '100%', minWidth: 0 }}>
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
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflowWrap: 'anywhere', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      {c.location} · {c.exp_years > 0 ? `${c.exp_years} yrs exp` : 'Fresher'} · 
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Uploaded: {new Date(c.created_at).toLocaleDateString()}</span> ·
                      {editingEmailId === c.id && !c.is_employee ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input type="email" className="form-control" style={{ padding: '0 4px', height: 22, fontSize: '0.75rem', width: 150 }} value={editEmailVal} onChange={e => setEditEmailVal(e.target.value)} />
                          <button className="btn btn-primary btn-sm" style={{ padding: '0 6px', height: 22, fontSize: '0.7rem' }} onClick={(e) => { e.stopPropagation(); handleEditEmailSave(c.id); }}>Save</button>
                          <button className="btn btn-ghost btn-sm" style={{ padding: '0 6px', height: 22, fontSize: '0.7rem' }} onClick={(e) => { e.stopPropagation(); setEditingEmailId(null); }}>Cancel</button>
                        </div>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {c.email}
                          {!c.is_employee && (
                            <button className="btn btn-ghost btn-sm" style={{ padding: 2, height: 'auto' }} title="Edit Email" onClick={(e) => { e.stopPropagation(); setEditingEmailId(c.id); setEditEmailVal(c.email || ''); }}>
                              <Edit size={12} />
                            </button>
                          )}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                      {(c.skills || []).slice(0, 6).map((s, j) => (
                        <span key={j} className="skill-tag" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>{s.name}</span>
                      ))}
                      {(c.skills || []).length > 6 && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', padding: '2px 4px' }}>+{c.skills.length - 6} more</span>}
                    </div>
                  </div>

                  {/* Scores */}
                  {filters.role_id && (
                    <div style={{ display: 'flex', gap: 16, minWidth: 80, flexShrink: 0, justifyContent: 'flex-end', paddingRight: 16 }}>
                      <CircularScore score={c.ats_score} title="Fit Score" />
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {!c.is_employee && <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteCandidate(c.id)} title="Delete"><Trash2 size={15} color="var(--danger)" /></button>}
                    <Link to={c.is_employee ? `/deploy/employee/${c.id}` : `/source/candidates/${c.id}${filters.role_id ? `?role_id=${filters.role_id}` : ''}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.8rem' }}>View</Link>

                  </div>
                </div>
              </div>
            ))}
          </div>
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
            {canManageRoles && <button className="btn btn-ghost btn-sm" onClick={handleBulkDelete} style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', gap: 6 }}><Trash2 size={15} /> Delete</button>}
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

    </div>
  );
}