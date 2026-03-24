import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { CheckCircle, PlayCircle, FileText, HelpCircle, ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const CONTENT_ICONS = { video: <PlayCircle size={16} />, article: <FileText size={16} />, quiz: <HelpCircle size={16} /> };

export default function CoursePlayer() {
  const { id } = useParams();
  const nav = useNavigate();
  const [course, setCourse] = useState(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(true);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  useEffect(() => {
    forgeApi.getCourse(id).then(r => {
      setCourse(r.data.data);
      setProgress(r.data.data.progress || {});
    }).finally(() => setLoading(false));
  }, [id]);

  const enrollAndStart = async () => {
    try {
      await forgeApi.enroll(parseInt(id));
      const r = await forgeApi.getCourse(id);
      setCourse(r.data.data);
    } catch {}
  };

  const markComplete = async (sectionId) => {
    if (!course?.enrollment) { await enrollAndStart(); return; }
    try {
      const res = await forgeApi.completeSection(sectionId, { enrollment_id: course.enrollment.id });
      setProgress(p => ({ ...p, [sectionId]: { completed: true } }));
      toast.success('Section complete! 🎉');
      // Move to next
      const next = currentSection + 1;
      if (next < course.sections.length) setCurrentSection(next);
    } catch { toast.error('Failed to mark complete'); }
  };

  const submitQuiz = async () => {
    const section = course.sections[currentSection];
    const quizzes = section.quizzes || [];
    const score = quizzes.reduce((s, q) => s + (quizAnswers[q.id] === q.correct_answer ? 1 : 0), 0);
    const pct = Math.round((score / quizzes.length) * 100);
    await forgeApi.completeSection(section.id, { enrollment_id: course.enrollment?.id || 0, quiz_score: pct });
    setProgress(p => ({ ...p, [section.id]: { completed: true, quiz_score: pct } }));
    setQuizSubmitted(true);
    toast.success(`Quiz: ${pct}%`);
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner spinner-lg" /></div>;
  if (!course) return <div style={{ padding: 32 }}>Course not found.</div>;

  const sections = course.sections || [];
  const section = sections[currentSection];
  const sectionDone = progress[section?.id]?.completed;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div className="page-bg" />
      {/* Header */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', height: 64, gap: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => nav('/forge')}><ChevronLeft size={16} /> Back</button>
        <div style={{ flex: 1, fontWeight: 700 }}>{course.title}</div>
        {course.enrollment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{course.enrollment.progress_percent?.toFixed(0)}% complete</div>
            <div className="progress-bar" style={{ width: 120 }}><div className="progress-fill" style={{ width: `${course.enrollment.progress_percent}%` }} /></div>
          </div>
        )}
      </div>

      <div className="course-layout">
        {/* Left sidebar: sections */}
        <div className="course-sidebar">
          <h4 style={{ marginBottom: 12, fontSize: '0.9rem' }}>Course Content</h4>
          {sections.map((s, i) => (
            <div key={s.id} className={`section-item ${i === currentSection ? 'active' : ''}`} onClick={() => { setCurrentSection(i); setQuizAnswers({}); setQuizSubmitted(false); }}>
              <div className={`section-check ${progress[s.id]?.completed ? 'done' : ''}`}>
                {progress[s.id]?.completed ? <CheckCircle size={12} /> : null}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: i === currentSection ? 700 : 500 }}>{s.title}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {CONTENT_ICONS[s.content_type] || null}
                  {s.content_type} {s.duration_minutes ? `· ${s.duration_minutes}m` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right: content */}
        <div className="course-content">
          {!course.enrollment && (
            <div style={{ textAlign: 'center', padding: '48px 32px', marginBottom: 32, background: 'var(--primary-lightest)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--primary-lighter)' }}>
              <h3 style={{ marginBottom: 12 }}>Enroll to start learning</h3>
              <button className="btn btn-shimmer" onClick={enrollAndStart}>Enroll Now →</button>
            </div>
          )}

          {section && (
            <div className="animate-fade-in">
              <h2 style={{ marginBottom: 4 }}>{section.title}</h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 24 }}>{section.content_type} {section.duration_minutes ? `· ${section.duration_minutes} minutes` : ''}</div>

              {section.content_type === 'video' && section.content_url && (
                <div style={{ position: 'relative', paddingBottom: '56.25%', borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24, boxShadow: 'var(--shadow-lg)' }}>
                  <iframe src={section.content_url.replace('watch?v=', 'embed/')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} allowFullScreen title={section.title} />
                </div>
              )}

              {/* Quiz */}
              {section.content_type === 'quiz' && (section.quizzes || []).length > 0 && (
                <div>
                  {section.quizzes.map((q, qi) => (
                    <div key={q.id} className="question-card">
                      <p style={{ fontWeight: 600, marginBottom: 16 }}>Q{qi+1}. {q.question_text}</p>
                      {q.options?.map((opt, oi) => (
                        <div key={oi} className={`option-item ${quizAnswers[q.id] === opt ? 'selected' : ''} ${quizSubmitted && (opt === q.correct_answer ? 'correct' : quizAnswers[q.id] === opt ? 'incorrect' : '')}`} onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [q.id]: opt }))}>
                          {opt}
                        </div>
                      ))}
                      {quizSubmitted && q.explanation && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 8, fontStyle: 'italic' }}>💡 {q.explanation}</p>}
                    </div>
                  ))}
                  {!quizSubmitted && (
                    <button className="btn btn-primary" onClick={submitQuiz} disabled={Object.keys(quizAnswers).length < (section.quizzes?.length || 0)}>Submit Quiz</button>
                  )}
                </div>
              )}

              {!sectionDone && section.content_type !== 'quiz' && course.enrollment && (
                <button className="btn btn-success btn-lg" onClick={() => markComplete(section.id)}><CheckCircle size={16} /> Mark as Complete</button>
              )}
              {sectionDone && (
                <div className="badge badge-success" style={{ fontSize: '0.9rem', padding: '10px 20px' }}>✅ Section Completed!</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
