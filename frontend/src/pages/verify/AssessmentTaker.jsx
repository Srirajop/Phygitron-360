import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyApi } from '../../api';
import { Clock, ChevronRight, ChevronLeft, Flag, Send, Play, Upload, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssessmentTaker() {
  const { id } = useParams();
  const nav = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const startTime = useRef(Date.now());
  const pgEvents = useRef([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    verifyApi.getAssessment(id).then(r => {
      setAssessment(r.data.data);
      if (r.data.data.time_limit_minutes) setTimeLeft(r.data.data.time_limit_minutes * 60);
    }).finally(() => setLoading(false));
  }, [id]);

  // Timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  // Proctoring: webcam access
  useEffect(() => {
    let activeStream = null;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then(s => {
        activeStream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(err => {
        toast.error('Webcam access required for proctored assessments. Please allow camera permissions.', { duration: 6000 });
        pgEvents.current.push({ type: 'camera_denied', details: err.message, time: new Date().toISOString() });
      });

    return () => {
      if (activeStream) activeStream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const formattedAnswers = { ...answers };
      (assessment?.questions || []).forEach(q => {
        if (q.question_type === 'coding' && formattedAnswers[q.id] && typeof formattedAnswers[q.id] === 'object') {
          formattedAnswers[q.id] = JSON.stringify({
            language: formattedAnswers[q.id].language || 'python',
            code: formattedAnswers[q.id].code || ''
          });
        }
      });

      const res = await verifyApi.submitAssessment({
        assessment_id: parseInt(id),
        answers: formattedAnswers,
        time_taken_seconds: Math.floor((Date.now() - startTime.current) / 1000),
        proctoring_events: pgEvents.current,
      });
      toast.success('Assessment submitted!');
      nav(`/verify/result/${res.data.data.result_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Submission failed');
      setSubmitting(false);
    }
  }, [id, answers, submitting, nav]);

  const submitRef = useRef(handleSubmit);
  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);
  const strikes = useRef(0);

  const captureScreenshot = useCallback((label = "Snapshot") => {
    if (videoRef.current && canvasRef.current) {
      const vid = videoRef.current;
      const can = canvasRef.current;
      if (vid.readyState === vid.HAVE_ENOUGH_DATA) {
        can.width = vid.videoWidth || 640;
        can.height = vid.videoHeight || 480;
        const ctx = can.getContext('2d');
        ctx.drawImage(vid, 0, 0, can.width, can.height);
        const dataUrl = can.toDataURL('image/jpeg', 0.5);
        pgEvents.current.push({ type: 'screenshot', details: dataUrl, time: new Date().toISOString() });
      }
    }
  }, []);

  // Periodic screenshots
  useEffect(() => {
    const t = setInterval(() => captureScreenshot('Periodic Screenshot'), 60000);
    return () => clearInterval(t);
  }, [captureScreenshot]);

  // Proctoring: tab visibility
  useEffect(() => {
    const handler = () => {
      if (document.hidden) {
        strikes.current++;
        const now = new Date().toISOString();
        captureScreenshot('Tab Switch');
        pgEvents.current.push({ type: 'tab_switch', details: `Tab hidden (Switch #${strikes.current})`, time: now });
        if (strikes.current >= 3) {
          toast.error('Assessment terminated due to excessive tab switching.', { duration: 6000 });
          submitRef.current();
        } else {
          toast.error(`Warning: Tab switching is recorded! (Strike ${strikes.current}/3)`, { icon: '⚠️', duration: 4000 });
        }
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [captureScreenshot]);



  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner spinner-lg" /></div>;
  if (!assessment) return <div style={{ padding: 32 }}>Assessment not found.</div>;

  const questions = assessment.questions || [];
  const q = questions[currentQ];
  if (q && q.question_type === 'coding' && typeof q.test_cases === 'string') {
    try { q.test_cases = JSON.parse(q.test_cases); }
    catch(e) { q.test_cases = []; }
  }
  const answered = Object.keys(answers).length;
  const isLast = currentQ === questions.length - 1;

  const timerClass = timeLeft === null ? '' : timeLeft < 60 ? 'danger' : timeLeft < 300 ? 'warning' : '';
  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div className="page-bg" />
      {/* Top bar */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{assessment.title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{answered}/{questions.length} answered</div>
        </div>
        {timeLeft !== null && (
          <div className={`timer ${timerClass}`}><Clock size={16} /> {formatTime(timeLeft)}</div>
        )}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}><Send size={15} /> {submitting ? 'Submitting…' : 'Submit'}</button>
      </div>

      <div style={{ maxWidth: q?.question_type === 'coding' ? 1400 : 860, width: '100%', margin: '0 auto', padding: q?.question_type === 'coding' ? '24px' : '32px 24px', transition: 'max-width 0.3s ease' }}>
        {/* Progress bar */}
        <div className="progress-bar" style={{ marginBottom: 24 }}>
          <div className="progress-fill" style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>

        {/* Question */}
        {q && (
          <div className="question-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span className="badge badge-primary">Question {currentQ + 1} of {questions.length}</span>
              <span className="badge badge-muted">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
            </div>
            {q.question_type !== 'coding' && <h3 style={{ marginBottom: 24, lineHeight: 1.5 }}>{q.question_text}</h3>}

            {(q.question_type === 'mcq' || q.question_type === 'mcq_multi') && q.options && (
              <div>
                {q.options.map((opt, i) => (
                  <div key={i} className={`option-item ${answers[q.id] === opt ? 'selected' : ''}`} onClick={() => setAnswers(a => ({ ...a, [q.id]: opt }))}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${answers[q.id] === opt ? 'var(--primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: answers[q.id] === opt ? 'var(--primary)' : 'var(--text-muted)', background: answers[q.id] === opt ? 'var(--primary-lightest)' : 'white', flexShrink: 0 }}>
                      {String.fromCharCode(65 + i)}
                    </div>
                    <span style={{ flex: 1 }}>{opt}</span>
                  </div>
                ))}
              </div>
            )}

            {q.question_type === 'written' && (
              <textarea className="form-control" rows={8} placeholder="Write your answer here…" value={answers[q.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
            )}

            {q.question_type === 'file_upload' && (
              <div className="form-group">
                <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: 32, textAlign: 'center', background: 'var(--bg-page)' }}>
                  <input 
                    type="file" 
                    id={`file-upload-${q.id}`} 
                    style={{ display: 'none' }} 
                    onChange={e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setAnswers(a => ({ ...a, [q.id]: event.target.result }));
                        toast.success(`File "${file.name}" ready for submission`);
                      };
                      reader.readAsDataURL(file);
                    }} 
                  />
                  <label htmlFor={`file-upload-${q.id}`} className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                    <Upload size={16} style={{ marginRight: 8 }} /> {answers[q.id] ? 'Change File' : 'Choose File to Upload'}
                  </label>
                  {answers[q.id] && (
                    <div style={{ marginTop: 16, color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <CheckCircle size={16} /> File successfully attached
                    </div>
                  )}
                  <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Accepted formats: PDF, DOCX, ZIP, JPG, PNG (Max 5MB)
                  </p>
                </div>
              </div>
            )}

            {q.question_type === 'coding' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 24, alignItems: 'stretch' }}>
                <div style={{ background: 'var(--bg-card)', padding: 24, borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ marginBottom: 16, color: 'var(--primary)' }}>Problem Context</h4>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 20, whiteSpace: 'pre-wrap', lineHeight: 1.6, overflowY: 'auto', flex: 1, paddingRight: 8 }}>
                    {q.question_text}
                    {q.starter_code && <div style={{ background: '#1E1B4B', borderRadius: 'var(--radius)', padding: 16, marginTop: 24, fontFamily: 'monospace', fontSize: '0.85rem', color: '#A5B4FC' }}>{q.starter_code}</div>}
                  </div>
                  
                  {q.test_cases && q.test_cases.length > 0 ? (
                    <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                      <h5 style={{ marginBottom: 12, color: 'var(--text-primary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sample Test Case</h5>
                      <div style={{ background: 'var(--bg-page)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>INPUT (STDIN)</div>
                        <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>{q.test_cases[0].input}</pre>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, marginTop: 12 }}>EXPECTED OUTPUT</div>
                        <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>{q.test_cases[0].expected_output}</pre>
                      </div>
                      {q.test_cases.length > 1 && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8 }}>+ {q.test_cases.length - 1} hidden test cases during final grading.</div>}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 'auto' }}>No explicit test cases mapped. This question will be evaluated by standard AI heuristics.</div>
                  )}
                </div>

                <div style={{ background: '#0F172A', border: '1px solid #334155', borderRadius: 'var(--radius)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: '#1E293B', borderBottom: '1px solid #334155', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#EF4444' }} />
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#F59E0B' }} />
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#10B981' }} />
                    </div>
                    <select 
                      style={{ background: '#0F172A', color: '#fff', border: '1px solid #475569', padding: '6px 12px', borderRadius: 4, fontSize: '0.85rem', outline: 'none', cursor: 'pointer' }}
                      value={(answers[q.id] && typeof answers[q.id] === 'object' ? answers[q.id].language : 'python')}
                      onChange={e => setAnswers(a => ({ ...a, [q.id]: { ...(typeof a[q.id] === 'object' ? a[q.id] : { code: q.starter_code || '' }), language: e.target.value } }))}>
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="java">Java</option>
                      <option value="c++">C++</option>
                    </select>
                    <button className="btn btn-shimmer btn-sm" onClick={async () => {
                                            const ans = answers[q.id] || {};
                      const codeStr = (typeof ans === 'object' ? ans.code : ans) || '';
                      if (!codeStr) { toast.error('Please write some code first'); return; }
                      
                      try {
                        toast.loading('Running batch tests...', { id: 'run-code' });
                        const testCases = q.test_cases || [];
                        let outputStr = "=== EXECUTION RESULTS ===\n\n";
                        let passedCount = 0;
                        
                        const res = await verifyApi.runCode({ 
                          language: (typeof ans === 'object' ? ans.language : 'python') || 'python', 
                          code: codeStr, 
                          test_cases: testCases 
                        });

                        if (!res.data.success || !res.data.data.run) {
                          outputStr += `❌ Error: ${res.data.message || res.data.data.message || 'Execution failed'}\n`;
                        } else {
                          const run = res.data.data.run;
                          const stdout = run.stdout || '';
                          const stderr = run.stderr || '';

                          if (stderr && !stdout.includes('---BATCH_RESULTS_START---')) {
                            outputStr += `❌ Runtime Error:\n${stderr}`;
                          } else if (testCases.length === 0) {
                            outputStr += "No explicit test cases provided.\nStandard Output:\n" + (stdout || 'No output.');
                          } else {
                            const startMarker = '---BATCH_RESULTS_START---';
                            const endMarker = '---BATCH_RESULTS_END---';
                            const startIndex = stdout.indexOf(startMarker);
                            const endIndex = stdout.indexOf(endMarker);

                            if (startIndex !== -1 && endIndex !== -1) {
                              const resultsJson = stdout.substring(startIndex + startMarker.length, endIndex).trim();
                              try {
                                const results = JSON.parse(resultsJson);
                                results.forEach((r, idx) => {
                                  const tc = testCases[idx];
                                  const out = (r.stdout || '').trim();
                                  const err = (r.stderr || '').trim();
                                  const exp = (tc.expected_output || '').trim();

                                  if (out.replace(/\s+/g, '') === exp.replace(/\s+/g, '')) {
                                    passedCount++;
                                    outputStr += `✅ Test Case ${idx + 1}: PASSED\n`;
                                  } else {
                                    outputStr += `❌ Test Case ${idx + 1}: FAILED\n`;
                                    if (err) outputStr += `   Error: ${err}\n`;
                                    outputStr += `   Input: ${tc.input}\n   Expected: ${exp}\n   Got: ${out || (err ? '(Error)' : '(no output)')}\n\n`;
                                  }
                                });
                                outputStr += `\nResult: ${passedCount} / ${testCases.length} Test Cases Passed.`;
                              } catch (parseErr) {
                                outputStr += `❌ Failed to parse batch results.\nRaw Output: ${stdout}`;
                              }
                            } else {
                              outputStr += "Standard Output:\n" + stdout + (stderr ? "\nErrors:\n" + stderr : "");
                            }
                          }
                        }

                        setAnswers(a => ({ ...a, [q.id]: { ...(typeof a[q.id] === 'object' ? a[q.id] : { language: 'python' }), code: codeStr, latest_output: outputStr } }));
                        toast.success('Execution completed', { id: 'run-code' });
                      } catch (e) {
                        toast.error('Execution engine failed or rate limited.', { id: 'run-code' });
                        setAnswers(a => ({ ...a, [q.id]: { ...ans, latest_output: "Execution blocked. External API rate limit reached." }}));
                      }
                    }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px' }}><Play size={14} /> Run Code</button>
                  </div>
                  
                  {q.starter_code && (!answers[q.id] || !answers[q.id].code) && (
                    <div style={{ padding: '12px 16px', fontSize: '0.8rem', color: '#94A3B8', borderBottom: '1px dashed #334155', background: 'rgba(56, 189, 248, 0.05)' }}>
                       Starter framework available. Check problem description context. 
                    </div>
                  )}
                  
                  <textarea 
                    className="form-control" 
                    placeholder="// Write your code from scratch here…" 
                    value={(answers[q.id] && typeof answers[q.id] === 'object' && answers[q.id].code) !== undefined ? answers[q.id].code : ''}
                    onChange={e => setAnswers(a => ({ ...a, [q.id]: { ...(typeof a[q.id] === 'object' ? a[q.id] : { language: 'python' }), code: e.target.value } }))} 
                    style={{ fontFamily: 'monospace', fontSize: '0.9rem', resize: 'none', background: 'transparent', color: '#E2E8F0', border: 'none', padding: 16, width: '100%', outline: 'none', flex: 1, minHeight: 300, lineHeight: 1.5 }} 
                    onKeyDown={e => {
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        const start = e.target.selectionStart;
                        const end = e.target.selectionEnd;
                        const val = e.target.value;
                        e.target.value = val.substring(0, start) + '    ' + val.substring(end);
                        e.target.selectionStart = e.target.selectionEnd = start + 4;
                        setAnswers(a => ({ ...a, [q.id]: { ...(typeof a[q.id] === 'object' ? a[q.id] : { language: 'python' }), code: e.target.value } }));
                      }
                    }}
                  />
                  
                  {answers[q.id]?.latest_output && (
                    <div style={{ borderTop: '1px solid #334155', background: '#020617', padding: 16 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94A3B8', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} /> CONSOLE OUTPUT</span>
                      </div>
                      <pre style={{ margin: 0, color: '#F1F5F9', fontSize: '0.85rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace', background: '#0F172A', padding: 12, borderRadius: 6, border: '1px solid #1E293B' }}>
                        {answers[q.id].latest_output}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={() => setCurrentQ(q => q - 1)} disabled={currentQ === 0}><ChevronLeft size={16} /> Previous</button>

          {/* Question dots */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {questions.map((q, i) => (
              <button key={i} onClick={() => setCurrentQ(i)} style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${i === currentQ ? 'var(--primary)' : answers[q.id] ? 'var(--success)' : 'var(--border)'}`, background: i === currentQ ? 'var(--primary)' : answers[q.id] ? '#DCFCE7' : 'white', color: i === currentQ ? 'white' : answers[q.id] ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', transition: 'var(--transition)' }}>
                {i + 1}
              </button>
            ))}
          </div>

          {isLast ? (
            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}><Send size={15} /> Submit</button>
          ) : (
            <button className="btn btn-primary" onClick={() => setCurrentQ(q => q + 1)}>Next <ChevronRight size={16} /></button>
          )}
        </div>
      </div>

      {/* Proctoring PIP */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, width: 220, height: 160, background: '#000', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', zIndex: 100, border: '2px solid rgba(255,255,255,0.1)' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 16, fontSize: '0.7rem', color: '#fff', fontWeight: 600, letterSpacing: '0.5px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 2s infinite' }} />
          VIDEO MONITORED
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
          Session ID: {id}-{assessment?.id}
        </div>
      </div>
    </div>
  );
}
