import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { verifyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { CheckSquare, Clock, Calendar, Award } from 'lucide-react';

const STATUS_STYLE = { pending: 'badge-warning', started: 'badge-info', submitted: 'badge-primary', graded: 'badge-success' };

export default function CandidateDashboard() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([verifyApi.myAssessments(), verifyApi.myResults()])
      .then(([a, r]) => { 
        setAssessments(Array.isArray(a.data.data) ? a.data.data : []); 
        setResults(Array.isArray(r.data.data) ? r.data.data : []); 
      })
      .catch(e => console.error('Failed to load dashboard data:', e))
      .finally(() => setLoading(false));
  }, []);

  const done = results.filter(r => r.score != null || r.is_malpractice);
  const pending = assessments.filter(a => ['pending', 'started'].includes(a.status) && !a.terminated_by_proctor);

  return (
    <div>
      <div className="page-header">
        <h1>Welcome, {user?.full_name ? user.full_name.split(' ')[0] : (user?.email ? user.email.split('@')[0] : 'Candidate')}! 👋</h1>
        <p>Your assessments and learning overview</p>
      </div>
      <div className="page-body">
        <div className="stats-grid animate-fade-in">
          {[
            { label: 'Pending Assessments', value: pending.length, icon: <CheckSquare size={18} /> },
            { label: 'Completed', value: done.length, icon: <Award size={18} /> },
            { label: 'Avg Score', value: done.length > 0 ? `${(done.reduce((s, r) => s + r.score, 0) / done.length).toFixed(0)}%` : '—', icon: <Award size={18} /> },
            { label: 'Pass Rate', value: done.length > 0 ? `${((done.filter(r => r.pass_status).length / done.length) * 100).toFixed(0)}%` : '—', icon: <Award size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h3 style={{ marginBottom: 16 }}>📋 My Assessments</h3>
              {pending.length === 0 ? <div className="empty-state" style={{ padding: '32px 16px' }}><div className="empty-icon">✅</div><p>No pending assessments!</p></div> : (
                pending.map((a, i) => (
                  <div key={a.assessment_id} className={`card animate-fade-in stagger-${i+1}`} style={{ marginBottom: 16 }}>
                    <div className="card-body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <h4>{a.title}</h4>
                        <span className={`badge ${STATUS_STYLE[a.status] || 'badge-muted'}`}>{a.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                        {a.time_limit_minutes && <span><Clock size={12} style={{ verticalAlign: 'middle' }} /> {a.time_limit_minutes} min</span>}
                        {a.deadline && <span><Calendar size={12} style={{ verticalAlign: 'middle' }} /> Due: {new Date(a.deadline).toLocaleDateString()}</span>}
                      </div>
                      <Link to={`/verify/assessment/${a.assessment_id}`} className="btn btn-shimmer btn-sm">Start Assessment →</Link>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <h3 style={{ marginBottom: 16 }}>🏆 Recent Results</h3>
              {done.length === 0 ? <div className="empty-state" style={{ padding: '32px 16px' }}><div className="empty-icon">📊</div><p>No results yet.</p></div> : (
                done.slice(0, 5).map((r, i) => (
                  <Link key={r.result_id} to={`/verify/result/${r.result_id}`} style={{ textDecoration: 'none' }}>
                    <div className={`card animate-fade-in stagger-${i+1}`} style={{ marginBottom: 12, cursor: 'pointer' }}>
                      <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ fontSize: r.is_malpractice ? '0.75rem' : '1.75rem', fontWeight: 900, color: r.is_malpractice ? 'var(--danger)' : (r.pass_status ? 'var(--success)' : 'var(--danger)'), minWidth: 60, textAlign: 'center', lineHeight: 1.2 }}>
                          {r.is_malpractice ? 'MALPRACTICE\nDETECTED ⚠️' : `${r.score?.toFixed(0)}%`}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>{r.title}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : ''}</div>
                        </div>
                        <span className={`badge ${r.is_malpractice ? 'badge-danger' : (r.pass_status ? 'badge-success' : 'badge-danger')}`}>
                          {r.is_malpractice ? 'TERMINATED' : (r.pass_status ? 'PASS ✅' : 'FAIL ❌')}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
