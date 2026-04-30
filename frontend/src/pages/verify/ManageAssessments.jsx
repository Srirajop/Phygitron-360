import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { verifyApi, adminApi } from '../../api';
import { BarChart2, PlusCircle, Send, Eye, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const STATUS_BADGE = { draft: 'badge-muted', active: 'badge-success', archived: 'badge-info' };

export default function ManageAssessments() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Assignment Modal State
  const [candidates, setCandidates] = useState([]);
  const [assignModal, setAssignModal] = useState({ open: false, assessmentId: null, deadline: '', loading: false });
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    verifyApi.listAssessments().then(r => setAssessments(r.data.data || [])).finally(() => setLoading(false));
  }, []);

  const openAssignModal = (id) => {
    setAssignModal({ open: true, assessmentId: id, deadline: '', loading: false });
    setSelectedCandidates([]);
    setSearch('');
    if (candidates.length === 0) {
      adminApi.listUsers().then(r => {
        const actualCandidates = (r.data.data || []).filter(c => 
          !c.email.includes('.local') && ['candidate', 'employee'].includes(c.role)
        );
        setCandidates(actualCandidates);
      }).catch(console.error);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (selectedCandidates.length === 0) { toast.error('Select at least one candidate'); return; }
    setAssignModal(m => ({ ...m, loading: true }));
    try {
      await verifyApi.assignAssessment(assignModal.assessmentId, {
        user_ids: selectedCandidates,
        deadline: assignModal.deadline ? new Date(assignModal.deadline).toISOString() : null,
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

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><h1>Manage Assessments</h1><p>Create, publish, and monitor assessments</p></div>
        <Link to="/verify/build" className="btn btn-shimmer"><PlusCircle size={16} /> Create Assessment</Link>
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
                          {a.status === 'draft' && <button className="btn btn-secondary btn-sm" onClick={() => publish(a.id)}>Publish</button>}
                          {a.status === 'active' && <button className="btn btn-shimmer btn-sm" onClick={() => openAssignModal(a.id)}><Send size={14} /> Assign</button>}
                          {['super_admin', 'org_admin', 'hr'].includes(user?.role) && (
                            <Link to={`/verify/analytics/${a.id}`} className="btn btn-ghost btn-sm"><BarChart2 size={14} /></Link>
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
                  {candidates.filter(c => (c.full_name || '').toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase())).map(c => (
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
                  {candidates.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</div>}
                </div>
                
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
