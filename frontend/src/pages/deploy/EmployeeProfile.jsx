import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { deployApi } from '../../api';
import { ArrowLeft, Briefcase, Award, CheckCircle, AlertTriangle } from 'lucide-react';

const LEVEL_COLOR = { beginner: 'badge-muted', intermediate: 'badge-info', advanced: 'badge-primary', expert: 'badge-success' };

export default function EmployeeProfile() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deployApi.getEmployee(id).then(r => setData(r.data.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return <div className="page-body">Employee not found.</div>;

  return (
    <div>
      <div className="page-header">
        <Link to="/deploy" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}><ArrowLeft size={16} /> Back</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.5rem' }}>{data.user?.full_name?.[0] || '?'}</div>
          <div>
            <h1 style={{ marginBottom: 4 }}>{data.user?.full_name}</h1>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <span>{data.emp_id}</span>
              <span>·</span>
              <span>{data.department || 'No Department'}</span>
              {data.join_date && <><span>·</span><span>Joined {new Date(data.join_date).toLocaleDateString()}</span></>}
            </div>
          </div>
          {data.capability_index != null && (
            <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--primary)' }}>{data.capability_index?.toFixed(0)}%</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>CAPABILITY INDEX</div>
            </div>
          )}
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <div>
            <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
              <div className="card-header"><h4>Skills Profile</h4></div>
              <div className="card-body">
                <div className="chip-list">
                  {(data.skills || []).map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: s.decayed ? '#FEE2E2' : 'var(--primary-lightest)', border: `1px solid ${s.decayed ? '#FECACA' : 'var(--primary-lighter)'}`, borderRadius: 'var(--radius-full)', padding: '6px 14px' }}>
                      {s.decayed && <AlertTriangle size={12} color="var(--danger)" />}
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.name}</span>
                      <span className={`badge ${LEVEL_COLOR[s.level] || 'badge-muted'}`} style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{s.level}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card animate-fade-in stagger-2" style={{ marginBottom: 24 }}>
              <div className="card-header"><h4><Briefcase size={16} style={{ verticalAlign: 'middle' }} /> Deployment History</h4></div>
              <div className="card-body">
                {(data.deployments || []).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No deployments yet</p> : (
                  data.deployments.map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <div><div style={{ fontWeight: 600 }}>{d.project_name}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{d.client_name}</div></div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={`badge badge-${d.status === 'active' ? 'success' : 'muted'}`}>{d.status}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>{d.start_date && new Date(d.start_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
              <div className="card-header"><h4><Award size={16} style={{ verticalAlign: 'middle' }} /> Certificates</h4></div>
              <div className="card-body">
                {(data.certificates || []).length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No certificates yet</p> : (
                  data.certificates.map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{c.verification_code}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{new Date(c.issued_at).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card animate-fade-in stagger-2">
              <div className="card-header"><h4>Assessment History</h4></div>
              <div className="card-body">
                {(data.assessment_history || []).length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No assessments</p> : (
                  data.assessment_history.map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.82rem' }}>
                      <span style={{ fontWeight: 700, color: a.pass_status ? 'var(--success)' : 'var(--danger)' }}>{a.score?.toFixed(0)}%</span>
                      <span className={`badge ${a.pass_status ? 'badge-success' : 'badge-danger'}`}>{a.pass_status ? 'Pass' : 'Fail'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{a.submitted_at && new Date(a.submitted_at).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
