import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { sourceApi } from '../../api';
import { ArrowLeft, MapPin, Clock, Star, AlertTriangle, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

const LEVEL_COLOR = { beginner: 'badge-muted', intermediate: 'badge-info', advanced: 'badge-primary', expert: 'badge-success' };

export default function CandidateProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ job_role_id: '', deadline: '' });
  const [jobRoles, setJobRoles] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [convertForm, setConvertForm] = useState({ salary: '', role_title: '', department: '', location: 'Office', start_date: '' });
  const [converting, setConverting] = useState(false);
  const [reverting, setReverting] = useState(false);

  const openInviteModal = () => {
    sourceApi.listJobRoles().then(r => setJobRoles(r.data.data)).catch(console.error);
    setInviteForm(f => ({ ...f, email: data.user?.email || '' }));
    setShowInvite(true);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.job_role_id) return toast.error('Please select a job role');
    if (!inviteForm.email) return toast.error('Please provide an email address');
    setInviting(true);
    try {
      await sourceApi.sendInvite({ 
        candidate_ids: [parseInt(id)], 
        job_role_id: parseInt(inviteForm.job_role_id), 
        deadline: inviteForm.deadline || undefined,
        email_addresses: [inviteForm.email]
      });
      toast.success('Assessment Invite sent! ✉️', { duration: 4000 });
      setShowInvite(false);
      setData(prev => ({ ...prev, status: 'invited' }));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send invite');
    } finally {
      setInviting(false);
    }
  };
 
  const handleConvert = async (e) => {
    e.preventDefault();
    if (!convertForm.salary || !convertForm.role_title || !convertForm.department) return toast.error('Please fill required fields');
    setConverting(true);
    try {
      await sourceApi.convertToEmployee(id, convertForm);
      toast.success('Hired! Employee created and Offer Letter sent! 🎊');
      setShowConvert(false);
      // Refresh data
      const r = await sourceApi.getCandidate(id);
      setData(r.data.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Conversion failed');
    } finally {
      setConverting(false);
    }
  };

  const handleRevert = async () => {
    if (!data.employee_id) return;
    if (!window.confirm('Are you sure you want to revert this employee back to a candidate? This will delete the employee record.')) return;
    
    setReverting(true);
    try {
      await sourceApi.revertToCandidate(data.employee_id);
      toast.success('Employee reverted back to Candidate! ♻️');
      // Refresh data
      const r = await sourceApi.getCandidate(id);
      setData(r.data.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Revert failed');
    } finally {
      setReverting(false);
    }
  };

  useEffect(() => {
    sourceApi.getCandidate(id)
      .then(r => {
        setData(r.data.data);
        setConvertForm(f => ({ ...f, role_title: r.data.data.user?.job_role_title || '' }));
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return <div className="page-body"><p>Candidate not found.</p></div>;

  const fitScore = data.ai_scores?.find(s => s.type === 'role_fit');
  const confidence = data.ai_scores?.find(s => s.type === 'confidence_signals');
  const confFlags = confidence ? JSON.parse(confidence.reasoning || '[]').filter(f => f.flag) : [];

  let fitData = null;
  try { fitData = fitScore ? JSON.parse(fitScore.reasoning) : null; } catch {}

  return (
    <div>
      <div className="page-header">
        <Link to="/source" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}><ArrowLeft size={16} /> Back to Candidates</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.5rem' }}>
            {data.user?.full_name?.[0] || '?'}
          </div>
          <div>
            <h1 style={{ marginBottom: 4 }}>{data.user?.full_name || 'Unknown'} <span style={{ fontWeight: 400, fontSize: '1rem', opacity: 0.7 }}>({data.type})</span></h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              {data.location && <span><MapPin size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {data.location}</span>}
              {data.exp_years > 0 && <span><Clock size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> {data.exp_years} years exp</span>}
              <span className={`badge badge-${data.status === 'active' ? 'success' : 'muted'}`}>{data.status}</span>
            </div>
          </div>
          {fitScore && (
            <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: fitScore.score >= 70 ? 'var(--success)' : fitScore.score >= 40 ? 'var(--warning)' : 'var(--danger)' }}>{Math.round(fitScore.score)}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Role Fit Score</div>
            </div>
          )}
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div>
            {/* Skills */}
            <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
              <div className="card-header"><h4>Skills Profile</h4></div>
              <div className="card-body">
                <div className="chip-list">
                  {data.skills?.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--primary-lightest)', border: '1px solid var(--primary-lighter)', borderRadius: 'var(--radius-full)', padding: '6px 14px' }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{s.name}</span>
                      <span className={`badge ${LEVEL_COLOR[s.level] || 'badge-muted'}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{s.level}</span>
                      {s.years_of_use && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.years_of_use}y</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Fit Analysis */}
            {fitData && (
              <div className="card animate-fade-in stagger-2" style={{ marginBottom: 24 }}>
                <div className="card-header"><h4>🤖 AI Role Fit Analysis</h4></div>
                <div className="card-body">
                  <p style={{ marginBottom: 16 }}>{fitData.summary}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--success)', fontSize: '0.85rem' }}>✅ Matched Skills</div>
                      <div className="chip-list">{(fitData.matched_skills || []).map(s => <span key={s} className="skill-tag match">{s}</span>)}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--danger)', fontSize: '0.85rem' }}>❌ Missing Skills</div>
                      <div className="chip-list">{(fitData.missing_skills || []).map(s => <span key={s} className="skill-tag miss">{s}</span>)}</div>
                    </div>
                  </div>
                  {fitData.interview_questions?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--primary)', fontSize: '0.85rem' }}>💬 Suggested Interview Questions</div>
                      {fitData.interview_questions.map((q, i) => (
                        <div key={i} style={{ background: 'var(--primary-lightest)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 8, fontSize: '0.875rem', borderLeft: '3px solid var(--primary)' }}>
                          {q}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            {/* Flags */}
            {confFlags.length > 0 && (
              <div className="card animate-fade-in" style={{ marginBottom: 24, border: '1px solid var(--warning)', background: '#FFFBEB' }}>
                <div className="card-header" style={{ borderColor: 'rgba(245,158,11,0.2)' }}>
                  <h4 style={{ color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} /> Confidence Flags</h4>
                </div>
                <div className="card-body">
                  {confFlags.map((f, i) => (
                    <div key={i} style={{ fontSize: '0.85rem', color: '#78350F', marginBottom: 8 }}>
                      <strong>{f.skill}</strong>: {f.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="card animate-fade-in stagger-2">
              <div className="card-body">
                <h4 style={{ marginBottom: 16 }}>Actions</h4>
                {data.resume_url && (
                  <a href={data.resume_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-block" style={{ marginBottom: 8 }}>
                    <ExternalLink size={14} /> View Resume
                  </a>
                )}
                {data.status !== 'archived' ? (
                  <>
                    <button onClick={openInviteModal} className="btn btn-primary btn-block" style={{ marginTop: 8 }}>
                      Send Assessment Invite
                    </button>
                    <button onClick={() => setShowConvert(true)} className="btn btn-shimmer btn-block" style={{ marginTop: 12, background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none' }}>
                      Convert to Employee
                    </button>
                  </>
                ) : (
                  data.employee_id && (
                    <button onClick={handleRevert} className="btn btn-ghost btn-block" style={{ marginTop: 12, color: 'var(--danger)', borderColor: 'var(--danger)' }} disabled={reverting}>
                      {reverting ? 'Reverting...' : 'Reset to Candidate'}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="modal-overlay" onClick={() => setShowInvite(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Send Assessment Invite</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInvite(false)}>✕</button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="modal-body">
                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Send an assessment invitation to {data.user?.full_name || 'this candidate'}.
                </p>
                <div className="form-group">
                  <label className="form-label">Candidate Email *</label>
                  <input type="email" required className="form-control" value={inviteForm.email || ''} onChange={e => setInviteForm(f => ({...f, email: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Job Role *</label>
                  <select required className="form-control" value={inviteForm.job_role_id} onChange={e => setInviteForm(f => ({...f, job_role_id: e.target.value}))}>
                    <option value="">Select a job role...</option>
                    {jobRoles.map(r => (
                      <option key={r.id} value={r.id}>{r.title}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Deadline (Optional)</label>
                  <input type="date" className="form-control" value={inviteForm.deadline} onChange={e => setInviteForm(f => ({...f, deadline: e.target.value}))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={inviting}>
                  {inviting ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Modal */}
      {showConvert && (
        <div className="modal-overlay" onClick={() => setShowConvert(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Hire Candidate</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConvert(false)}>✕</button>
            </div>
            <form onSubmit={handleConvert}>
              <div className="modal-body">
                <p style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  This will convert <strong>{data.user?.full_name}</strong> to an Employee and automatically send the Job Offer Letter.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Role Title *</label>
                    <input required className="form-control" value={convertForm.role_title} onChange={e => setConvertForm(f => ({...f, role_title: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <input required className="form-control" placeholder="e.g. Engineering" value={convertForm.department} onChange={e => setConvertForm(f => ({...f, department: e.target.value}))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Salary / CTC *</label>
                    <input required className="form-control" placeholder="e.g. $80k or ₹12LPA" value={convertForm.salary} onChange={e => setConvertForm(f => ({...f, salary: e.target.value}))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input className="form-control" value={convertForm.location} onChange={e => setConvertForm(f => ({...f, location: e.target.value}))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input type="date" className="form-control" value={convertForm.start_date} onChange={e => setConvertForm(f => ({...f, start_date: e.target.value}))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowConvert(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={converting} style={{ background: '#10B981', borderColor: '#10B981' }}>
                  {converting ? 'Processing...' : 'Confirm & Send Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
    </div>
  );
}
