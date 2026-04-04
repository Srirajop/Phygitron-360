import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { CheckCircle, PlayCircle, FileText, HelpCircle, ChevronLeft, Lock, Award, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

const CONTENT_ICONS = { 
  video: <PlayCircle size={15} />, 
  article: <FileText size={15} />, 
  quiz: <HelpCircle size={15} /> 
};

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
    }).catch(() => {
      toast.error('Failed to load course');
      nav('/forge/library');
    }).finally(() => setLoading(false));
  }, [id, nav]);

  const enrollAndStart = async () => {
    try {
      await forgeApi.enroll(parseInt(id));
      const r = await forgeApi.getCourse(id);
      setCourse(r.data.data);
      toast.success('Successfully enrolled!');
    } catch {
      toast.error('Enrollment failed');
    }
  };

  const markComplete = async (sectionId) => {
    if (!course?.enrollment) return;
    try {
      await forgeApi.completeSection(sectionId, { enrollment_id: course.enrollment.id });
      setProgress(p => ({ ...p, [sectionId]: { completed: true } }));
      toast.success('Section complete! 🎉');
      
      const next = currentSection + 1;
      if (next < course.sections.length) setCurrentSection(next);
    } catch { toast.error('Failed to update progress'); }
  };

  const submitQuiz = async () => {
    const section = course.sections[currentSection];
    const quizzes = section.quizzes || [];
    // Currently relying on backend or simple front-end validation (in actual LMS, grading is backend)
    // For demo/UI purposes, mimicking frontend grading if correct_answer is provided, otherwise skipping
    const score = quizzes.reduce((s, q) => s + (quizAnswers[q.id] === q.options?.[q.correct_index] ? 1 : 0), 0);
    const pct = quizzes.length > 0 ? Math.round((score / quizzes.length) * 100) : 100;
    
    try {
      await forgeApi.completeSection(section.id, { enrollment_id: course.enrollment?.id || 0, quiz_score: pct });
      setProgress(p => ({ ...p, [section.id]: { completed: true, quiz_score: pct } }));
      setQuizSubmitted(true);
      if (pct >= (section.pass_score || 60)) {
        toast.success(`Quiz passed! Score: ${pct}%`);
      } else {
        toast.error(`Quiz failed. Score: ${pct}%. Minimum required is ${section.pass_score || 60}%`);
      }
    } catch {
      toast.error('Failed to submit quiz');
    }
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}><div className="spinner spinner-lg" /><p style={{ color: 'var(--text-muted)' }}>Loading learning environment...</p></div>;
  if (!course) return null;

  const sections = course.sections || [];
  const section = sections[currentSection];
  const sectionDone = progress[section?.id]?.completed;
  
  // Progress Ring Math
  const progressPct = course.enrollment?.progress_percent || 0;
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-page)', overflow: 'hidden' }}>
      
      {/* Top Navigation Bar */}
      <div style={{ background: '#111827', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 64, flexShrink: 0, borderBottom: '1px solid #1F2937' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button className="btn btn-ghost" style={{ color: '#9CA3AF', padding: '6px' }} onClick={() => nav(course.enrollment ? '/forge' : '/forge/library')}>
            <ChevronLeft size={18} />
          </button>
          <div style={{ width: 1, height: 24, background: '#374151' }} />
          <div>
            <h1 style={{ fontSize: '1.05rem', margin: '0 0 2px 0', fontWeight: 600, color: '#F9FAFB' }}>{course.title}</h1>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.75rem', color: '#9CA3AF' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {course.estimated_hours}h total</span>
              <span className="badge" style={{ background: '#374151', color: '#D1D5DB', fontSize: '0.65rem', padding: '2px 6px' }}>{course.difficulty}</span>
            </div>
          </div>
        </div>

        {course.enrollment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: progressPct === 100 ? '#10B981' : '#F9FAFB' }}>
              {progressPct === 100 ? 'Course Completed 🎉' : `${progressPct}% Complete`}
            </span>
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r={radius} fill="transparent" stroke="#374151" strokeWidth="4" />
              <circle cx="20" cy="20" r={radius} fill="transparent" stroke={progressPct === 100 ? '#10B981' : 'var(--primary)'} strokeWidth="4" 
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} 
                strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} 
              />
            </svg>
            {progressPct === 100 && (
              <button className="btn btn-sm" style={{ background: '#10B981', color: 'white' }} onClick={() => nav('/forge/transcript')}>
                <Award size={14} /> My Certificate
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Layout Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left pane: TOC (Table of Contents) */}
        <div style={{ width: 340, background: 'white', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, zIndex: 10 }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', background: 'var(--primary-lightest)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              Table of Contents <span className="badge badge-primary">{sections.length}</span>
            </h3>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {sections.map((s, i) => {
              const isDone = progress[s.id]?.completed;
              const isActive = i === currentSection;
              // Simple sequential locking logic: section is locked if previous is not done AND user is enrolled
              const isLocked = course.enrollment && i > 0 && !progress[sections[i-1].id]?.completed;
              
              return (
                <div 
                  key={s.id} 
                  style={{ 
                    padding: '16px 24px', borderBottom: '1px solid var(--border)',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    background: isActive ? 'var(--primary-lightest)' : isDone ? '#F9FAFB' : 'white',
                    borderLeft: `4px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                    transition: 'var(--transition)', opacity: isLocked ? 0.6 : 1
                  }}
                  onClick={() => { 
                    if (!isLocked) {
                      setCurrentSection(i); setQuizAnswers({}); setQuizSubmitted(false);
                    } else {
                      toast.error('Complete previous sections first');
                    }
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ 
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isDone ? '#10B981' : isLocked ? '#F3F4F6' : 'white',
                      border: `2px solid ${isDone ? '#10B981' : isLocked ? '#E5E7EB' : 'var(--text-muted)'}`,
                      color: isDone ? 'white' : isLocked ? '#9CA3AF' : 'transparent',
                      marginTop: 2
                    }}>
                      {isDone ? <CheckCircle size={14} /> : isLocked ? <Lock size={12} /> : null}
                    </div>
                    <div>
                      <div style={{ 
                        fontSize: '0.9rem', fontWeight: isActive ? 700 : 500, 
                        color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                        marginBottom: 4, lineHeight: 1.4
                      }}>
                        {i + 1}. {s.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {CONTENT_ICONS[s.content_type]} <span style={{ textTransform: 'capitalize' }}>{s.content_type}</span>
                        </span>
                        <span>•</span>
                        <span>{s.duration_minutes} min</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right pane: Content Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px', position: 'relative' }}>
          
          {!course.enrollment ? (
            <div className="animate-fade-in" style={{ 
              maxWidth: 600, margin: '80px auto', textAlign: 'center', padding: 48, 
              background: 'white', borderRadius: 16, border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)' 
            }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary-lightest)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Lock size={32} />
              </div>
              <h2 style={{ marginBottom: 12 }}>Unlock This Course</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 32, fontSize: '1.05rem' }}>Enroll in <strong>{course.title}</strong> to access {sections.length} premium learning modules, interactive quizzes, and earn your certification.</p>
              <button className="btn btn-shimmer" style={{ padding: '12px 32px', fontSize: '1.1rem' }} onClick={enrollAndStart}>
                Enroll for Free →
              </button>
            </div>
          ) : !section ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>Section not found.</div>
          ) : (
            <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
              
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'inline-flex', padding: '4px 12px', background: 'var(--primary-lightest)', color: 'var(--primary)', fontWeight: 700, borderRadius: 999, fontSize: '0.75rem', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Module {currentSection + 1} of {sections.length}
                </div>
                <h2 style={{ fontSize: '2rem', marginBottom: 8 }}>{section.title}</h2>
              </div>

              {/* Video Player Container */}
              {section.content_type === 'video' && (
                <div style={{ marginBottom: 32, background: 'black', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', position: 'relative', paddingTop: '56.25%' }}>
                  {section.content_url ? (
                    <iframe 
                      src={section.content_url.includes('watch?v=') ? section.content_url.replace('watch?v=', 'embed/') : section.content_url} 
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} 
                      allowFullScreen title={section.title} 
                    />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column', gap: 16 }}>
                      <PlayCircle size={48} opacity={0.5} />
                      <p>Video content is currently unavailable.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Quiz Container */}
              {section.content_type === 'quiz' && (
                <div style={{ background: 'white', borderRadius: 12, border: '1px solid var(--border)', padding: 32, marginBottom: 32 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: 8 }}><HelpCircle size={20} color="var(--primary)" /> Knowledge Check</h3>
                      <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Answer all questions correctly to proceed. minimum passing score: {section.pass_score || 60}%</p>
                    </div>
                    <div className="badge badge-info">{section.quizzes?.length || 0} Questions</div>
                  </div>

                  {(section.quizzes || []).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No questions configured for this quiz.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                      {section.quizzes.map((q, qi) => (
                        <div key={q.id || qi}>
                          <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 16 }}>
                            <span style={{ color: 'var(--primary)', marginRight: 8 }}>{qi + 1}.</span> 
                            {q.question || q.question_text || 'Untitled Question'}
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {(q.options || ['True', 'False']).map((opt, oi) => {
                              const isSelected = quizAnswers[q.id] === opt;
                              // Simulate checking against a correct answer index if evaluating purely on frontend
                              const isCorrectAnswer = opt === q.options?.[q.correct_index]; 
                              
                              let stateClass = '';
                              if (quizSubmitted) {
                                if (isSelected && isCorrectAnswer) stateClass = 'correct-choice';
                                else if (isSelected && !isCorrectAnswer) stateClass = 'wrong-choice';
                                else if (!isSelected && isCorrectAnswer) stateClass = 'missed-correct-choice'; // Optional: show what they missed
                              }

                              return (
                                <div 
                                  key={oi} 
                                  onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [q.id]: opt }))}
                                  style={{ 
                                    padding: '12px 16px', borderRadius: 8, border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                                    background: isSelected ? 'var(--primary-lightest)' : 'white',
                                    cursor: quizSubmitted ? 'default' : 'pointer', transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    // Apply validation coloring if submitted
                                    ...(quizSubmitted && (isSelected && isCorrectAnswer) ? { borderColor: '#10B981', background: '#ECFDF5' } : {}),
                                    ...(quizSubmitted && (isSelected && !isCorrectAnswer) ? { borderColor: '#EF4444', background: '#FEF2F2' } : {})
                                  }}
                                >
                                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--text-muted)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {isSelected && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)' }} />}
                                  </div>
                                  <span style={{ color: isSelected ? 'var(--primary-dark)' : 'var(--text-primary)' }}>{opt}</span>
                                </div>
                              );
                            })}
                          </div>
                          {quizSubmitted && q.explanation && (
                            <div style={{ marginTop: 12, padding: 12, background: '#EFF6FF', borderRadius: 8, borderLeft: '4px solid #3B82F6', fontSize: '0.85rem', display: 'flex', gap: 8 }}>
                              <span>💡</span>
                              <div>
                                <strong style={{ color: '#1E3A8A', display: 'block', marginBottom: 2 }}>Explanation</strong>
                                <span style={{ color: '#1E40AF' }}>{q.explanation}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!quizSubmitted && section.quizzes?.length > 0 && (
                    <div style={{ marginTop: 40, borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-primary btn-lg" 
                        onClick={submitQuiz} 
                        disabled={Object.keys(quizAnswers).length < section.quizzes.length}
                      >
                        Submit Answers
                      </button>
                    </div>
                  )}
                  {quizSubmitted && (
                    <div style={{ marginTop: 40, borderTop: '1px solid var(--border)', paddingTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                      {progress[section.id]?.quiz_score < (section.pass_score || 60) && (
                        <button className="btn btn-secondary" onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); }}>Retry Quiz</button>
                      )}
                      {(progress[section.id]?.quiz_score >= (section.pass_score || 60)) && currentSection < sections.length - 1 && (
                        <button className="btn btn-primary" onClick={() => setCurrentSection(currentSection + 1)}>Continue to Next Module <ChevronLeft style={{ transform: 'rotate(180deg)' }} size={16} /></button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Completion Action Bar */}
              {section.content_type !== 'quiz' && (
                <div style={{ background: 'white', padding: '24px 32px', borderRadius: 12, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0' }}>Finished this module?</h4>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>Mark it as complete to track your progress and unlock the next section.</p>
                  </div>
                  {!sectionDone ? (
                    <button className="btn btn-success btn-lg" onClick={() => markComplete(section.id)} style={{ padding: '12px 24px' }}>
                      <CheckCircle size={18} /> Mark as Complete
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div className="badge badge-success" style={{ fontSize: '0.9rem', padding: '10px 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
                        <CheckCircle size={16} /> Completed
                      </div>
                      {currentSection < sections.length - 1 && (
                        <button className="btn btn-primary" onClick={() => setCurrentSection(currentSection + 1)}>
                          Next <ChevronLeft style={{ transform: 'rotate(180deg)' }} size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
