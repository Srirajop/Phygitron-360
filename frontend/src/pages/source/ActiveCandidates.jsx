import React, { useState, useEffect } from 'react';
import { sourceApi } from '../../api';
import { Search, UserCheck, Milestone } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

export default function ActiveCandidates() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  


  useEffect(() => {
    sourceApi.activeCandidates()
      .then(r => setCandidates(r.data.data || []))
      .catch(() => toast.error('Failed to load candidates'))
      .finally(() => setLoading(false));
  }, []);



  const filtered = candidates.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>Active Candidates</h1>
          <p>Trainees actively taking assessments in the recruitment pipeline</p>
        </div>
      </div>

      <div className="page-body">
        <div className="card animate-fade-in" style={{ marginBottom: 24, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Search size={18} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '0.95rem', color: 'var(--text-primary)' }}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ background: 'var(--primary-lightest)', color: 'var(--primary)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><UserCheck size={32} /></div>
            <p>No active trainees found in the pipeline.</p>
          </div>
        ) : (
          <div className="card animate-scale-in">
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Tests Taken</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Resume Profile</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Assessment Avg</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Overall Score</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Joined</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const insights = c.insights || { total_tests: 0, avg_score: 0, has_malpractice: false };
                  const scoreColor = insights.avg_score >= 70 ? 'var(--success)' : insights.avg_score >= 40 ? 'var(--warning)' : 'var(--danger)';

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{c.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600 }}>{insights.total_tests}</span>
                          {insights.has_malpractice && <span title="Malpractice flagged" style={{ fontSize: '1rem' }}>⚠️</span>}
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                         <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{insights.resume_score || 0}</span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {insights.total_tests > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 40, height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${insights.avg_score}%`, height: '100%', background: scoreColor }} />
                            </div>
                            <span style={{ fontWeight: 700, color: scoreColor }}>{insights.avg_score}%</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No Data</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                         <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                           {(() => {
                              const finalScoreColor = (insights.final_score || 0) >= 70 ? 'var(--success)' : (insights.final_score || 0) >= 40 ? 'var(--warning)' : 'var(--danger)';
                              return (
                                <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${finalScoreColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 800, color: finalScoreColor }}>
                                  {Math.round(insights.final_score || 0)}
                                </div>
                              );
                           })()}
                         </div>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                         <Link 
                           to={c.is_employee ? `/deploy/employee/${c.employee_id}` : `/source/candidates/${c.id}`} 
                           className="btn btn-ghost btn-sm" 
                           style={{ gap: '6px' }}
                         >
                            View Profile
                         </Link>
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
