import React, { useEffect, useState } from 'react';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Award, Download } from 'lucide-react';

export default function Transcript() {
  const { user } = useAuth();
  const [data, setData] = useState({ enrollments: [], certificates: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    forgeApi.transcript().then(r => setData(r.data.data || {})).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header"><h1>My Learning Transcript</h1><p>Your complete learning history and certifications</p></div>
      <div className="page-body">
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div>
              <h3 style={{ marginBottom: 16 }}>📚 Enrolled Courses</h3>
              {(data.enrollments || []).map((e, i) => (
                <div key={i} className={`card animate-fade-in stagger-${Math.min(i+1,5)}`} style={{ marginBottom: 12 }}>
                  <div className="card-body">
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>{e.course_title}</div>
                    <div className="progress-bar" style={{ marginBottom: 6 }}><div className="progress-fill" style={{ width: `${e.progress_percent}%` }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <span>{e.progress_percent.toFixed(0)}% complete</span>
                      <span>{e.completed_at ? `Completed ${new Date(e.completed_at).toLocaleDateString()}` : `Enrolled ${e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : ''}`}</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!data.enrollments || data.enrollments.length === 0) && <div className="empty-state" style={{ padding: '32px 16px' }}><div className="empty-icon">📚</div><p>No courses enrolled yet.</p></div>}
            </div>

            <div>
              <h3 style={{ marginBottom: 16 }}>🏅 Certificates</h3>
              {(data.certificates || []).map((cert, i) => (
                <div key={i} className={`card animate-fade-in stagger-${Math.min(i+1,5)}`} style={{ marginBottom: 12, background: 'linear-gradient(135deg, var(--primary-lightest), white)', border: '1px solid var(--primary-lighter)' }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Award size={20} color="white" /></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700 }}>{cert.course_title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Issued {new Date(cert.issued_at).toLocaleDateString()} · #{cert.verification_code}</div>
                      </div>
                      {cert.pdf_url && <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm"><Download size={13} /></a>}
                    </div>
                  </div>
                </div>
              ))}
              {(!data.certificates || data.certificates.length === 0) && <div className="empty-state" style={{ padding: '32px 16px' }}><div className="empty-icon">🏅</div><p>No certificates yet. Complete a course!</p></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
