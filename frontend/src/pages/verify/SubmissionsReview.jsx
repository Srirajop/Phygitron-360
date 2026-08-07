import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { verifyApi } from '../../api';
import { ChevronLeft, Users, CheckCircle, XCircle, Clock, FileText, Download, ChevronDown, ChevronUp, Eye, Send } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';

const PIE_COLORS = ['#7C3AED', '#10B981', '#EF4444', '#F59E0B'];

// ── Single Question Answer Block ──────────────────────────────────────────────
function AnswerBlock({ question, answer, score: scoreObj }) {
  const qt = question.question_type;
  // scoreObj from the backend is { score: number|null, max: number } or undefined
  const actualScore = scoreObj != null && typeof scoreObj === 'object' ? scoreObj.score : scoreObj;
  const maxMarks = (scoreObj != null && typeof scoreObj === 'object' && scoreObj.max != null)
    ? scoreObj.max
    : (parseFloat(question.marks) || 0);
  const hasScore = actualScore !== undefined && actualScore !== null;
  const scoreColor = !hasScore ? '#888' : actualScore > 0 ? 'var(--success)' : 'var(--danger)';

  return (
    <div style={{
      background: 'var(--bg-page)', borderRadius: 10, padding: '16px 18px',
      border: '1px solid var(--border)', marginBottom: 12,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {qt.replace('_', ' ')}
        </span>
        {hasScore ? (
          <span style={{ fontWeight: 700, color: scoreColor, fontSize: '0.82rem' }}>
            {actualScore > 0 ? '✅' : '❌'} {actualScore}/{maxMarks} marks
          </span>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{maxMarks} marks</span>
        )}
      </div>

      {/* Question text */}
      <div style={{ fontSize: '0.92rem', fontWeight: 500, marginBottom: 12, lineHeight: 1.5 }}>
        {question.question_text}
      </div>

      {/* MCQ */}
      {qt === 'mcq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(question.options || []).map((opt, i) => {
            const isSelected = answer === opt;
            const isCorrect = question.correct_answer === opt;
            let bg = 'transparent', border = '1px solid var(--border)', icon = null;
            if (isSelected && isCorrect) { bg = '#DCFCE7'; border = '1px solid var(--success)'; icon = '✅'; }
            else if (isSelected && !isCorrect) { bg = '#FEE2E2'; border = '1px solid var(--danger)'; icon = '❌'; }
            else if (!isSelected && isCorrect) { bg = '#F0FDF4'; border = '1px dashed var(--success)'; icon = '✓'; }
            return (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 6, background: bg, border, fontSize: '0.85rem' }}>
                <span>{opt}</span>
                {icon && <span style={{ fontWeight: 700 }}>{icon}</span>}
              </div>
            );
          })}
          {!answer && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>Not answered</div>}
        </div>
      )}

      {/* MCQ Multi */}
      {qt === 'mcq_multi' && (() => {
        const ansArr = Array.isArray(answer) ? answer : [];
        let corrArr = [];
        try {
          corrArr = typeof question.correct_answer === 'string' && question.correct_answer.startsWith('[')
            ? JSON.parse(question.correct_answer)
            : [question.correct_answer];
        } catch { corrArr = [question.correct_answer]; }
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(question.options || []).map((opt, i) => {
              const isSelected = ansArr.includes(opt);
              const isCorrect = corrArr.includes(opt);
              let bg = 'transparent', border = '1px solid var(--border)', icon = null;
              if (isSelected && isCorrect) { bg = '#DCFCE7'; border = '1px solid var(--success)'; icon = '✅'; }
              else if (isSelected && !isCorrect) { bg = '#FEE2E2'; border = '1px solid var(--danger)'; icon = '❌'; }
              else if (!isSelected && isCorrect) { bg = '#F0FDF4'; border = '1px dashed var(--success)'; icon = '✓'; }
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', borderRadius: 6, background: bg, border, fontSize: '0.85rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0, cursor: 'default' }}>
                    <input type="checkbox" checked={isSelected} readOnly style={{ pointerEvents: 'none' }} />
                    <span>{opt}</span>
                  </label>
                  {icon && <span style={{ fontWeight: 700 }}>{icon}</span>}
                </div>
              );
            })}
            {ansArr.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontStyle: 'italic' }}>Not answered</div>}
          </div>
        );
      })()}

      {/* Written */}
      {qt === 'written' && (
        <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: '0.87rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', minHeight: 48 }}>
          {answer || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No answer provided</span>}
        </div>
      )}

      {/* File Upload */}
      {qt === 'file_upload' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} color="var(--primary)" />
            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Submitted File</div>
          </div>
          {answer
            ? <a href={answer} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm"><Download size={13} /> Download</a>
            : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>No file uploaded</span>}
        </div>
      )}

      {/* Coding */}
      {qt === 'coding' && (() => {
        let code = '';
        try { const p = typeof answer === 'string' ? JSON.parse(answer) : answer; code = p?.code || answer || ''; } catch { code = answer || ''; }
        return (
          <pre style={{ background: '#1E1B4B', color: '#A5B4FC', padding: 14, borderRadius: 8, fontSize: '0.78rem', overflowX: 'auto', margin: 0, fontFamily: 'monospace', maxHeight: 280, overflowY: 'auto' }}>
            {code || 'No code submitted'}
          </pre>
        );
      })()}
    </div>
  );
}

