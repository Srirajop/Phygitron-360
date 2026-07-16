import React, { useMemo, useState, useEffect } from 'react';
import { sourceApi } from '../../api';
import { Search, Trophy, Activity, ClipboardCheck, AlertTriangle, Users, Star, ExternalLink, Timer, BarChart2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const scoreColor = (score) => {
  if (score == null) return 'var(--text-muted)';
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--danger)';
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const formatScore = (score) => score == null ? '-' : `${Math.round(score)}%`;

function StatCard({ label, value, icon }) {
  return (
    <div className="stat-card animate-fade-in">
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function CompactScore({ score }) {
  const color = scoreColor(score);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 46, height: 46, borderRadius: '50%', border: `3px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color }}>
        {score == null ? '-' : Math.round(score)}
      </div>
    </div>
  );
}

export default function ActiveCandidates() {
  const [dashboard, setDashboard] = useState({ stats: {}, trainees: [], leaderboard: [], active_tests: [], recent_results: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    sourceApi.activeCandidates()
      .then(r => setDashboard(r.data.data || { stats: {}, trainees: [], leaderboard: [], active_tests: [], recent_results: [] }))
      .catch(() => toast.error('Failed to load trainee dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const trainees = dashboard.trainees || [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trainees;
    return trainees.filter(t =>
      (t.name || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q) ||
      (t.location || '').toLowerCase().includes(q)
    );
  }, [trainees, search]);

  const highPerformers = (dashboard.leaderboard || []).slice(0, 4);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>Trainee Dashboard</h1>
          <p>Track assessment activity, leaderboard performance, and trainee progress</p>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            <div className="stats-grid animate-fade-in" style={{ marginBottom: 24 }}>
              <StatCard label="Total Trainees" value={dashboard.stats?.total_trainees ?? 0} icon={<Users size={18} />} />
              <StatCard label="Active Tests" value={dashboard.stats?.active_tests ?? 0} icon={<Activity size={18} />} />
              <StatCard label="Completed Tests" value={dashboard.stats?.completed_tests ?? 0} icon={<ClipboardCheck size={18} />} />
              <StatCard label="Avg Score" value={dashboard.stats?.avg_score == null ? '-' : `${dashboard.stats.avg_score}%`} icon={<BarChart2 size={18} />} />
              <StatCard label="High Performers" value={dashboard.stats?.high_performers ?? 0} icon={<Star size={18} />} />
              <StatCard label="Flags" value={dashboard.stats?.malpractice_flags ?? 0} icon={<AlertTriangle size={18} />} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
              <div className="card animate-fade-in" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Tests In Progress</h3>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Pending and started</p>
                  </div>
                  <Timer size={20} color="var(--primary)" />
                </div>
                {(dashboard.active_tests || []).length === 0 ? (
                  <div className="empty-state" style={{ padding: 28 }}><p>No active test sessions right now.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(dashboard.active_tests || []).slice(0, 6).map(test => (
                      <div key={`${test.assignment_id}-${test.user_id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{test.trainee?.name}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{test.title}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className={`badge ${test.status === 'started' ? 'badge-warning' : 'badge-secondary'}`}>{test.status}</span>
                          <Link to={`/source/candidates/${test.trainee?.id}`} className="btn btn-ghost btn-sm" style={{ padding: '6px 10px' }}><ExternalLink size={14} /></Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card animate-fade-in" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Leaderboard</h3>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Best average scores</p>
                  </div>
                  <Trophy size={20} color="var(--primary)" />
                </div>
                {(dashboard.leaderboard || []).length === 0 ? (
                  <div className="empty-state" style={{ padding: 28 }}><p>No scored tests yet.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(dashboard.leaderboard || []).slice(0, 6).map(row => (
                      <Link key={row.user_id} to={`/source/candidates/${row.id}`} style={{ display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: row.rank <= 3 ? 'var(--primary)' : 'var(--bg-subtle)', color: row.rank <= 3 ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem' }}>{row.rank}</div>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{row.tests_completed} tests</div>
                        </div>
                        <div style={{ fontWeight: 900, color: scoreColor(row.avg_score) }}>{formatScore(row.avg_score)}</div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="card animate-fade-in" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>Recent Results</h3>
                    <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Latest completed tests</p>
                  </div>
                  <Clock size={20} color="var(--primary)" />
                </div>
                {(dashboard.recent_results || []).length === 0 ? (
                  <div className="empty-state" style={{ padding: 28 }}><p>No recent results.</p></div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(dashboard.recent_results || []).slice(0, 6).map(res => (
                      <Link key={res.result_id} to={`/source/candidates/${res.user_id}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'center', textDecoration: 'none', color: 'inherit', padding: '6px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.trainee?.name || 'Unknown'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{res.title}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 900, color: scoreColor(res.score) }}>{formatScore(res.score)}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{formatDate(res.submitted_at)}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {highPerformers.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 12px' }}>Top Trainees</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
                  {highPerformers.map(t => (
                    <Link key={t.user_id} to={`/source/candidates/${t.id}`} className="card" style={{ padding: 16, textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <CompactScore score={t.avg_score} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Best {formatScore(t.best_score)} • {t.tests_completed} tests</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="card animate-fade-in" style={{ marginBottom: 20, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Search size={18} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Search trainees by name, email, or location..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '0.95rem', color: 'var(--text-primary)' }}
              />
            </div>

            {filtered.length === 0 ? (
              <div className="empty-state"><p>No trainees found.</p></div>
            ) : (
              <div className="card animate-scale-in" style={{ overflow: 'hidden' }}>
                <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '16px 20px', fontWeight: 700 }}>Trainee</th>
                      <th style={{ padding: '16px 20px', fontWeight: 700 }}>Assignments</th>
                      <th style={{ padding: '16px 20px', fontWeight: 700 }}>Completed</th>
                      <th style={{ padding: '16px 20px', fontWeight: 700 }}>Average</th>
                      <th style={{ padding: '16px 20px', fontWeight: 700 }}>Latest Test</th>
                      <th style={{ padding: '16px 20px', fontWeight: 700 }}>Flags</th>
                      <th style={{ padding: '16px 20px', fontWeight: 700 }}>Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(t => (
                      <tr key={t.user_id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 900, color: 'var(--text-primary)' }}>{t.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.email}</div>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 800 }}>{t.tests_assigned}</div>
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{t.tests_active} active</div>
                        </td>
                        <td style={{ padding: '16px 20px', fontWeight: 800 }}>{t.tests_completed}</td>
                        <td style={{ padding: '16px 20px', fontWeight: 900, color: scoreColor(t.avg_score) }}>{formatScore(t.avg_score)}</td>
                        <td style={{ padding: '16px 20px' }}>
                          {t.latest_result ? (
                            <div>
                              <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{t.latest_result.title}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{formatDate(t.latest_result.submitted_at)}</div>
                            </div>
                          ) : <span style={{ color: 'var(--text-muted)' }}>No result</span>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          {t.malpractice_count > 0 ? <span className="badge badge-danger">{t.malpractice_count}</span> : <span className="badge badge-secondary">0</span>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <Link to={`/source/candidates/${t.id}`} className="btn btn-secondary btn-sm">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
