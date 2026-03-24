import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { verifyApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle, XCircle, Trophy, BookOpen, BarChart2 } from 'lucide-react';

const CONFETTI_COLORS = ['#7C3AED', '#A855F7', '#EC4899', '#06B6D4', '#F59E0B', '#10B981'];

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

  useEffect(() => {
    verifyApi.getResult(id).then(r => {
      setResult(r.data.data);
      if (r.data.data.pass_status) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5000); }
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!result) return <div className="page-body">Result not found.</div>;

  const f = result.feedback || {};
  const feedbackText = typeof f === 'string' ? f : (f.summary || f.overall_feedback || JSON.stringify(f));
  const strengths = Array.isArray(f.strengths) ? f.strengths : [];
  const improvements = Array.isArray(f.improvement_areas) ? f.improvement_areas : (Array.isArray(f.areas_for_improvement) ? f.areas_for_improvement : []);

  return (
    <div>
      {showConfetti && <Confetti />}
      <div className="page-header">
        <h1>Assessment Results</h1>
        <p>{result.assessment?.title}</p>
      </div>
      <div className="page-body">
        {/* Score Card / Submission State */}
        {!result.is_released && user?.role === 'candidate' ? (
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

        {/* Proctoring Log */}
        {result.proctoring_flags !== undefined && (
          <div className="card animate-fade-in stagger-3" style={{ maxWidth: 640, margin: '0 auto 24px' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>📹 Proctoring Report</h4>
              {result.proctoring_flags.length === 0 ? (
                <span className="badge badge-success">Clean</span>
              ) : (
                <span className="badge badge-danger">{result.proctoring_flags.length} Warnings</span>
              )}
            </div>
            <div className="card-body">
              {result.proctoring_flags.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle size={16} color="var(--success)" /> No proctoring violations were recorded during this session.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {[...(result.proctoring_flags || [])].sort((a, b) => new Date(a.flagged_at) - new Date(b.flagged_at)).map((flag, idx) => (
                    <li key={idx} style={{ marginBottom: 12 }}>
                      <strong>{flag.type.replace('_', ' ').toUpperCase()}</strong> at {new Date(flag.flagged_at).toLocaleTimeString()}: 
                      {flag.type === 'screenshot' && flag.details?.startsWith('data:image') ? (
                        <div style={{ marginTop: 8 }}>
                          <img src={flag.details} alt="Proctor Snapshot" style={{ maxWidth: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                        </div>
                      ) : (
                        <span> {flag.details || 'Violations logged.'}</span>
                      )}
                    </li>
                  ))}
                  <li style={{ color: 'var(--text-muted)' }}>* Note: Standard limits apply. 3+ tab switches trigger auto-termination. Video monitoring artifacts are strictly available to Admins.</li>
                </ul>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={`/verify/leaderboard/${result.assessment?.id}`} className="btn btn-secondary"><Trophy size={15} /> View Leaderboard</Link>
          <Link to="/forge" className="btn btn-primary"><BookOpen size={15} /> Start Learning</Link>
          <Link to="/verify/dashboard" className="btn btn-ghost"><BarChart2 size={15} /> Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
