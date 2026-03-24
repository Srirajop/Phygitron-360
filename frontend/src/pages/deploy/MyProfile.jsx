import React, { useEffect, useState } from 'react';
import { deployApi, forgeApi } from '../../api';
import { User, Mail, Briefcase, Award, Star, Activity, AlertTriangle } from 'lucide-react';

const LEVEL_COLORS = { beginner: 'badge-muted', intermediate: 'badge-info', advanced: 'badge-primary', expert: 'badge-success' };

export default function MyProfile() {
  const [data, setData] = useState(null);
  const [certs, setCerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([deployApi.myProfile(), forgeApi.transcript()])
      .then(([p, t]) => {
        setData(p.data.data);
        setCerts(t.data.data.certificates || []);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return <div className="page-body"><p>Profile not found.</p></div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Profile 👤</h1>
        <p>Manage your professional identity, skills, and achievements</p>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
          {/* Left: Info card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card animate-fade-in">
              <div className="card-body" style={{ textAlign: 'center', padding: '32px 24px' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '2rem', margin: '0 auto 16px', boxShadow: '0 8px 16px rgba(124,58,237,0.3)' }}>
                  {data.user?.full_name?.[0] || '?'}
                </div>
                <h3 style={{ marginBottom: 4 }}>{data.user?.full_name}</h3>
                <div className="badge badge-primary" style={{ marginBottom: 20 }}>{data.department || 'General'}</div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}><Mail size={14} color="var(--text-muted)" /> {data.user?.email}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}><Briefcase size={14} color="var(--text-muted)" /> ID: {data.emp_id}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.85rem' }}><Activity size={14} color="var(--text-muted)" /> Status: <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{data.status}</span></div>
                </div>
              </div>
            </div>

            <div className="card animate-fade-in stagger-2">
              <div className="card-header"><h4>Performance Index</h4></div>
              <div className="card-body" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{data.capability_index?.toFixed(0)}%</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 8 }}>CAPABILITY SCORE</div>
                <div className="progress-bar" style={{ marginTop: 20 }}><div className="progress-fill" style={{ width: `${data.capability_index}%` }} /></div>
              </div>
            </div>
          </div>

          {/* Right: Skills & Certs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div className="card animate-fade-in stagger-2">
              <div className="card-header"><h4>My Skills</h4></div>
              <div className="card-body">
                <div className="chip-list">
                  {(data.skills || []).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: s.decayed ? '#FEE2E2' : 'var(--primary-lightest)', border: `1px solid ${s.decayed ? '#FECACA' : 'var(--primary-lighter)'}`, borderRadius: 'var(--radius-full)', padding: '6px 14px' }}>
                      {s.decayed && <AlertTriangle size={12} color="var(--danger)" />}
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.name}</span>
                      <span className={`badge ${LEVEL_COLORS[s.level] || 'badge-muted'}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{s.level}</span>
                    </div>
                  ))}
                  {(!data.skills || data.skills.length === 0) && <p style={{ color: 'var(--text-muted)' }}>No skills listed yet.</p>}
                </div>
              </div>
            </div>

            <div className="card animate-fade-in stagger-3">
              <div className="card-header"><h4>Current Deployments</h4></div>
              <div className="card-body">
                {(data.deployments || []).filter(d => d.status === 'active').length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No active deployments.</p> : (
                  data.deployments.filter(d => d.status === 'active').map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 'var(--radius)', borderLeft: '3px solid var(--primary)' }}>
                      <div><div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d.project_name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.client_name}</div></div>
                      <div className="badge badge-info">{d.role}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card animate-fade-in stagger-4">
              <div className="card-header"><h4>Achievements 🏅</h4></div>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                  {certs.map((c, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: 12, border: '1px dashed var(--primary-lighter)', borderRadius: 'var(--radius)' }}>
                      <Star size={24} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, lineHeight: 1.3 }}>{c.course_title}</div>
                    </div>
                  ))}
                  {certs.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No certificates earned yet.</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
