import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle, XCircle, Trophy, BookOpen, BarChart2, Download, ExternalLink, FileText, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

const CONFETTI_COLORS = ['#7C3AED', '#A855F7', '#EC4899', '#06B6D4', '#F59E0B', '#10B981'];
const PROCTORING_EVIDENCE_TYPES = new Set(['screenshot', 'audio_snippet']);
const MAX_STRIKES = 5;

// Human-friendly labels for proctoring flag types (replaces naive underscore strip).
const PROCTORING_LABELS = {
  tab_switch: 'Tab Switch',
  copy_paste: 'Copy / Paste',
  timing_anomaly: 'Timing Anomaly',
  screenshot: 'Screenshot',
  camera_denied: 'Camera Denied',
  proctoring_violation: 'Proctoring Violation',
  audio_detected: 'Audio Detected',
  audio_snippet: 'Audio Snippet',
  camera_disabled: 'Camera Disabled',
  camera_obstructed: 'Camera Obstructed',
  person_not_visible: 'Face Not Visible',
  background_movement: 'Background Movement',
  significant_motion: 'Significant Motion',
  hardware_denied: 'Hardware Denied',
  gaze_averted: 'Looking Away',
  head_turn: 'Head Turn',
};
const labelFor = (t) => PROCTORING_LABELS[t] || String(t).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

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
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

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
  const screenshotFlags = proctoringFlags.filter(flag => flag.type === 'screenshot' && flag.details?.startsWith('data:image'));
  const isAdmin = ['super_admin', 'org_admin', 'hr'].includes(user?.role);

  const Q_STATUS_PILL = {
    correct: { label: 'Correct', color: 'var(--success)', bg: 'var(--success-light)' },
    partial: { label: 'Partial', color: '#B45309', bg: '#FEF3C7' },
    wrong: { label: 'Incorrect', color: 'var(--danger)', bg: 'var(--danger-light)' },
    pending: { label: 'Pending Review', color: '#6B7280', bg: 'var(--bg-hover)' },
    unanswered: { label: 'Unanswered', color: 'var(--text-muted)', bg: 'var(--bg-hover)' },
  };

  const handleDeleteFlag = async (flagId) => {
    if (!window.confirm("Delete this screenshot?")) return;
    try {
      await verifyApi.deleteProctoringFlag(result.result_id, flagId);
      setResult(prev => ({
        ...prev,
        proctoring_flags: prev.proctoring_flags.filter(f => f.id !== flagId)
      }));
      toast.success("Screenshot deleted");
    } catch (err) {
      toast.error("Failed to delete screenshot");
    }
  };

  const handleDeleteAllScreenshots = async () => {
    if (!window.confirm("Delete all screenshots for this assessment?")) return;
    try {
      await verifyApi.deleteAllScreenshots(result.result_id);
      setResult(prev => ({
        ...prev,
        proctoring_flags: prev.proctoring_flags.filter(f => f.type !== 'screenshot')
      }));
      toast.success("All screenshots deleted");
    } catch (err) {
      toast.error("Failed to delete screenshots");
    }
  };

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

  const handleReleaseResult = async () => {
    try {
      await verifyApi.releaseResult(result.result_id);
      setResult(prev => ({ ...prev, is_released: true }));
      toast.success("Result released to candidate");
    } catch (err) {
      toast.error("Failed to release result");
    }
  };

  return (
    <div>
      {showConfetti && <Confetti />}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1>Assessment Results</h1>
          <p>{result.assessment?.title}</p>
        </div>
        {isAdmin && !result.is_released && result.score !== null && (
          <button className="btn btn-shimmer" onClick={handleReleaseResult}>
            Release Result
          </button>
        )}
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
        {(result.is_released || user?.role !== 'candidate') && result.assessment?.questions?.length > 0 && (() => {
          let questions = [];
          if (result.assessment.sections && result.assessment.sections.length > 0) {
            result.assessment.sections.forEach(sec => {
              questions.push(...result.assessment.questions.filter(q => q.section_id === sec.id));
            });
            questions.push(...result.assessment.questions.filter(q => !q.section_id));
          } else {
            questions = result.assessment.questions;
          }
          let right = 0;
          let partial = 0;
          let wrong = 0;
          let unanswered = 0;

          const getQStatus = (q) => {
            const answer = result.answers?.[q.id];
            if (answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && answer.length === 0)) return 'unanswered';
            const qScore = result.scores_per_question?.[q.id];
            const earned = qScore && typeof qScore === 'object' ? qScore.score : qScore;
            const max = qScore && typeof qScore === 'object' ? qScore.max : undefined;
            if (earned === null || earned === undefined) return 'pending';
            if (Number(earned) > 0) return (max && Number(earned) >= Number(max)) ? 'correct' : 'partial';
            return 'wrong';
          };

          questions.forEach(q => {
            const st = getQStatus(q);
            if (st === 'correct') right++;
            else if (st === 'partial') partial++;
            else if (st === 'wrong') wrong++;
            else if (st === 'unanswered') unanswered++;
          });

          return (
            <div className="card animate-fade-in" style={{ maxWidth: 640, margin: '0 auto 24px' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <h4 style={{ margin: 0 }}>📂 Candidate Responses</h4>
                <div style={{ fontSize: '0.8rem', display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ color: 'var(--success)' }}><b>{right}</b> Correct</span>
                  <span style={{ color: '#B45309' }}><b>{partial}</b> Partial</span>
                  <span style={{ color: 'var(--danger)' }}><b>{wrong}</b> Wrong</span>
                  <span style={{ color: 'var(--text-muted)' }}><b>{unanswered}</b> Unanswered</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}><b>{questions.length}</b> Total</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {questions.map((q, idx) => {
                const answer = result.answers?.[q.id];

                return (
                  <div key={idx} style={{ padding: 20, borderBottom: idx < result.assessment.questions.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>QUESTION {idx + 1} ({q.question_type.toUpperCase()})</div>
                      {(() => {
                        const pill = Q_STATUS_PILL[getQStatus(q)];
                        return <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, color: pill.color, background: pill.bg }}>{pill.label}</span>;
                      })()}
                    </div>
                    <div style={{ fontSize: '0.9rem', marginBottom: 12, fontWeight: 500 }}>{q.question_text}</div>
                    
                    {q.question_type === 'mcq' && (
                      <div style={{ marginTop: 12 }}>
                        {(q.options || []).map((opt, i) => {
                          const isSelected = answer === opt;
                          const isCorrect = q.correct_answer === opt;
                          let bg = 'var(--bg-page)';
                          let border = '1px solid var(--border)';
                          let icon = null;
                          if (isSelected && isCorrect) {
                            bg = 'var(--success-light)'; border = '1px solid var(--success)'; icon = '✅';
                          } else if (isSelected && !isCorrect) {
                            bg = 'var(--danger-light)'; border = '1px solid var(--danger)'; icon = '❌';
                          } else if (isCorrect) {
                            bg = 'var(--success-light)'; border = '1px dashed var(--success)'; icon = '✓';
                          }
                          return (
                            <div key={i} style={{ padding: '8px 12px', background: bg, border, borderRadius: 6, marginBottom: 8, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{opt}</span>
                              {icon && <span>{icon}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {q.question_type === 'mcq_multi' && (
                      <div style={{ marginTop: 12 }}>
                        {(q.options || []).map((opt, i) => {
                          const ansArr = Array.isArray(answer) ? answer : [];
                          let corrArr = [];
                          try {
                            corrArr = typeof q.correct_answer === 'string' && q.correct_answer.startsWith('[') ? JSON.parse(q.correct_answer) : [q.correct_answer];
                          } catch (e) { corrArr = [q.correct_answer]; }
                          
                          const isSelected = ansArr.includes(opt);
                          const isCorrect = corrArr.includes(opt);
                          let bg = 'var(--bg-page)';
                          let border = '1px solid var(--border)';
                          let icon = null;
                          if (isSelected && isCorrect) {
                            bg = 'var(--success-light)'; border = '1px solid var(--success)'; icon = '✅';
                          } else if (isSelected && !isCorrect) {
                            bg = 'var(--danger-light)'; border = '1px solid var(--danger)'; icon = '❌';
                          } else if (isCorrect) {
                            bg = 'var(--success-light)'; border = '1px dashed var(--success)'; icon = '✓';
                          }
                          return (
                            <div key={i} style={{ padding: '8px 12px', background: bg, border, borderRadius: 6, marginBottom: 8, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                              <label style={{ display: 'flex', alignItems: 'center', margin: 0, cursor: 'default' }}>
                                <input type="checkbox" checked={isSelected} readOnly style={{ marginRight: 8, pointerEvents: 'none' }} />
                                <span>{opt}</span>
                              </label>
                              {icon && <span>{icon}</span>}
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {q.question_type === 'file_upload' && (
                      <div>
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
                          {answer ? (
                            <a href={answer} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ gap: 8 }}>
                              <Download size={14} /> Download
                            </a>
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.8rem' }}>No file uploaded</span>
                          )}
                        </div>
                        {(() => {
                          const qScore = result.scores_per_question?.[q.id];
                          const earned = qScore && typeof qScore === 'object' ? qScore.score : qScore;
                          if (earned === null || earned === undefined) {
                            if (answer) return <div style={{ marginTop: 8 }}><span className="badge badge-info">Pending manual review</span></div>;
                            return null;
                          }
                          return (
                            <div style={{ marginTop: 8 }}>
                              <span className="badge" style={{ background: Number(earned) > 0 ? 'var(--success-light)' : 'var(--danger-light)', color: Number(earned) > 0 ? 'var(--success)' : 'var(--danger)', border: '1px solid ' + (Number(earned) > 0 ? 'var(--success)' : 'var(--danger)') }}>
                                Score: {Number(earned).toFixed(1)} / {qScore?.max ?? q.marks} marks
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {q.question_type === 'written' && (
                      <div>
                        <div style={{ background: 'var(--bg-page)', padding: 16, borderRadius: 8, fontSize: '0.85rem', whiteSpace: 'pre-wrap', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                          {answer || <span style={{ color: 'var(--text-muted)' }}>No answer provided</span>}
                        </div>
                        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                          {(() => {
                            const qScore = result.scores_per_question?.[q.id];
                            const earned = qScore && typeof qScore === 'object' ? qScore.score : qScore;
                            if (earned === null || earned === undefined) return <span className="badge badge-info">Pending AI / manual review</span>;
                            const full = Number(qScore?.max ?? 0) > 0 && Number(earned) >= Number(qScore.max);
                            return (
                              <>
                                <span className="badge" style={{ background: Number(earned) > 0 ? 'var(--success-light)' : 'var(--danger-light)', color: Number(earned) > 0 ? 'var(--success)' : 'var(--danger)', border: '1px solid ' + (Number(earned) > 0 ? 'var(--success)' : 'var(--danger)') }}>
                                  {full ? '✅ Fully graded' : Number(earned) > 0 ? '🟡 Partially graded' : '❌ Incorrect'}
                                </span>
                                <span className="badge badge-muted">Score: {Number(earned).toFixed(1)} / {qScore?.max ?? q.marks} marks</span>
                              </>
                            );
                          })()}
                        </div>
                        {isAdmin && q.model_answer && (
                          <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span style={{ fontWeight: 700 }}>Model Answer: </span>
                            <span style={{ whiteSpace: 'pre-wrap' }}>{q.model_answer}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {q.question_type === 'coding' && (() => {
                      let code;
                      try {
                        const parsed = typeof answer === 'string' ? JSON.parse(answer) : answer;
                        code = parsed?.code || answer || 'No code provided';
                      } catch { code = answer || 'No code provided'; }
                      const qScore = result.scores_per_question?.[q.id];
                      const tp = qScore && typeof qScore === 'object' ? qScore.tests_passed : undefined;
                      const tt = qScore && typeof qScore === 'object' ? qScore.tests_total : undefined;
                      const earned = qScore && typeof qScore === 'object' ? qScore.score : qScore;
                      let testLabel = null;
                      let testColor = 'var(--success)';
                      let testBg = 'var(--success-light)';
                      let testBorder = 'var(--success)';
                      if (tp !== undefined && tt !== undefined) {
                        if (tp === tt) { testLabel = 'Passed all test cases (' + tp + '/' + tt + ')'; }
                        else if (tp > 0) { testLabel = 'Partial test cases (' + tp + '/' + tt + ')'; testColor = '#B45309'; testBg = '#FEF3C7'; testBorder = '#F59E0B'; }
                        else { testLabel = 'Failed all test cases (' + tp + '/' + tt + ')'; testColor = 'var(--danger)'; testBg = 'var(--danger-light)'; testBorder = 'var(--danger)'; }
                      } else if (earned !== null && earned !== undefined) {
                        testLabel = Number(earned) > 0 ? 'Solved' : 'Not solved';
                        testColor = Number(earned) > 0 ? 'var(--success)' : 'var(--danger)';
                        testBg = Number(earned) > 0 ? 'var(--success-light)' : 'var(--danger-light)';
                        testBorder = Number(earned) > 0 ? 'var(--success)' : 'var(--danger)';
                      }
                      return (
                        <div style={{ position: 'relative' }}>
                          <pre style={{ background: '#1E1B4B', padding: 16, borderRadius: 8, color: '#A5B4FC', fontSize: '0.8rem', overflowX: 'auto', margin: 0, fontFamily: 'monospace' }}>{code}</pre>
                          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                            {testLabel && (
                              <span className="badge" style={{ background: testBg, color: testColor, border: '1px solid ' + testBorder }}>
                                {testLabel}
                              </span>
                            )}
                            {earned !== null && earned !== undefined && (
                              <span className="badge badge-muted">Score: {Number(earned).toFixed(1)} / {qScore?.max ?? q.marks} marks</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
          );
        })()}
        {['super_admin', 'org_admin', 'hr', 'manager'].includes(user?.role) && result.proctoring_flags !== undefined && (
          <div className="card animate-fade-in stagger-3" style={{ maxWidth: 640, margin: '0 auto 24px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>📹 Proctoring Report</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {isAdmin && proctoringFlags.some(f => f.type === 'screenshot') && (
                  <button className="btn btn-danger btn-sm" onClick={handleDeleteAllScreenshots} title="Delete screenshots from this assessment" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Trash2 size={14} /> Delete Screenshots
                  </button>
                )}
                {violationFlags.length === 0 ? (
                  <span className="badge badge-success">Clean</span>
                ) : (
                  <span className="badge badge-danger">{violationFlags.length} Violations</span>
                )}
              </div>
            </div>
            <div className="card-body">
              {isAdmin && screenshotFlags.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, marginBottom: 8 }}>Screenshots ({screenshotFlags.length})</div>
                  <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '2px 2px 8px' }}>
                    {screenshotFlags.map((flag, index) => (
                      <button key={flag.id || index} type="button" onClick={() => setSelectedScreenshot(flag)} title="Open screenshot" style={{ position: 'relative', padding: 0, flex: '0 0 132px', height: 82, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', background: 'var(--bg-page)' }}>
                        <img src={flag.details} alt={`Proctor snapshot ${index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '3px 5px', background: 'rgba(0,0,0,.58)', color: '#fff', fontSize: '0.65rem' }}>{new Date(flag.flagged_at).toLocaleTimeString()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {proctoringFlags.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} color="var(--success)" /> No proctoring events were recorded.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {[...proctoringFlags].filter(flag => flag.type !== 'screenshot').sort((a, b) => new Date(a.flagged_at) - new Date(b.flagged_at)).map((flag, idx) => (
                    <li key={flag.id || idx} style={{ marginBottom: 12 }}>
                      <span className={`badge ${PROCTORING_EVIDENCE_TYPES.has(flag.type) ? 'badge-muted' : 'badge-danger'}`} style={{ marginRight: 8, fontSize: '0.7rem' }}>
                        {labelFor(flag.type).toUpperCase()}
                      </span>
                      at {new Date(flag.flagged_at).toLocaleTimeString()}: 
                      {PROCTORING_EVIDENCE_TYPES.has(flag.type) ? (
                        <div style={{ marginTop: 8 }}>
                          {flag.type === 'screenshot' && flag.details?.startsWith('data:image') ? (
                            isAdmin ? (
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                <img src={flag.details} alt="Proctor Snapshot" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <button
                                  className="btn btn-danger btn-sm"
                                  style={{ position: 'absolute', top: 8, right: 8, padding: '4px', borderRadius: '4px', background: 'rgba(220, 38, 38, 0.9)' }}
                                  onClick={() => handleDeleteFlag(flag.id)}
                                  title="Delete screenshot"
                                >
                                  <Trash2 size={14} color="#fff" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-muted" style={{ fontStyle: 'italic' }}> [Screenshot captured and hidden for privacy]</span>
                            )
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
      {selectedScreenshot && (
        <div role="dialog" aria-modal="true" onClick={() => setSelectedScreenshot(null)} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'relative', maxWidth: 'min(96vw, 1100px)', maxHeight: '92vh' }}>
            <img src={selectedScreenshot.details} alt="Expanded proctor snapshot" style={{ maxWidth: '100%', maxHeight: '88vh', display: 'block', borderRadius: 10 }} />
            <button type="button" onClick={() => setSelectedScreenshot(null)} aria-label="Close screenshot" className="btn btn-secondary btn-sm" style={{ position: 'absolute', top: 10, right: 10, padding: 6 }}><X size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
