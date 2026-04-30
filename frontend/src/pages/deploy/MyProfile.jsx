import React, { useEffect, useState } from 'react';
import { deployApi, forgeApi } from '../../api';
import { Mail, Briefcase, Star, Activity, AlertTriangle, Calendar, Award, BookOpen } from 'lucide-react';

const LEVEL_COLORS = { 
  beginner: { bg: '#F3F4F6', color: '#4B5563', dot: '#9CA3AF' },
  intermediate: { bg: '#EFF6FF', color: '#1D4ED8', dot: '#3B82F6' },
  advanced: { bg: '#F5F3FF', color: '#6D28D9', dot: '#8B5CF6' },
  expert: { bg: '#ECFDF5', color: '#047857', dot: '#10B981' }
};

export default function MyProfile() {
  const [data, setData] = useState(null);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      deployApi.myProfile().catch(() => ({ data: { data: null } })), 
      forgeApi.transcript().catch(() => ({ data: { data: { certificates: [] } } }))
    ])
      .then(([p, t]) => {
        const pd = p.data?.data;
        const td = t.data?.data;
        setData(pd && typeof pd === 'object' ? pd : null);
        setCerts(Array.isArray(td?.certificates) ? td.certificates : []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return (
    <div className="page-body">
      <div className="empty-state">
        <div className="empty-icon">👤</div>
        <p>No employee profile found. Contact HR to link your platform account to an employee record.</p>
      </div>
    </div>
  );

  const initials = (data.user?.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const activeDeployments = Array.isArray(data.deployments) ? data.deployments.filter(d => d.status === 'active') : [];
  const skillsList = Array.isArray(data.skills) ? data.skills : [];

  return (
    <div>
      <div className="page-header">
        <h1>My Profile</h1>
        <p>Manage your professional identity, view skill ratings, and track deployments</p>
      </div>
      <div className="page-body">
        
        {/* Top Banner & Basic Info */}
        <div className="card animate-fade-in" style={{ marginBottom: 24, overflow: 'visible', borderRadius: 'var(--radius-lg)' }}>
          <div style={{
            height: 120, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            background: 'linear-gradient(135deg, var(--primary) 0%, #9333EA 50%, #EC4899 100%)',
            position: 'relative'
          }}>
            <div style={{ position: 'absolute', inset: 0, opacity: 0.1, backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
          </div>
          
          <div className="card-body" style={{ paddingTop: 0, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -50, marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
                <div style={{ 
                  width: 100, height: 100, borderRadius: '50%', background: 'var(--bg-card)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  border: '4px solid var(--bg-card)', boxShadow: 'var(--shadow)' 
                }}>
                  <div style={{ 
                    width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '2rem' 
                  }}>
                    {initials}
                  </div>
                </div>
                <div style={{ paddingBottom: 6 }}>
                  <h2 style={{ margin: '0 0 6px 0', fontSize: '1.5rem' }}>{data.user?.full_name}</h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span className="badge badge-primary">{data.department || 'General'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}><Briefcase size={14}/> ID: {data.emp_id || 'N/A'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.85rem', color: 'var(--text-secondary)' }}><Mail size={14}/> {data.user?.email}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 6 }}>
                <div style={{ textAlign: 'center', background: 'var(--primary-lightest)', padding: '10px 20px', borderRadius: 12 }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{data.capability_index?.toFixed(0) || 0}%</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>Capability</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: (data.status || 'active') === 'active' ? '#10B981' : data.status === 'deployed' ? '#3B82F6' : '#9CA3AF' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize' }}>{(data.status || 'active').replace('_', ' ')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 24 }}>
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Skills */}
            <div className="card animate-fade-in stagger-2">
              <div className="card-header"><h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Star size={16}/> Professional Skills</h4></div>
              <div className="card-body">
                {skillsList.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No skills profiled yet. Complete assessments or courses to build your profile.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                    {skillsList.map((s, i) => {
                      const lConf = LEVEL_COLORS[s.level] || LEVEL_COLORS.beginner;
                      return (
                        <div key={i} style={{ 
                          padding: '12px 16px', borderRadius: 10, border: '1px solid var(--border)',
                          background: s.decayed ? '#FEF2F2' : 'var(--bg-card)',
                          display: 'flex', flexDirection: 'column', gap: 8 
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {s.decayed && <AlertTriangle size={14} color="var(--danger)" />}
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: s.decayed ? 'var(--danger)' : 'var(--text-primary)' }}>{s.name}</span>
                            </div>
                            <span style={{ 
                              background: lConf.bg, color: lConf.color, padding: '2px 8px', 
                              borderRadius: 999, fontSize: '0.7rem', fontWeight: 600, textTransform: 'capitalize' 
                            }}>
                              {s.level}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: lConf.dot }} />
                            Verified via: {s.verified_by?.replace(/_/g, ' ')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Performance (KRA) */}
            <div className="card animate-fade-in stagger-3">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16}/> Performance (KRA)</h4>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)' }}>Past Reviews</button>
              </div>
              <div className="card-body">
                {(data.kra_assessments || []).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No active performance review period.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {data.kra_assessments.map((ka, i) => (
                      <div key={i} style={{ padding: 20, borderRadius: 12, border: '1px solid var(--border)', background: ka.status === 'draft' ? '#FFFBEB' : 'var(--bg-card)' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                           <div>
                             <h5 style={{ margin: 0 }}>{ka.period} {ka.year} Review</h5>
                             <span className="badge badge-sm" style={{ marginTop: 4 }}>{ka.status}</span>
                           </div>
                           <div style={{ textAlign: 'right' }}>
                             <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>{ka.score?.toFixed(1) || '—'} / 10</div>
                             <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>PERIOD SCORE</div>
                           </div>
                         </div>
                         {ka.status === 'draft' ? (
                           <button className="btn btn-primary btn-sm" style={{ width: '100%' }}>Fill Self-Assessment →</button>
                         ) : (
                           <button className="btn btn-ghost btn-sm" style={{ width: '100%', border: '1px solid var(--border)' }}>View Feedback</button>
                         )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Certifications (Visual) */}
            <div className="card animate-fade-in stagger-4">
              <div className="card-header"><h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Award size={16}/> Certificates</h4></div>
              <div className="card-body">
                {certs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>You haven't earned any certificates yet. Browse the Learning Hub!</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                    {certs.map((c, i) => (
                      <div key={i} style={{ 
                        border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
                        background: 'linear-gradient(to bottom right, #ffffff, #f9fafb)'
                      }}>
                        <div style={{ height: 4, background: 'linear-gradient(90deg, #F59E0B, #FCD34D)' }} />
                        <div style={{ padding: 16 }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Certificate of Completion</div>
                          <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.3 }}>{c.course_title}</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border)', paddingTop: 12, marginTop: 12 }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {c.verification_code}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(c.issued_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Personal Dashboard Widgets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Leave & Attendance Summary */}
              <div className="card animate-fade-in stagger-5">
                <div className="card-header"><h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16}/> Leave Balance</h4></div>
                <div className="card-body">
                   <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
                      <div style={{ padding: '12px 8px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                         <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>{data.leave_balance?.sick || 0}</div>
                         <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>SICK</div>
                      </div>
                      <div style={{ padding: '12px 8px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                         <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>{data.leave_balance?.casual || 0}</div>
                         <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>CASUAL</div>
                      </div>
                      <div style={{ padding: '12px 8px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border)', textAlign: 'center' }}>
                         <div style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--primary)' }}>{data.leave_balance?.privilege || 0}</div>
                         <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRIVILEGE</div>
                      </div>
                   </div>
                   <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => window.location.href='/deploy/attendance'}>Apply for Leave</button>
                </div>
              </div>

              {/* Attendance This Month */}
              <div className="card animate-fade-in stagger-6">
                <div className="card-header"><h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16}/> Attendance Summary</h4></div>
                <div className="card-body">
                   <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>Current Month Performance</p>
                   <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.85rem' }}>Full Present</span>
                         <span className="badge badge-success">{data.attendance_summary?.present || 0} Days</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.85rem' }}>Half Days</span>
                         <span className="badge badge-warning">{data.attendance_summary?.half_day || 0} Days</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.85rem' }}>Absences</span>
                         <span className="badge badge-danger">{data.attendance_summary?.absent || 0} Days</span>
                      </div>
                   </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="card animate-fade-in stagger-7" style={{ background: 'var(--primary)', color: 'white' }}>
                 <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <h5 style={{ margin: 0, color: 'white' }}>Employee Hub</h5>
                    <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', justifyContent: 'flex-start' }} onClick={() => window.location.href='/deploy/attendance'}><Activity size={14} style={{ marginRight: 8 }} /> Daily Clock In / Out</button>
                    <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: 'none', justifyContent: 'flex-start' }} onClick={() => window.location.href='/deploy'}><Activity size={14} style={{ marginRight: 8 }} /> Team Directory</button>
                 </div>
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
