import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyApi } from '../../api';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#7C3AED', '#10B981', '#EF4444', '#F59E0B'];

export default function AssessmentAnalytics() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      verifyApi.analytics(id),
      verifyApi.assessmentSubmissions(id),
      verifyApi.assessmentQueries(id),
    ])
      .then(([a, s, q]) => {
        setData(a.data.data);
        setSubmissions(s.data.data || []);
        setQueries(q.data.data || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleRelease = async (resultId) => {
    try {
      await verifyApi.releaseResult(resultId);
      setSubmissions(s => s.map(x => x.result_id === resultId ? { ...x, is_released: true } : x));
      toast.success('Result released to candidate!');
    } catch {
      toast.error('Failed to release result');
    }
  };

  const handleQueryStatusChange = async (queryId, status) => {
    try {
      const res = await verifyApi.updateAssessmentQuery(queryId, { status });
      setQueries(prev => prev.map(q => q.id === queryId ? { ...q, ...res.data.data } : q));
      toast.success('Query updated');
    } catch {
      toast.error('Failed to update query');
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return null;

  const pieData = [
    { name: 'Pending', value: data.pending },
    { name: 'Passed', value: data.passed },
    { name: 'Failed', value: data.submitted - data.passed },
  ].filter(d => d.value > 0);

  return (
    <div>
      <div className="page-header"><h1>Assessment Analytics</h1></div>
      <div className="page-body">
        <div className="stats-grid animate-fade-in">
          {[
            { label: 'Assigned', value: data.total_assigned },
            { label: 'Submitted', value: data.submitted },
            { label: 'Passed', value: data.passed },
            { label: 'Pass Rate', value: `${data.pass_rate}%` },
            { label: 'Avg Score', value: `${data.average_score}%` },
            { label: 'Pending', value: data.pending },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="card animate-fade-in stagger-3" style={{ maxWidth: 400, margin: '0 auto 24px' }}>
          <div className="card-header"><h4>Submission Breakdown</h4></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie><Tooltip /></PieChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
              {pieData.map((d, i) => <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: COLORS[i] }} />{d.name}: {d.value}</div>)}
            </div>
          </div>
        </div>

        <div className="card animate-fade-in stagger-4">
          <div className="card-header"><h4>Candidate Submissions</h4></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Candidate</th><th>Submitted At</th><th>Score</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {submissions.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No submissions yet.</td></tr> : (
                  submissions.map(s => (
                    <tr key={s.result_id}>
                      <td style={{ fontWeight: 600 }}>{s.candidate_name}</td>
                      <td>{s.submitted_at ? new Date(s.submitted_at).toLocaleDateString() : '—'}</td>
                      <td>
                        {s.is_malpractice ? (
                          <span style={{ color: 'var(--danger)', fontWeight: 800, animation: 'pulse 2s infinite' }}>0.0% ⚠️</span>
                        ) : (
                          s.score != null ? `${s.score.toFixed(1)}%` : '—'
                        )}
                      </td>
                      <td>
                        <span className={`badge ${s.is_malpractice ? 'badge-danger' : (s.pass_status ? 'badge-success' : 'badge-danger')}`} style={{ marginRight: 8 }}>
                          {s.is_malpractice ? 'MALPRACTICE' : (s.pass_status ? 'PASS' : 'FAIL')}
                        </span>
                        {!s.is_released && <span className="badge badge-warning">Pending Release</span>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Link to={`/verify/result/${s.result_id}`} className="btn btn-ghost btn-sm">Review</Link>
                          {!s.is_released && <button className="btn btn-secondary btn-sm" onClick={() => handleRelease(s.result_id)}>Release</button>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card animate-fade-in stagger-5" style={{ marginTop: 24 }}>
          <div className="card-header"><h4>Queries</h4></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Candidate</th><th>Profile</th><th>Submitted</th><th>Query</th><th>Status</th></tr></thead>
              <tbody>
                {queries.length === 0 ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No assessment queries yet.</td></tr> : (
                  queries.map(q => (
                    <tr key={q.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{q.candidate_name || 'Candidate'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{q.candidate_email || '—'}</div>
                      </td>
                      <td>
                        {q.candidate_profile_id ? (
                          <Link to={`/source/candidates/${q.candidate_profile_id}`} className="btn btn-ghost btn-sm">Open Profile</Link>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>{q.created_at ? new Date(q.created_at).toLocaleString() : '—'}</td>
                      <td style={{ minWidth: 280 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{q.subject || 'Assessment Query'}</div>
                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{q.message}</div>
                      </td>
                      <td>
                        <select className="form-control" value={q.status || 'open'} onChange={e => handleQueryStatusChange(q.id, e.target.value)} style={{ minWidth: 140 }}>
                          <option value="open">Open</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
