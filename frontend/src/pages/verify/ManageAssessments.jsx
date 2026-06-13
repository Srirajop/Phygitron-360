import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { verifyApi, adminApi } from '../../api';
import { BarChart2, PlusCircle, Send, Eye, Calendar, Trash2, Play, Pause } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_BADGE = { 
  draft: 'badge-muted', 
  active: 'badge-success', 
  inactive: 'badge-warning',
  archived: 'badge-info',
  closed: 'badge-danger'
};

export default function ManageAssessments() {
  const { user } = useAuth();
  const canCreateOrAssign = ['hr', 'org_admin', 'instructor'].includes(user?.role);
  const canViewAnalytics = ['super_admin', 'org_admin', 'hr', 'manager'].includes(user?.role);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assignment Modal State
  const [candidates, setCandidates] = useState([]);
  const [assignModal, setAssignModal] = useState({ open: false, assessmentId: null, deadline: '', loading: false });
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [search, setSearch] = useState('');
  
  // New partial assignment state
  const [assessmentQuestions, setAssessmentQuestions] = useState([]);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [showSubset, setShowSubset] = useState(false);

  // Memoized filters to prevent lag on search keystrokes
  const filteredCandidates = React.useMemo(() => {
    if (!search) return candidates;
    const s = search.toLowerCase();
    return candidates.filter(c => 
      (c.full_name || '').toLowerCase().includes(s) || 
      (c.email || '').toLowerCase().includes(s)
    );
  }, [candidates, search]);

  const groupedQuestions = React.useMemo(() => {
    if (!showSubset || assessmentQuestions.length === 0) return null;
    const allTags = [...new Set(assessmentQuestions.flatMap(q => q.tags || []))].sort();
    const qWithIndices = assessmentQuestions.map((q, i) => ({ ...q, originalIndex: i }));
    
    const taggedGroups = allTags.map(tag => ({
      tag,
      qs: qWithIndices.filter(q => (q.tags || []).includes(tag))
    }));
    const untaggedQs = qWithIndices.filter(q => !q.tags || q.tags.length === 0);
    
    return { taggedGroups, untaggedQs };
  }, [assessmentQuestions, showSubset]);

  useEffect(() => {
    verifyApi.listAssessments().then(r => setAssessments(r.data.data || [])).finally(() => setLoading(false));
  }, []);

  const openAssignModal = async (id) => {
    setAssignModal({ open: true, assessmentId: id, deadline: '', loading: false });
    setSelectedCandidates([]);
    setSearch('');
    setShowSubset(false);
    setSelectedQuestionIds([]);
    
    // Load users
    if (candidates.length === 0) {
      try {
        const r = await adminApi.listUsers();
        const actualCandidates = (r.data.data || []).filter(c => 
          !c.email.includes('.local') && ['candidate', 'employee'].includes(c.role)
        );
        setCandidates(actualCandidates);
      } catch (err) { console.error(err); }
    }
    
    // Load questions for partial assignment
    try {
      const r = await verifyApi.getAssessment(id);
      setAssessmentQuestions(r.data.data.questions || []);
      setSelectedQuestionIds((r.data.data.questions || []).map(q => q.id)); // default all
    } catch (err) { console.error(err); }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (selectedCandidates.length === 0) { toast.error('Select at least one candidate'); return; }
    setAssignModal(m => ({ ...m, loading: true }));
    try {
      await verifyApi.assignAssessment(assignModal.assessmentId, {
        user_ids: selectedCandidates,
        deadline: assignModal.deadline ? new Date(assignModal.deadline).toISOString() : null,
        question_ids: showSubset ? selectedQuestionIds : null,
      });
      toast.success('Assessment assigned successfully!');
      setAssignModal({ open: false, assessmentId: null, deadline: '', loading: false });
    } catch {
      toast.error('Failed to assign assessment');
      setAssignModal(m => ({ ...m, loading: false }));
    }
  };

  const publish = async (id) => {
    try {
      await verifyApi.publishAssessment(id);
      setAssessments(a => a.map(x => x.id === id ? { ...x, status: 'active' } : x));
      toast.success('Published!');
    } catch { toast.error('Failed'); }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      await verifyApi.updateAssessmentStatus(id, newStatus);
      setAssessments(a => a.map(x => x.id === id ? { ...x, status: newStatus } : x));
      toast.success(`Assessment ${newStatus === 'active' ? 'Activated' : 'Deactivated'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const deleteAssessment = async (id) => {
    if (!window.confirm('Are you sure you want to delete this assessment? This action cannot be undone.')) return;
    try {
      await verifyApi.deleteAssessment(id);
      setAssessments(a => a.filter(x => x.id !== id));
      toast.success('Assessment Deleted');
    } catch {
      toast.error('Failed to delete assessment');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><h1>Manage Assessments</h1><p>Create, publish, and monitor assessments</p></div>
        {canCreateOrAssign && <Link to="/verify/build" className="btn btn-shimmer"><PlusCircle size={16} /> Create Assessment</Link>}
      </div>
      <div className="page-body">
        <div className="card animate-fade-in">
          <div className="table-container">
            <table>
              <thead><tr><th>Title</th><th>Type</th><th>Time</th><th>Pass</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                  : assessments.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No assessments yet. <Link to="/verify/build">Create one →</Link></td></tr>
                  : assessments.map((a, i) => (
                    <tr key={a.id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                      <td style={{ fontWeight: 600 }}>{a.title}</td>
                      <td><span className="badge badge-muted">{a.type}</span></td>
                      <td>{a.time_limit_minutes ? `${a.time_limit_minutes} min` : '—'}</td>
                      <td>{a.pass_score}%</td>
                      <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-muted'}`}>{a.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {canCreateOrAssign && a.status === 'draft' && (
                            <button className="btn btn-secondary btn-sm" onClick={() => publish(a.id)}>Publish</button>
                          )}
                          {canCreateOrAssign && a.status === 'active' && (
                            <>
                              <button className="btn btn-shimmer btn-sm" onClick={() => openAssignModal(a.id)} title="Assign">
                                <Send size={14} /> Assign
                              </button>
                              <button className="btn btn-ghost btn-sm text-warning" onClick={() => toggleStatus(a.id, a.status)} title="Deactivate">
                                <Pause size={14} />
                              </button>
                            </>
                          )}
                          {canCreateOrAssign && a.status === 'inactive' && (
                            <button className="btn btn-ghost btn-sm text-success" onClick={() => toggleStatus(a.id, a.status)} title="Activate">
                              <Play size={14} />
                            </button>
                          )}
                          {canCreateOrAssign && (
                            <button className="btn btn-ghost btn-sm text-danger" onClick={() => deleteAssessment(a.id)} title="Delete">
                              <Trash2 size={14} />
                            </button>
                          )}
                          {canViewAnalytics && (
                            <Link to={`/verify/analytics/${a.id}`} className="btn btn-ghost btn-sm" title="Analytics"><BarChart2 size={14} /></Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {assignModal.open && (
        <div className="modal-overlay">
          <div className="modal card animate-scale-in">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3>Assign Assessment</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setAssignModal({ ...assignModal, open: false })}>✕</button>
            </div>
            <div className="card-body">
              <form onSubmit={handleAssign}>
                <div className="form-group">
                  <label className="form-label">Search Users</label>
                  <input type="text" className="form-control" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.map(c => c.id))}>Select All</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.filter(c => c.role === 'employee').map(c => c.id))}>All Employees</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.filter(c => c.role === 'candidate').map(c => c.id))}>All Trainees</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedCandidates([])}>Clear</button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
                  {filteredCandidates.slice(0, 100).map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid var(--border)', cursor: 'pointer', margin: 0 }}>
                      <input type="checkbox" checked={selectedCandidates.includes(c.id)} onChange={e => {
                        setSelectedCandidates(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                      }} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 600 }}>{c.full_name || 'User'}</div>
                        <span className={`badge ${c.role === 'employee' ? 'badge-info' : 'badge-muted'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                          {c.role === 'employee' ? 'Employee' : 'Trainee'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.email}</div>
                    </label>
                  ))}
                  {filteredCandidates.length > 100 && (
                    <div style={{ padding: 12, textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Showing top 100 results. Narrow your search...
                    </div>
                  )}
                  {filteredCandidates.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</div>}
                </div>
                
                {assessmentQuestions.length > 0 && (
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <input type="checkbox" checked={showSubset} onChange={e => setShowSubset(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                      Assign a subset of questions
                    </label>
                    {showSubset && (
                      <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-hover)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Select Questions ({selectedQuestionIds.length}/{assessmentQuestions.length})</span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelectedQuestionIds(assessmentQuestions.map(q=>q.id))}>All</button>
                            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setSelectedQuestionIds([])}>None</button>
                          </div>
                        </div>
                        
                        {/* Grouped Questions by Tag */}
                        {groupedQuestions && (
                          <div style={{ maxHeight: 250, overflowY: 'auto', paddingRight: 4 }}>
                            {groupedQuestions.taggedGroups.map(({ tag, qs }) => {
                              const allSelected = qs.every(q => selectedQuestionIds.includes(q.id));
                              return (
                                <div key={tag} style={{ marginBottom: 16 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-lightest)', padding: '6px 10px', borderRadius: 4, marginBottom: 4 }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>🏷️ {tag} ({qs.length})</div>
                                    <button type="button" className="btn btn-ghost btn-xs" onClick={() => {
                                      if (allSelected) setSelectedQuestionIds(prev => prev.filter(id => !qs.map(q=>q.id).includes(id)));
                                      else setSelectedQuestionIds(prev => [...new Set([...prev, ...qs.map(q=>q.id)])]);
                                    }}>
                                      {allSelected ? 'Deselect All' : 'Select All'}
                                    </button>
                                  </div>
                                  <div style={{ paddingLeft: 8 }}>
                                    {qs.map(q => (
                                      <label key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', cursor: 'pointer', margin: 0, borderBottom: '1px solid var(--border-light)' }}>
                                        <input type="checkbox" checked={selectedQuestionIds.includes(q.id)} onChange={e => setSelectedQuestionIds(prev => e.target.checked ? [...prev, q.id] : prev.filter(x => x !== q.id))} style={{ marginTop: 3, accentColor: 'var(--primary)' }} />
                                        <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                                          <strong>Q{q.originalIndex + 1}:</strong> {q.question_text.length > 80 ? q.question_text.slice(0,80) + '...' : q.question_text}
                                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                            {q.question_type} • {q.marks} marks {(q.tags||[]).map(t=><span key={t} className="badge badge-primary" style={{marginLeft:4}}>{t}</span>)}
                                          </div>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            
                            {groupedQuestions.untaggedQs.length > 0 && (
                              <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-hover)', padding: '6px 10px', borderRadius: 4, marginBottom: 4 }}>
                                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Untagged ({groupedQuestions.untaggedQs.length})</div>
                                  <button type="button" className="btn btn-ghost btn-xs" onClick={() => {
                                    const allSelected = groupedQuestions.untaggedQs.every(q => selectedQuestionIds.includes(q.id));
                                    if (allSelected) setSelectedQuestionIds(prev => prev.filter(id => !groupedQuestions.untaggedQs.map(q=>q.id).includes(id)));
                                    else setSelectedQuestionIds(prev => [...new Set([...prev, ...groupedQuestions.untaggedQs.map(q=>q.id)])]);
                                  }}>
                                    {groupedQuestions.untaggedQs.every(q => selectedQuestionIds.includes(q.id)) ? 'Deselect All' : 'Select All'}
                                  </button>
                                </div>
                                <div style={{ paddingLeft: 8 }}>
                                  {groupedQuestions.untaggedQs.map(q => (
                                    <label key={q.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 0', cursor: 'pointer', margin: 0, borderBottom: '1px solid var(--border-light)' }}>
                                      <input type="checkbox" checked={selectedQuestionIds.includes(q.id)} onChange={e => setSelectedQuestionIds(prev => e.target.checked ? [...prev, q.id] : prev.filter(x => x !== q.id))} style={{ marginTop: 3, accentColor: 'var(--primary)' }} />
                                      <div style={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                                        <strong>Q{q.originalIndex + 1}:</strong> {q.question_text.length > 80 ? q.question_text.slice(0,80) + '...' : q.question_text}
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                          {q.question_type} • {q.marks} marks {(q.tags||[]).map(t=><span key={t} className="badge badge-primary" style={{marginLeft:4}}>{t}</span>)}
                                        </div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {groupedQuestions.taggedGroups.length === 0 && groupedQuestions.untaggedQs.length === 0 && (
                              <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No questions available.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="form-group">
                  <label className="form-label">Deadline (Optional)</label>
                  <div className="form-date-group">
                    <Calendar size={18} className="calendar-icon" />
                    <input 
                      type="date" 
                      className="form-control" 
                      value={assignModal.deadline} 
                      onChange={e => setAssignModal({ ...assignModal, deadline: e.target.value })} 
                      style={{ paddingRight: '40px' }}
                    />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Click the icon or field to open calendar.</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setAssignModal({ ...assignModal, open: false })}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={assignModal.loading || selectedCandidates.length === 0}>
                    {assignModal.loading ? 'Assigning...' : `Assign to ${selectedCandidates.length} User(s)`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
