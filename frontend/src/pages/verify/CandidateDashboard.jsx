import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { verifyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { CheckSquare, Clock, Calendar, Award, Layers, Code, FileText, ChevronRight, BarChart2, AlertCircle, Play, RotateCcw } from 'lucide-react';

const STATUS_STYLE = {
  pending: 'badge-warning',
  started: 'badge-info',
  submitted: 'badge-primary',
  graded: 'badge-success'
};

function DueUrgency({ deadline }) {
  if (!deadline) return null;
  const now = new Date();
  const due = new Date(deadline);
  const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  const isOverdue = due < now;
  const label = isOverdue ? 'Overdue' : daysLeft <= 1 ? 'Due today' : daysLeft <= 3 ? (daysLeft + ' days left') : null;
  if (!label) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: isOverdue ? '#FEE2E2' : daysLeft <= 1 ? '#FFF7ED' : '#FEF3C7',
      color: isOverdue ? '#B91C1C' : daysLeft <= 1 ? '#C2410C' : '#92400E',
      borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 700,
    }}>
      <AlertCircle size={11} /> {label}
    </span>
  );
}

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

  const avgScore = done.length > 0 ? (done.reduce((s, r) => s + (r.score || 0), 0) / done.length).toFixed(0) : null;
  const passRate = done.length > 0 ? ((done.filter(r => r.pass_status).length / done.length) * 100).toFixed(0) : null;

  return (
    <div>
      <div className="page-header">
        <h1>Welcome back, {user?.full_name ? user.full_name.split(' ')[0] : (user?.email ? user.email.split('@')[0] : 'Candidate')}! 👋</h1>
        <p>Your assessments and results overview</p>
      </div>
      <div className="page-body">
        {/* Stats Strip */}
        <div className="stats-grid animate-fade-in" style={{ marginBottom: 32 }}>
          {[
            { label: 'Pending', value: pending.length, icon: <CheckSquare size={18} /> },
            { label: 'Completed', value: done.length, icon: <Award size={18} /> },
            { label: 'Avg Score', value: avgScore ? (avgScore + '%') : '—', icon: <BarChart2 size={18} /> },
            { label: 'Pass Rate', value: passRate ? (passRate + '%') : '—', icon: <Award size={18} /> },
          ].map((s, i) => (
            <div key={i} className={'stat-card animate-fade-in stagger-' + (i + 1)}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28 }}>
            {/* Pending Assessments */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>My Assessments</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{pending.length} pending</span>
              </div>
              {pending.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 16px', border: '2px dashed var(--border)', borderRadius: 16 }}>
                  <div className="empty-icon">✅</div>
                  <p>No pending assessments — all caught up!</p>
                </div>
              ) : (
                pending.map((a, i) => {
                  const isResume = a.status === 'started';
                  const hasSections = a.sections && Array.isArray(a.sections) && a.sections.length > 0;
                  return (
                    <div
                      key={a.assessment_id}
                      className={'card animate-fade-in stagger-' + Math.min(i + 1, 5)}
                      style={{ marginBottom: 16, border: '1px solid ' + (isResume ? 'var(--primary)' : 'var(--border)'), position: 'relative', overflow: 'hidden' }}
                    >
                      {isResume && (
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, var(--primary), #A855F7)' }} />
                      )}
                      <div className="card-body" style={{ paddingTop: isResume ? 20 : 16 }}>
                        {/* Title + status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
                          <h4 style={{ margin: 0, lineHeight: 1.35, fontSize: '0.97rem' }}>{a.title}</h4>
                          <span className={'badge ' + (STATUS_STYLE[a.status] || 'badge-muted')} style={{ flexShrink: 0 }}>
                            {isResume ? 'In Progress' : a.status}
                          </span>
                        </div>

                        {/* Description */}
                        {a.description && (
                          <p style={{ fontSize: '0.81rem', color: 'var(--text-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
                            {a.description.length > 100 ? a.description.slice(0, 100) + '…' : a.description}
                          </p>
                        )}

                        {/* Meta chips */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 10px', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--primary-lightest)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                            {a.type === 'coding' ? <Code size={11} /> : <FileText size={11} />}
                            {a.type ? a.type.toUpperCase() : 'TEST'}
                          </span>
                          {a.time_limit_minutes && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={12} /> {a.time_limit_minutes} min
                            </span>
                          )}
                          {hasSections && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Layers size={12} /> {a.sections.length} sections
                            </span>
                          )}
                          {a.deadline && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar size={12} /> Due {new Date(a.deadline).toLocaleDateString()}
                            </span>
                          )}
                          <DueUrgency deadline={a.deadline} />
                        </div>

                        {/* Section chips */}
                        {hasSections && (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
                            {a.sections.map((sec, idx) => (
                              <span key={sec.id || idx} style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 7px', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                                {sec.title}
                                {sec.time_limit_minutes && <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{' · '}{sec.time_limit_minutes}m</span>}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* CTA */}
                        <Link
                          to={'/verify/assessment/' + a.assessment_id}
                          className={'btn btn-sm ' + (isResume ? 'btn-primary' : 'btn-shimmer')}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          {isResume ? <><RotateCcw size={13} /> Resume Assessment</> : <><Play size={13} /> Start Assessment</>}
                          <ChevronRight size={13} />
                        </Link>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Results */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>Recent Results</h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{done.length} total</span>
              </div>
              {done.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 16px', border: '2px dashed var(--border)', borderRadius: 16 }}>
                  <div className="empty-icon">📊</div>
                  <p>No results yet. Complete an assessment to see scores here.</p>
                </div>
              ) : (
                done.slice(0, 6).map((r, i) => {
                  const scoreColor = r.is_malpractice ? 'var(--danger)' : r.pass_status ? 'var(--success)' : 'var(--danger)';
                  return (
                    <Link key={r.result_id} to={'/verify/result/' + r.result_id} style={{ textDecoration: 'none' }}>
                      <div
                        className={'card animate-fade-in stagger-' + Math.min(i + 1, 5)}
                        style={{ marginBottom: 10, cursor: 'pointer', border: '1px solid var(--border)' }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                      >
                        <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
                          <div style={{ width: 50, height: 50, borderRadius: '50%', border: '3px solid ' + scoreColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: scoreColor + '12' }}>
                            {r.is_malpractice
                              ? <span style={{ fontSize: '1rem' }}>⚠️</span>
                              : <span style={{ fontWeight: 900, fontSize: '0.9rem', color: scoreColor }}>{r.score?.toFixed(0)}%</span>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                              {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            </div>
                          </div>
                          <span className={'badge ' + (r.is_malpractice ? 'badge-danger' : r.pass_status ? 'badge-success' : 'badge-danger')} style={{ flexShrink: 0 }}>
                            {r.is_malpractice ? 'TERMINATED' : r.pass_status ? 'PASS ✅' : 'FAIL ❌'}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
