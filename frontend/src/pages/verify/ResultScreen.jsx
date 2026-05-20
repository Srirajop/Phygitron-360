import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle, XCircle, Trophy, BookOpen, BarChart2, Download, ExternalLink, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const CONFETTI_COLORS = ['#7C3AED', '#A855F7', '#EC4899', '#06B6D4', '#F59E0B', '#10B981'];
const PROCTORING_EVIDENCE_TYPES = new Set(['screenshot', 'audio_snippet']);
const MAX_STRIKES = 5;

function Confetti() {
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999 }}>
      {[...Array(40)].map((_, i) => (
        <div key={i} className="confetti-piece" style={{
          left: `${Math.random() * 100}%`,
          background: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          animationDelay: `${Math.random() * 2}s`,
          animationDuration: `${2 + Math.random() * 2}s`,
          width: `${6 + Math.random() * 8}px`, height: `${10 + Math.random() * 10}px`,
          borderRadius: Math.random() > 0.5 ? '50%' : '2px',
        }} />
      ))}
    </div>
  );
}

export default function ResultScreen() {
  const { id } = useParams();
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [appealText, setAppealText] = useState('');
  const [appealSubmitting, setAppealSubmitting] = useState(false);

  useEffect(() => {
    let interval;
    const fetchResult = () => {
      verifyApi.getResult(id).then(r => {
        const data = r.data.data;
        setResult(data);
        setAppealText(data.appeal_query?.message || '');
        if (data.pass_status) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5000); }
        
        // Stop polling if graded
        if (data.score !== null) {
          clearInterval(interval);
        }
      }).finally(() => setLoading(false));
    };

    fetchResult();
    
    // Poll every 5 seconds if not yet graded
    interval = setInterval(() => {
      verifyApi.getResult(id).then(r => {
        const data = r.data.data;
        if (data.score !== null) {
          setResult(data);
          clearInterval(interval);
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [id]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!result) return <div className="page-body">Result not found.</div>;

  const f = result.feedback || {};
  let feedbackText = '';
  if (typeof f === 'string') {
    feedbackText = f;
  } else if (f.summary) {
    feedbackText = f.summary;
  } else if (f.overall_feedback) {
    feedbackText = f.overall_feedback;
  } else {
    feedbackText = "Feedback is under review or not available for this assessment.";
  }
  const strengths = Array.isArray(f.strengths) ? f.strengths : [];
  const improvements = Array.isArray(f.improvement_areas) ? f.improvement_areas : (Array.isArray(f.areas_for_improvement) ? f.areas_for_improvement : []);
  const appealQuery = result.appeal_query;
  const proctoringFlags = Array.isArray(result.proctoring_flags) ? result.proctoring_flags : [];
  const violationFlags = proctoringFlags.filter(flag => !PROCTORING_EVIDENCE_TYPES.has(flag.type));

  const handleSubmitAppeal = async () => {
    if (!appealText.trim()) return;
    setAppealSubmitting(true);
    try {
      const res = await verifyApi.submitAppeal(result.result_id, {
        subject: 'Malpractice Appeal',
        message: appealText.trim(),
      });
      setResult(prev => ({ ...prev, appeal_query: res.data.data }));
    } catch {
      toast.error('Failed to submit appeal');
    } finally {
      setAppealSubmitting(false);
    }
  };

  return (
    <div>
      {showConfetti && <Confetti />}
      <div className="page-header">
        <h1>Assessment Results</h1>
        <p>{result.assessment?.title}</p>
      </div>
      <div className="page-body">
        {/* Score Card / Submission State */}
        {result.is_malpractice ? (
          <div className="card animate-scale-in" style={{ maxWidth: 640, margin: '0 auto 32px', border: '2px solid #ef4444', background: 'rgba(239, 68, 68, 0.03)', boxShadow: '0 10px 30px rgba(239, 68, 68, 0.1)' }}>
            <div className="card-body" style={{ padding: 48, textAlign: 'center' }}>
              <div style={{ background: '#FEE2E2', color: '#ef4444', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 20px rgba(239, 68, 68, 0.2)' }}>
                <XCircle size={40} />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#991B1B', marginBottom: 12 }}>Malpractice Detected</h2>
              <p style={{ color: 'var(--text-primary)', fontSize: '1.1rem', lineHeight: 1.6, maxWidth: 480, margin: '0 auto', fontWeight: 500 }}>
                Our system has identified multiple proctoring violations during this session.
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: 12 }}>
                As per our integrity policy, this assessment has been <strong>automatically terminated</strong> and flagged for manual review by HR.
              </p>
              
              <div style={{ background: 'white', border: '1px solid #FEE2E2', borderRadius: 12, padding: 20, marginTop: 32, textAlign: 'left' }}>
                <div style={{ fontWeight: 700, marginBottom: 10, fontSize: '0.75rem', color: '#991B1B', letterSpacing: '0.05em' }}>SESSION STATUS</div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Security Strikes</span> <span style={{ fontWeight: 700 }}>{violationFlags.length} of {MAX_STRIKES}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>System Decision</span> <span style={{ color: '#ef4444', fontWeight: 700 }}>Candidate Terminated</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Permanent Record</span> <span style={{ fontWeight: 700 }}>Flagged ⚠️</span></div>
                </div>
              </div>
              {(user?.id == result.user_id || ['hr', 'org_admin', 'manager'].includes(user?.role)) && (
                <div style={{ background: 'white', border: '1px solid #FEE2E2', borderRadius: 12, padding: 20, marginTop: 20, textAlign: 'left' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.95rem', color: '#991B1B' }}>Appeal / Query</div>
                  {user?.id == result.user_id ? (
                    <>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 12 }}>
                        If you believe this malpractice flag was incorrect, write your explanation here. HR, admins, and managers can review it later.
                      </p>
                      <textarea
                        className="form-control"
                        rows={5}
                        value={appealText}
                        onChange={e => setAppealText(e.target.value)}
                        placeholder="Explain what happened during the assessment..."
                        disabled={appealSubmitting}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 14, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {appealQuery?.updated_at ? `Last updated ${new Date(appealQuery.updated_at).toLocaleString()}` : 'No appeal submitted yet'}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          {appealQuery && <span className="badge badge-info">{appealQuery.status || 'open'}</span>}
                          <button className="btn btn-primary btn-sm" onClick={handleSubmitAppeal} disabled={appealSubmitting || !appealText.trim()}>
                            {appealSubmitting ? 'Submitting...' : (appealQuery ? 'Update Appeal' : 'Submit Appeal')}
                          </button>
                        </div>
                      </div>
                      {appealQuery?.response && (
                        <div style={{ marginTop: 16, padding: 12, background: 'var(--primary-lightest)', borderRadius: 8, border: '1px solid var(--primary-light)' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--primary)', marginBottom: 4 }}>OFFICIAL RESPONSE</div>
                          <div style={{ fontSize: '0.85rem' }}>{appealQuery.response}</div>
                        </div>
                      )}
                    </>
                  ) : appealQuery ? (
                    <>
                      <div style={{ background: 'var(--bg-page)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 4 }}>Candidate Explanation:</div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{appealQuery.message}</div>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>Internal Response / Decision</label>
                        <textarea
                          className="form-control"
                          rows={3}
                          value={appealQuery.response || ''}
                          placeholder="Write a response or explain the final decision..."
                          onChange={async (e) => {
                            const val = e.target.value;
                            try {
                              await verifyApi.updateAssessmentQuery(appealQuery.id, { response: val });
                              setResult(prev => ({ 
                                ...prev, 
                                appeal_query: { ...prev.appeal_query, response: val } 
                              }));
                            } catch {}
                          }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ID: #{appealQuery.id}</div>
                        <select 
                          className="form-control" 
                          style={{ width: 'auto', padding: '4px 12px' }}
                          value={appealQuery.status || 'open'}
                          onChange={async (e) => {
                            const status = e.target.value;
                            try {
                              await verifyApi.updateAssessmentQuery(appealQuery.id, { status });
                              setResult(prev => ({ 
                                ...prev, 
                                appeal_query: { ...prev.appeal_query, status } 
                              }));
                              toast.success(`Marked as ${status}`);
                            } catch { toast.error('Failed'); }
                          }}
                        >
                          <option value="open">Open</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No appeal has been submitted by the candidate yet.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : result.score === null ? (
          <div className="card animate-scale-in" style={{ maxWidth: 640, margin: '0 auto 32px', textAlign: 'center', background: 'linear-gradient(135deg, var(--primary-lightest), white)' }}>
            <div className="card-body" style={{ padding: 48 }}>
              <div className="spinner spinner-lg" style={{ margin: '0 auto 24px' }} />
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>Grading in Progress</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
                Your assessment has been submitted successfully. Our AI engine is currently evaluating your responses and generating feedback.
              </p>
              <div className="badge badge-warning" style={{ marginTop: 24, fontSize: '0.85rem' }}>
                Estimated time: 10-15 seconds
              </div>
            </div>
          </div>
        ) : !result.is_released && user?.role === 'candidate' ? (
          <div className="card animate-scale-in" style={{ maxWidth: 640, margin: '0 auto 32px', textAlign: 'center', background: 'linear-gradient(135deg, var(--primary-lightest), white)' }}>
            <div className="card-body" style={{ padding: 48 }}>
              <div style={{ background: 'var(--success-light)', color: 'var(--success)', width: 80, height: 80, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <CheckCircle size={40} />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>Assessment Submitted</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, maxWidth: 400, margin: '0 auto' }}>
                Thank you for completing the assessment! Your responses have been successfully recorded and are now pending review.
              </p>
              <div className="badge badge-muted" style={{ marginTop: 24, fontSize: '0.85rem' }}>
                Status: Under Evaluation
              </div>
            </div>
          </div>
        ) : (
          <div className="card animate-scale-in" style={{ maxWidth: 640, margin: '0 auto 32px', textAlign: 'center', background: result.pass_status ? 'linear-gradient(135deg, #DCFCE7, white)' : 'linear-gradient(135deg, #FEE2E2, white)' }}>
            <div className="card-body" style={{ padding: 48 }}>
              <div style={{ fontSize: '5.5rem', fontWeight: 900, color: result.pass_status ? 'var(--success)' : 'var(--danger)', lineHeight: 1 }}>{result.score?.toFixed(0)}%</div>
              <div style={{ marginTop: 12, marginBottom: 8 }}>
                <span className={`pass-badge-lg badge ${result.pass_status ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '1rem', padding: '10px 28px' }}>
                  {result.pass_status ? '✅ PASSED' : '❌ NOT PASSED'}
                </span>
              </div>
              <div style={{ color: 'var(--text-muted)', marginTop: 12, fontSize: '0.875rem' }}>Pass mark: {result.assessment?.pass_score}%</div>
            </div>
          </div>
        )}

        {/* Feedback */}
        {(result.is_released || user?.role !== 'candidate') && feedbackText && (
          <div className="card animate-fade-in stagger-2" style={{ maxWidth: 640, margin: '0 auto 24px' }}>
            <div className="card-header"><h4>🤖 AI Feedback</h4></div>
            <div className="card-body">
              <p style={{ marginBottom: 16 }}>{feedbackText}</p>
              {strengths.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>💪 Strengths</div>
                  {strengths.map((s, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '0.875rem' }}><CheckCircle size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: 3 }} />{s}</div>)}
                </div>
              )}
              {improvements.length > 0 && (
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--warning)', marginBottom: 8 }}>📈 Areas for Improvement</div>
                  {improvements.map((s, i) => <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: '0.875rem' }}><XCircle size={14} color="var(--warning)" style={{ flexShrink: 0, marginTop: 3 }} />{s}</div>)}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Candidate Responses (Show for recruiters or released candidates) */}
        {(result.is_released || user?.role !== 'candidate') && result.assessment?.questions?.some(q => q.question_type === 'file_upload' || q.question_type === 'coding' || q.question_type === 'written') && (
          <div className="card animate-fade-in" style={{ maxWidth: 640, margin: '0 auto 24px' }}>
            <div className="card-header"><h4>📂 Candidate Responses</h4></div>
            <div className="card-body" style={{ padding: 0 }}>
              {(result.assessment?.questions || []).map((q, idx) => {
                const answer = result.answers?.[q.id];
                if (!answer) return null;

                return (
                  <div key={idx} style={{ padding: 20, borderBottom: idx < result.assessment.questions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>QUESTION {idx + 1} ({q.question_type.toUpperCase()})</div>
                    <div style={{ fontSize: '0.9rem', marginBottom: 12, fontWeight: 500 }}>{q.question_text}</div>
                    
                    {q.question_type === 'file_upload' && (
                      <div style={{ background: 'var(--bg-page)', padding: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: 40, height: 40, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <FileText size={20} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Submitted Attachment</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{typeof answer === 'string' ? answer.split('/').pop().split('_').slice(1).join('_') : 'Candidate_Submission'}</div>
                          </div>
                        </div>
                        <a href={answer} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ gap: 8 }}>
                          <Download size={14} /> Download
                        </a>
                      </div>
                    )}

                    {q.question_type === 'written' && (
                      <div style={{ background: 'var(--bg-page)', padding: 16, borderRadius: 8, fontSize: '0.85rem', whiteSpace: 'pre-wrap', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                        {answer}
                      </div>
                    )}

                    {q.question_type === 'coding' && (
                      <div style={{ position: 'relative' }}>
                        <pre style={{ background: '#1E1B4B', padding: 16, borderRadius: 8, color: '#A5B4FC', fontSize: '0.8rem', overflowX: 'auto', margin: 0, fontFamily: 'monospace' }}>
                          {(() => {
                            try {
                              const parsed = typeof answer === 'string' ? JSON.parse(answer) : answer;
                              return parsed.code || answer;
                            } catch { return answer; }
                          })()}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {result.proctoring_flags !== undefined && (
          <div className="card animate-fade-in stagger-3" style={{ maxWidth: 640, margin: '0 auto 24px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>📹 Proctoring Report</h4>
              {violationFlags.length === 0 ? (
                <span className="badge badge-success">Clean</span>
              ) : (
                <span className="badge badge-danger">{violationFlags.length} Violations</span>
              )}
            </div>
            <div className="card-body">
              {proctoringFlags.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} color="var(--success)" /> No proctoring events were recorded.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {[...proctoringFlags].sort((a, b) => new Date(a.flagged_at) - new Date(b.flagged_at)).map((flag, idx) => (
                    <li key={idx} style={{ marginBottom: 12 }}>
                      <span className={`badge ${PROCTORING_EVIDENCE_TYPES.has(flag.type) ? 'badge-muted' : 'badge-danger'}`} style={{ marginRight: 8, fontSize: '0.7rem' }}>
                        {flag.type.replace('_', ' ').toUpperCase()}
                      </span>
                      at {new Date(flag.flagged_at).toLocaleTimeString()}: 
                      {PROCTORING_EVIDENCE_TYPES.has(flag.type) ? (
                        <div style={{ marginTop: 8 }}>
                          {flag.type === 'screenshot' && flag.details?.startsWith('data:image') ? (
                            <img src={flag.details} alt="Proctor Snapshot" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                          ) : flag.type === 'audio_snippet' ? (
                            <span className="text-muted"> [Audio evidence captured]</span>
                          ) : (
                            <span className="text-muted"> [Evidence recorded]</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 600 }}> {flag.details || 'Violation logged.'}</span>
                      )}
                    </li>
                  ))}
                  <li style={{ color: 'var(--text-muted)', marginTop: 16 }}>* AI-powered monitoring artifacts are preserved for audit purposes.</li>
                </ul>
              )}
            </div>
          </div>
        )}

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          {['super_admin', 'org_admin', 'hr'].includes(user?.role) && (
            <Link to={`/verify/leaderboard/${result.assessment?.id}`} className="btn btn-secondary"><Trophy size={15} /> View Leaderboard</Link>
          )}
          <Link to="/forge" className="btn btn-primary"><BookOpen size={15} /> Start Learning</Link>
          <Link to="/verify/dashboard" className="btn btn-ghost"><BarChart2 size={15} /> Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
