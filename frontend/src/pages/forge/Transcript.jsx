import React, { useEffect, useState } from 'react';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Award, BookOpen, CheckCircle, Clock, Download, ExternalLink,
  GraduationCap, TrendingUp, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

function CertCard({ cert }) {
  return (
    <div className="card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Certificate visual header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary), #9333EA, #EC4899)',
        padding: '24px 20px', textAlign: 'center', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.08,
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '20px 20px',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏆</div>
          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Certificate of Completion
          </div>
          <div style={{ color: 'white', fontSize: '0.9rem', fontWeight: 700, marginTop: 4, lineHeight: 1.3 }}>
            {cert.course_title}
          </div>
        </div>
      </div>
      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issued On</div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              {new Date(cert.issued_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>
          <div style={{
            background: 'var(--primary-lightest)', borderRadius: 8, padding: '8px 12px', textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Code</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.85rem', color: 'var(--primary)', letterSpacing: '0.08em' }}>
              {cert.verification_code}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {cert.pdf_url && (
            <a
              href={cert.pdf_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={e => e.stopPropagation()}
            >
              <Download size={13} /> Download PDF
            </a>
          )}
          <a
            href={`/forge/verify-cert/${cert.verification_code}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-sm"
            style={{ flex: 1, justifyContent: 'center' }}
          >
            <ExternalLink size={13} /> Verify
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Transcript() {
  const { user } = useAuth();
  const [data, setData] = useState({ enrollments: [], certificates: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    forgeApi.transcript()
      .then(r => setData(r.data.data || {}))
      .catch(() => toast.error('Failed to load transcript'))
      .finally(() => setLoading(false));
  }, []);

  const completed = (data.enrollments || []).filter(e => e.completed_at);
  const inProgress = (data.enrollments || []).filter(e => !e.completed_at);
  const avgProgress = inProgress.length > 0
    ? Math.round(inProgress.reduce((s, e) => s + e.progress_percent, 0) / inProgress.length)
    : 0;

  const stats = [
    { label: 'Courses Enrolled', value: data.enrollments?.length || 0, icon: <BookOpen size={18} /> },
    { label: 'Completed', value: completed.length, icon: <CheckCircle size={18} /> },
    { label: 'Certificates Earned', value: data.certificates?.length || 0, icon: <Award size={18} /> },
    { label: 'Avg Progress', value: `${avgProgress}%`, icon: <TrendingUp size={18} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <GraduationCap size={28} color="var(--primary)" />
          <h1 style={{ margin: 0 }}>My Learning Transcript</h1>
        </div>
        <p>Your complete learning history, achievements, and verified certificates</p>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            {/* Stats */}
            <div className="stats-grid animate-fade-in" style={{ marginBottom: 36 }}>
              {stats.map((s, i) => (
                <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
                  <div className="stat-icon">{s.icon}</div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
              {/* Left: Enrollment History */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  }}><FileText size={18} /></div>
                  <h3 style={{ margin: 0 }}>Enrollment History</h3>
                </div>

                <div className="card animate-fade-in">
                  {(data.enrollments || []).length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📚</div>
                      <p>No courses enrolled yet</p>
                    </div>
                  ) : (
                    <div style={{ padding: '4px 0' }}>
                      {(data.enrollments || []).map((e, i) => (
                        <div key={i} style={{
                          padding: '16px 20px',
                          borderBottom: i < data.enrollments.length - 1 ? '1px solid var(--border)' : 'none',
                          transition: 'background var(--transition)',
                        }}
                          onMouseEnter={el => el.currentTarget.style.background = 'var(--primary-lightest)'}
                          onMouseLeave={el => el.currentTarget.style.background = 'transparent'}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{e.course_title}</span>
                                {e.completed_at
                                  ? <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>✓ Done</span>
                                  : <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>In Progress</span>
                                }
                              </div>
                              <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span><Clock size={10} style={{ verticalAlign: 'middle' }} /> Enrolled {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '—'}</span>
                                {e.completed_at && <span>Completed {new Date(e.completed_at).toLocaleDateString()}</span>}
                              </div>
                              {!e.completed_at && (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                                    <span>Progress</span>
                                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{e.progress_percent?.toFixed(0)}%</span>
                                  </div>
                                  <div className="progress-bar" style={{ height: 5 }}>
                                    <div className="progress-fill" style={{ width: `${e.progress_percent}%` }} />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Certificates */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                  }}><Award size={18} /></div>
                  <h3 style={{ margin: 0 }}>Earned Certificates</h3>
                </div>

                {(data.certificates || []).length === 0 ? (
                  <div className="card animate-fade-in" style={{ padding: 40, textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏆</div>
                    <p style={{ color: 'var(--text-muted)' }}>Complete a course to earn your first certificate!</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(data.certificates || []).map((cert, i) => (
                      <div key={i} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                        <CertCard cert={cert} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
