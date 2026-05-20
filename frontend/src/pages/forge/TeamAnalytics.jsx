import React, { useEffect, useState } from 'react';
import { forgeApi } from '../../api';
import { Users, Award, TrendingUp, BookOpen, CheckCircle, Target } from 'lucide-react';
import toast from 'react-hot-toast';

function MiniBar({ value, max, color = 'var(--primary)' }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="progress-bar" style={{ height: 6 }}>
      <div style={{ height: '100%', background: color, borderRadius: 999, width: `${pct}%`, transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)' }} />
    </div>
  );
}

export default function TeamAnalytics() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    forgeApi.teamAnalytics()
      .then(r => setTeam(r.data.data || []))
      .catch(() => toast.error('Failed to load team analytics'))
      .finally(() => setLoading(false));
  }, []);

  const totalEnrolled = team.reduce((s, t) => s + (t.enrolled || 0), 0);
  const totalCompleted = team.reduce((s, t) => s + (t.completed || 0), 0);
  const totalCerts = team.reduce((s, t) => s + (t.certificates || 0), 0);
  const compRate = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;
  const avgTeamProgress = team.length > 0 ? Math.round(team.reduce((s, t) => s + (t.avg_progress_percent || 0), 0) / team.length) : 0;

  const sorted = [...team].sort((a, b) => (b.completed || 0) - (a.completed || 0));

  return (
    <div>
      <div className="page-header">
        <h1>Team Learning Analytics</h1>
        <p>Track your team's learning progress, completions, and certificate achievements</p>
      </div>
      <div className="page-body">
        <div className="stats-grid animate-fade-in" style={{ marginBottom: 32 }}>
          {[
            { label: 'Team Members', value: team.length, icon: <Users size={18} /> },
            { label: 'Total Enrollments', value: totalEnrolled, icon: <BookOpen size={18} /> },
            { label: 'Completions', value: totalCompleted, icon: <CheckCircle size={18} /> },
            { label: 'Completion Rate', value: `${compRate}%`, icon: <TrendingUp size={18} /> },
            { label: 'Certificates', value: totalCerts, icon: <Award size={18} /> },
            { label: 'Avg Progress', value: `${avgTeamProgress}%`, icon: <Target size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i + 1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : team.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">Team</div>
            <p>No team members found. Employees will appear here once added.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
            <div className="card animate-fade-in" style={{ overflow: 'hidden' }}>
              <div className="card-header">
                <h4 style={{ margin: 0 }}>Team Learning Progress</h4>
              </div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Member</th>
                      <th>Department</th>
                      <th>Enrolled</th>
                      <th>Completed</th>
                      <th>Certs</th>
                      <th>Progress</th>
                      <th>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((member, i) => {
                      const isTop = i === 0 && member.completed > 0;
                      const avgProgress = Math.round(member.avg_progress_percent || 0);
                      return (
                        <tr key={member.employee_id} className={`animate-fade-in stagger-${Math.min(i + 1, 5)}`}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                background: isTop
                                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                                  : 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                              }}>
                                {isTop ? '1' : (member.name?.[0] || '?')}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{member.name}</div>
                                {isTop && <div style={{ fontSize: '0.65rem', color: '#D97706', fontWeight: 700 }}>Top Learner</div>}
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{member.department || '-'}</td>
                          <td><span className="badge badge-info">{member.enrolled}</span></td>
                          <td><span className="badge badge-success">{member.completed}</span></td>
                          <td><span style={{ fontWeight: 700, color: '#D97706' }}>{member.certificates || 0}</span></td>
                          <td style={{ width: 130 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <MiniBar
                                value={member.avg_progress_percent || 0}
                                max={100}
                                color={avgProgress >= 80 ? 'var(--success)' : avgProgress >= 50 ? '#3B82F6' : 'var(--primary)'}
                              />
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{avgProgress}% avg</div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                            {member.last_accessed_at ? new Date(member.last_accessed_at).toLocaleString() : 'No activity yet'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="card animate-fade-in stagger-2">
                <div className="card-header"><h4 style={{ margin: 0 }}>Top Performers</h4></div>
                <div className="card-body" style={{ padding: '12px 20px' }}>
                  {sorted.slice(0, 5).map((m, i) => (
                    <div key={m.employee_id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 0',
                      borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: ['#F59E0B', '#9CA3AF', '#B45309', 'var(--primary-lighter)', 'var(--primary-lighter)'][i] || 'var(--primary-lighter)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: i < 3 ? 'white' : 'var(--primary)', fontWeight: 900, fontSize: '0.75rem',
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{m.completed} completed | {Math.round(m.avg_progress_percent || 0)}% avg</div>
                      </div>
                    </div>
                  ))}
                  {sorted.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '16px 0' }}>No data yet</p>}
                </div>
              </div>

              <div className="card animate-fade-in stagger-3">
                <div className="card-header"><h4 style={{ margin: 0 }}>Learning Coverage</h4></div>
                <div className="card-body">
                  {[
                    { label: 'With any enrollment', value: team.filter(t => t.enrolled > 0).length, total: team.length, color: '#3B82F6' },
                    { label: 'At least 1 completion', value: team.filter(t => t.completed > 0).length, total: team.length, color: '#10B981' },
                    { label: 'Certificate holder', value: team.filter(t => t.certificates > 0).length, total: team.length, color: '#F59E0B' },
                  ].map((item, i) => (
                    <div key={i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: 5 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}/{item.total}</span>
                      </div>
                      <MiniBar value={item.value} max={item.total} color={item.color} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