// ── Expandable Candidate Row ──────────────────────────────────────────────────
function CandidateRow({ sub, onRelease }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [releasing, setReleasing] = useState(false);

  const handleExpand = async () => {
    if (!expanded && !detail) {
      setLoadingDetail(true);
      try {
        const r = await verifyApi.getResult(sub.result_id);
        setDetail(r.data.data);
      } catch {
        toast.error('Failed to load responses');
      } finally {
        setLoadingDetail(false);
      }
    }
    setExpanded(e => !e);
  };

  const handleRelease = async (e) => {
    e.stopPropagation();
    if (!window.confirm('Release result to ' + sub.candidate_name + '?')) return;
    setReleasing(true);
    try {
      await verifyApi.releaseResult(sub.result_id);
      onRelease(sub.result_id);
      toast.success('Result released!');
    } catch {
      toast.error('Failed to release');
    } finally {
      setReleasing(false);
    }
  };

  const passColor = sub.pass_status === true
    ? 'var(--success)'
    : sub.pass_status === false ? 'var(--danger)' : 'var(--text-muted)';

  const orderedQuestions = React.useMemo(() => {
    if (!detail) return [];
    const qs = detail.assessment?.questions || [];
    const sections = detail.assessment?.sections || [];
    if (!sections.length) return qs;
    const out = [];
    sections.forEach(sec => out.push(...qs.filter(q => q.section_id === sec.id)));
    out.push(...qs.filter(q => !q.section_id));
    return out;
  }, [detail]);

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      {/* Summary row */}
      <div
        onClick={handleExpand}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer', flexWrap: 'wrap', transition: 'background 0.15s' }}
      >
        <div style={{ flex: '1 1 160px', fontWeight: 600 }}>{sub.candidate_name}</div>
        <div style={{ flex: '1 1 100px' }}>
          {sub.score !== null && sub.score !== undefined
            ? <span style={{ fontWeight: 700, color: passColor }}>{sub.score?.toFixed(1)}%</span>
            : <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>Grading…</span>}
        </div>
        <div style={{ flex: '0 0 80px' }}>
          {sub.pass_status === true && <span className="badge badge-success">Passed</span>}
          {sub.pass_status === false && <span className="badge badge-danger">Failed</span>}
          {sub.pass_status === null && <span className="badge badge-muted">Pending</span>}
        </div>
        <div style={{ flex: '0 0 150px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          {sub.submitted_at ? new Date(sub.submitted_at).toLocaleString() : '—'}
        </div>
        {sub.is_malpractice && (
          <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>⚠ Malpractice</span>
        )}
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          {!sub.is_released && sub.score !== null && (
            <button className="btn btn-shimmer btn-sm" onClick={handleRelease} disabled={releasing}>
              <Send size={13} /> {releasing ? '…' : 'Release'}
            </button>
          )}
          {sub.is_released && (
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>✓ Released</span>
          )}
          <Link to={'/verify/result/' + sub.result_id} onClick={e => e.stopPropagation()} className="btn btn-ghost btn-sm">
            <Eye size={14} />
          </Link>
          {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 20px 20px', background: 'var(--bg-hover)' }}>
          {loadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 20, color: 'var(--text-muted)' }}>
              <div className="spinner" /> Loading responses…
            </div>
          ) : detail ? (
            <div>
              {/* Quick stats */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16, paddingTop: 12 }}>
                {[
                  { label: 'SCORE', value: (detail.score?.toFixed(0) ?? '—') + '%', color: passColor },
                  { label: 'QUESTIONS', value: orderedQuestions.length },
                  detail.time_taken_seconds > 0 && { label: 'TIME', value: Math.round(detail.time_taken_seconds / 60) + 'm' },
                ].filter(Boolean).map(stat => (
                  <div key={stat.label} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 16px', textAlign: 'center', minWidth: 80 }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: stat.color || 'var(--text-primary)' }}>{stat.value}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {/* Answers grouped by section */}
              {(() => {
                const sections = detail.assessment?.sections || [];
                const answers = detail.answers || {};
                const spq = detail.scores_per_question || {};
                const qs = detail.assessment?.questions || [];

                if (sections.length > 0) {
                  const parts = [];
                  sections.forEach(sec => {
                    const secQs = qs.filter(q => q.section_id === sec.id);
                    if (!secQs.length) return;

                    // Calculate section score totals
                    let secEarned = 0, secMax = 0;
                    secQs.forEach(q => {
                      const s = spq[q.id];
                      if (s && typeof s === 'object') { secEarned += s.score ?? 0; secMax += s.max ?? 0; }
                      else if (typeof s === 'number') { secEarned += s; secMax += q.marks ?? 0; }
                      else { secMax += q.marks ?? 0; }
                    });
                    const secPct = secMax > 0 ? Math.round((secEarned / secMax) * 100) : null;
                    const secColor = secPct == null ? 'var(--text-muted)' : secPct >= 70 ? 'var(--success)' : secPct >= 40 ? 'var(--warning)' : 'var(--danger)';

                    parts.push(
                      <div key={sec.id} style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '3px solid var(--primary)', paddingLeft: 10, marginBottom: 10, marginTop: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--primary)' }}>
                            {sec.title}{sec.time_limit_minutes ? ' · ' + sec.time_limit_minutes + ' min' : ''}
                          </div>
                          {secMax > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{secQs.length} question{secQs.length !== 1 ? 's' : ''}</span>
                              <span style={{ fontWeight: 800, fontSize: '0.82rem', background: 'var(--bg-page)', border: `1.5px solid ${secColor}`, color: secColor, borderRadius: 6, padding: '2px 9px' }}>
                                {secEarned} / {secMax} pts {secPct != null ? `(${secPct}%)` : ''}
                              </span>
                            </div>
                          )}
                        </div>
                        {secQs.map(q => <AnswerBlock key={q.id} question={q} answer={answers[q.id]} score={spq[q.id]} />)}
                      </div>
                    );
                  });
                  const uncatQs = qs.filter(q => !q.section_id);
                  if (uncatQs.length) {
                    parts.push(
                      <div key="uncat">
                        <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', borderLeft: '3px solid var(--border)', paddingLeft: 10, marginBottom: 10, marginTop: 12 }}>
                          General Questions
                        </div>
                        {uncatQs.map(q => <AnswerBlock key={q.id} question={q} answer={answers[q.id]} score={spq[q.id]} />)}
                      </div>
                    );
                  }
                  return parts;
                }
                return orderedQuestions.map(q => <AnswerBlock key={q.id} question={q} answer={answers[q.id]} score={spq[q.id]} />);
              })()}
            </div>
          ) : (
            <div style={{ padding: 16, color: 'var(--text-muted)' }}>Failed to load responses.</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SubmissionsReview() {
  const { id } = useParams();
  const nav = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assessmentTitle, setAssessmentTitle] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all([
      verifyApi.assessmentSubmissions(id),
      verifyApi.analytics(id),
      verifyApi.assessmentQueries(id),
      verifyApi.getAssessment(id),
    ])
      .then(([s, a, q, asmtRes]) => {
        setSubmissions(s.data.data || []);
        setAnalyticsData(a.data.data || null);
        setQueries(q.data.data || []);
        setAssessmentTitle(asmtRes.data.data?.title || '');
      })
      .catch(() => toast.error('Failed to load submissions'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleRelease = resultId =>
    setSubmissions(prev => prev.map(s => s.result_id === resultId ? { ...s, is_released: true } : s));

  const handleQueryStatus = async (queryId, status) => {
    try {
      const res = await verifyApi.updateAssessmentQuery(queryId, { status });
      setQueries(prev => prev.map(q => q.id === queryId ? { ...q, ...res.data.data } : q));
      toast.success('Query updated');
    } catch { toast.error('Failed to update query'); }
  };

  const filtered = submissions.filter(s => {
    if (filter === 'passed') return s.pass_status === true;
    if (filter === 'failed') return s.pass_status === false;
    if (filter === 'pending') return s.score === null;
    if (filter === 'malpractice') return s.is_malpractice;
    return true;
  });

  const total = submissions.length;
  const passed = submissions.filter(s => s.pass_status === true).length;
  const failed = submissions.filter(s => s.pass_status === false).length;
  const pending = submissions.filter(s => s.score === null).length;
  const graded = submissions.filter(s => s.score !== null);
  const avgScore = graded.length > 0 ? graded.reduce((a, s) => a + s.score, 0) / graded.length : 0;

  // Stats: prefer analytics endpoint (has pass_rate, total_assigned) then fall back to local
  const ad = analyticsData;
  const STATS = [
    { label: 'Assigned', value: ad ? ad.total_assigned : total, color: 'var(--primary)' },
    { label: 'Submitted', value: ad ? ad.submitted : total, color: 'var(--primary)' },
    { label: 'Passed', value: passed, color: 'var(--success)' },
    { label: 'Failed', value: failed, color: 'var(--danger)' },
    { label: 'Pending', value: pending, color: '#F59E0B' },
    { label: 'Pass Rate', value: ad ? `${ad.pass_rate}%` : (total ? `${((passed/total)*100).toFixed(1)}%` : '—'), color: 'var(--success)' },
    { label: 'Avg Score', value: ad ? `${ad.average_score}%` : `${avgScore.toFixed(1)}%`, color: 'var(--text-primary)' },
  ];

  const pieData = ad ? [
    { name: 'Pending', value: ad.pending },
    { name: 'Passed', value: ad.passed },
    { name: 'Failed', value: ad.submitted - ad.passed },
  ].filter(d => d.value > 0) : [];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <button className="btn btn-ghost btn-sm" onClick={() => nav('/verify/manage')} style={{ marginBottom: 8 }}>
            <ChevronLeft size={16} /> Back to Manage
          </button>
          <h1>Submissions Review</h1>
          {assessmentTitle && <p>{assessmentTitle}</p>}
        </div>
      </div>

      <div className="page-body">
        {/* Stats Strip */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: 12, marginBottom: 24 }}>
            {STATS.map(stat => (
              <div key={stat.label} className="card animate-scale-in" style={{ padding: '14px 18px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: stat.color, marginBottom: 6, letterSpacing: '0.05em' }}>{stat.label}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color }}>{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Pie Chart + Filter row */}
        {!loading && pieData.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 24, alignItems: 'start' }}>
            <div className="card animate-fade-in" style={{ padding: 0 }}>
              <div className="card-header"><h4>Submission Breakdown</h4></div>
              <div className="card-body" style={{ paddingTop: 0 }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap', paddingBottom: 8 }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem' }}>
                      <div style={{ width: 9, height: 9, borderRadius: 2, background: PIE_COLORS[i] }} />
                      {d.name}: <strong>{d.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Filter Tabs */}
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                {['all', 'passed', 'failed', 'pending', 'malpractice'].map(f => (
                  <button key={f} className={'btn btn-sm ' + (filter === f ? 'btn-primary' : 'btn-ghost')} onClick={() => setFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {/* Submissions Table */}
              <div className="card animate-fade-in">
                {loading ? (
                  <div style={{ padding: 48, textAlign: 'center' }}>
                    <div className="spinner spinner-lg" style={{ margin: '0 auto' }} />
                    <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>Loading submissions…</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                    <p>No submissions match this filter.</p>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '2px solid var(--border)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <div style={{ flex: '1 1 160px' }}>Candidate</div>
                      <div style={{ flex: '1 1 100px' }}>Score</div>
                      <div style={{ flex: '0 0 80px' }}>Status</div>
                      <div style={{ flex: '0 0 150px' }}>Submitted At</div>
                      <div style={{ flex: '0 0 180px', textAlign: 'right' }}>Actions</div>
                    </div>
                    {filtered.map(sub => (
                      <CandidateRow key={sub.result_id} sub={sub} onRelease={handleRelease} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* When no pie data (no analytics yet), show filter + table full width */}
        {!loading && pieData.length === 0 && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {['all', 'passed', 'failed', 'pending', 'malpractice'].map(f => (
                <button key={f} className={'btn btn-sm ' + (filter === f ? 'btn-primary' : 'btn-ghost')} onClick={() => setFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <div className="card animate-fade-in">
              {loading ? (
                <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner spinner-lg" style={{ margin: '0 auto' }} /></div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Users size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p>No submissions match this filter.</p>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '2px solid var(--border)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    <div style={{ flex: '1 1 160px' }}>Candidate</div>
                    <div style={{ flex: '1 1 100px' }}>Score</div>
                    <div style={{ flex: '0 0 80px' }}>Status</div>
                    <div style={{ flex: '0 0 150px' }}>Submitted At</div>
                    <div style={{ flex: '0 0 180px', textAlign: 'right' }}>Actions</div>
                  </div>
                  {filtered.map(sub => (
                    <CandidateRow key={sub.result_id} sub={sub} onRelease={handleRelease} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Queries Panel */}
        {!loading && (
          <div className="card animate-fade-in" style={{ marginTop: 24 }}>
            <div className="card-header">
              <h4>Candidate Queries</h4>
              {queries.length > 0 && <span className="badge badge-primary">{queries.length}</span>}
            </div>
            <div className="table-container">
              <table>
                <thead><tr><th>Candidate</th><th>Profile</th><th>Submitted</th><th>Query</th><th>Status</th></tr></thead>
                <tbody>
                  {queries.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No assessment queries yet.</td></tr>
                  ) : queries.map(q => (
                    <tr key={q.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{q.candidate_name || 'Candidate'}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{q.candidate_email || '—'}</div>
                      </td>
                      <td>
                        {q.candidate_profile_id ? (
                          <Link to={`/source/candidates/${q.candidate_profile_id}`} className="btn btn-ghost btn-sm">Open Profile</Link>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td>{q.created_at ? new Date(q.created_at).toLocaleString() : '—'}</td>
                      <td style={{ minWidth: 280 }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{q.subject || 'Assessment Query'}</div>
                        <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>{q.message}</div>
                      </td>
                      <td>
                        <select className="form-control" value={q.status || 'open'} onChange={e => handleQueryStatus(q.id, e.target.value)} style={{ minWidth: 140 }}>
                          <option value="open">Open</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
