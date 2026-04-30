import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { 
  CheckCircle, PlayCircle, FileText, HelpCircle, ChevronLeft, 
  Lock, Award, Clock, ChevronRight, Maximize2, RefreshCw,
  Sun, Moon, Sparkles, X
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './forge_styles.css';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

const CONTENT_ICONS = { 
  video: <PlayCircle size={16} />, 
  article: <FileText size={16} />, 
  quiz: <HelpCircle size={16} />,
  pdf: <Award size={16} />,
  lab: <Maximize2 size={16} />
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const resolveAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads')) {
    const encodedPath = url.split('/').map(part => encodeURIComponent(part)).join('/');
    return `${API_BASE}${encodedPath}`;
  }
  return url;
};

const resolveVideoUrl = (url) => {
  const resolved = resolveAssetUrl(url);
  return resolved.includes('watch?v=') ? resolved.replace('watch?v=', 'embed/') : resolved;
};

export default function CoursePlayer() {
  const { id } = useParams();
  const nav = useNavigate();
  const { theme, toggleTheme } = useTheme();
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
      toast.success('Module Mastered! 🎉');
      
      const next = currentSection + 1;
      if (next < course.sections.length) {
        setTimeout(() => setCurrentSection(next), 1000);
      }
    } catch { toast.error('Failed to update progress'); }
  };

  const submitQuiz = async () => {
    const section = course.sections[currentSection];
    const quizzes = section.quizzes || [];
    const score = quizzes.reduce((s, q) => s + (quizAnswers[q.id] === q.correct_answer ? 1 : 0), 0);
    const pct = quizzes.length > 0 ? Math.round((score / quizzes.length) * 100) : 100;
    
    try {
      await forgeApi.completeSection(section.id, { enrollment_id: course.enrollment?.id || 0, quiz_score: pct });
      setProgress(p => ({ ...p, [section.id]: { completed: true, quiz_score: pct } }));
      setQuizSubmitted(true);
      if (pct >= (section.pass_score || 60)) {
        toast.success(`Skill Verified! Score: ${pct}%`);
      } else {
        toast.error(`Verification Failed. Score: ${pct}%. Minimum is ${section.pass_score || 60}%`);
      }
    } catch {
      toast.error('Failed to submit quiz');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 20 }}>
      <div className="spinner spinner-lg" />
      <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Assembling your learning environment...</p>
    </div>
  );
  if (!course) return null;

  const sections = course.sections || [];
  const section = sections[currentSection];
  const sectionDone = progress[section?.id]?.completed;
  const progressPct = course.enrollment?.progress_percent || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--forge-bg)', overflow: 'hidden' }} className="forge-grain">
      
      {/* Premium Obsidian Workspace Header */}
      <div className="player-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <button 
            className="btn btn-ghost" 
            style={{ color: 'var(--forge-text-dim)', padding: '6px', borderRadius: '8px', background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)' }} 
            onClick={() => nav(course.enrollment ? '/forge' : '/forge/library')}
          >
            <ChevronLeft size={18} />
          </button>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <h1 className="player-title">{course.title}</h1>
              <span style={{ fontSize: '0.6rem', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'rgba(124, 58, 237, 0.15)', color: 'var(--forge-accent)', border: '1px solid rgba(124, 58, 237, 0.2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {course.difficulty}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: '0.7rem', color: 'var(--forge-text-dim)', fontWeight: 600 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Section {currentSection + 1} of {sections.length}</span>
              <span>•</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={11} /> {course.estimated_hours}h path</span>
            </div>
          </div>
        </div>

        {course.enrollment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--forge-text-dim)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>Your Progress</div>
              <div style={{ fontSize: '1rem', fontWeight: 900, color: progressPct === 100 ? '#10B981' : 'var(--forge-text-main)' }}>
                {Math.round(progressPct)}%
              </div>
            </div>
            <div style={{ position: 'relative', width: 40, height: 40 }}>
               <svg width="40" height="40" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="20" fill="transparent" stroke="var(--forge-border)" strokeWidth="3" />
                  <circle cx="22" cy="22" r="20" fill="transparent" stroke={progressPct === 100 ? '#10B981' : 'var(--forge-accent)'} strokeWidth="3" 
                    strokeDasharray={126} strokeDashoffset={126 - (progressPct / 100) * 126} 
                    strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)', transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} 
                  />
               </svg>
            </div>
            {progressPct === 100 && (
              <button className="btn btn-sm" onClick={() => nav('/forge/transcript')} style={{ borderRadius: '10px', background: 'var(--forge-accent)', border: 'none', color: 'white', fontWeight: 800, padding: '0 16px', height: 40 }}>
                CERTIFICATE
              </button>
            )}

            <button 
              className="btn btn-ghost" 
              onClick={toggleTheme} 
              style={{ width: 40, height: 40, padding: 0, borderRadius: '50%', color: 'var(--forge-text-dim)', background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)' }}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Navigation Sidebar - Knowledge Tree */}
        <div className="toc-sidebar" style={{ width: 340, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div className="toc-header">Lessons</div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {sections.map((s, i) => {
              const isDone = progress[s.id]?.completed;
              const isActive = i === currentSection;
              const isLocked = course.enrollment && i > 0 && !progress[sections[i-1].id]?.completed;
              
              return (
                <div 
                  key={s.id} 
                  className={`toc-item ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
                  onClick={() => { 
                    if (!isLocked) {
                      setCurrentSection(i); setQuizAnswers({}); setQuizSubmitted(false);
                    } else {
                      toast.error('Please complete the previous lessons first');
                    }
                  }}
                >
                  <div className="toc-status-icon">
                    {isDone ? <CheckCircle size={14} /> : isLocked ? <Lock size={12} /> : <span>{i + 1}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--forge-accent)' : 'var(--forge-text-main)', opacity: 1 }}>
                      {s.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.65rem', color: 'var(--forge-text-dim)', marginTop: 4, fontWeight: 600 }}>
                       <span style={{ display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase' }}>{CONTENT_ICONS[s.content_type]} {s.content_type}</span>
                       <span>•</span>
                       <span>{s.duration_minutes} MIN</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Content Viewport */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'transparent', padding: '40px' }}>
          
          {!course.enrollment ? (
             <div className="forge-course-card" style={{ maxWidth: 540, margin: '60px auto', textAlign: 'center', padding: 48, borderRadius: 24, background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)' }}>
                <div style={{ width: 64, height: 64, borderRadius: '18px', background: 'var(--forge-bg)', color: 'var(--forge-accent)', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--forge-border)' }}>
                  <Lock size={30} />
                </div>
                <h2 style={{ color: 'var(--forge-text-main)', letterSpacing: '-0.02em' }}>Enrollment Required</h2>
                <p style={{ color: 'var(--forge-text-dim)', marginBottom: 32, lineHeight: 1.6 }}>Join this course to access all lessons, track your progress, and earn certificates.</p>
                <button className="btn btn-shimmer" onClick={enrollAndStart} style={{ width: '100%', borderRadius: 12, height: 50, fontWeight: 800 }}>
                  ACTIVATE PATH
                </button>
             </div>
          ) : (
            <div className="animate-fade-in" style={{ maxWidth: 900, margin: '0 auto' }}>
              
              <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                   <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--forge-accent)', letterSpacing: '0.1em', marginBottom: 6, textTransform: 'uppercase' }}>LESSON {currentSection + 1}</div>
                   <h2 style={{ fontSize: '2.5rem', margin: 0, letterSpacing: '-0.04em', color: 'var(--forge-text-main)' }}>{section.title}</h2>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                   <button className="btn btn-ghost" style={{ padding: 8, color: 'var(--forge-text-dim)' }} title="Toggle Cinema Mode"><Maximize2 size={18} /></button>
                </div>
              </div>

              {/* Main Content Render */}
              <div className="cinema-frame" style={{ marginBottom: 48, background: section.content_type === 'video' ? '#000' : 'var(--forge-preview-bg)' }}>
                {section.content_type === 'video' ? (
                  <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
                    <iframe 
                      src={resolveVideoUrl(section.content_url)}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} 
                      allowFullScreen 
                    />
                  </div>
                ) : section.content_type === 'article' ? (
                  <div className="markdown-body" style={{ background: 'transparent', padding: '60px 80px', minHeight: 400 }}>
                    <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                      {section.content_markdown || '# Loading Lesson Data\nWe are getting the content ready for you. Please stand by.'}
                    </ReactMarkdown>
                  </div>
                ) : section.content_type === 'pdf' ? (
                  <div style={{ background: '#000', height: 700 }}>
                    <iframe 
                      src={resolveAssetUrl(section.content_url)}
                      style={{ width: '100%', height: '100%', border: 'none' }} 
                    />
                  </div>
                ) : section.content_type === 'lab' ? (
                  section.content_url ? (
                    <div style={{ background: '#000', height: 700 }}>
                      <iframe
                        src={resolveAssetUrl(section.content_url)}
                        title={section.title}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <div style={{ padding: 80, textAlign: 'center', background: 'rgba(0,0,0,0.3)' }}>
                       <Sparkles size={48} color="var(--forge-accent)" style={{ marginBottom: 24, opacity: 0.5 }} />
                       <h3 style={{ color: 'var(--forge-text-main)', marginBottom: 16 }}>Sandboxed Environment</h3>
                       <p style={{ color: 'var(--forge-text-dim)', maxWidth: 400, margin: '0 auto 32px' }}>Execute code and test architectures in an isolated, high-performance workspace.</p>
                       <button className="btn btn-primary" style={{ height: 48, padding: '0 32px', borderRadius: 12, background: 'var(--forge-accent)', border: 'none', fontWeight: 800 }}>LAUNCH INSTANCE</button>
                    </div>
                  )
                ) : section.content_type === 'quiz' ? (
                  <div style={{ background: 'transparent', padding: '60px 80px' }}>
                    <div style={{ marginBottom: 48, borderBottom: '1px solid var(--forge-border)', paddingBottom: 32 }}>
                       <h3 style={{ color: 'var(--forge-text-main)', marginBottom: 12, letterSpacing: '-0.02em' }}>Proficiency Verification</h3>
                       <p style={{ color: 'var(--forge-text-dim)', margin: 0, fontSize: '0.95rem' }}>Threshold: <strong style={{ color: 'var(--forge-text-main)' }}>{section.pass_score || 60}%</strong>. Select the most valid conclusions.</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 48 }}>
                      {(section.quizzes || []).map((q, qi) => (
                        <div key={q.id}>
                          <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 24, display: 'flex', gap: 16, color: 'var(--forge-text-main)', lineHeight: 1.4 }}>
                            <span style={{ color: 'var(--forge-accent)', opacity: 0.5 }}>{qi + 1}.</span>
                            {q.question_text}
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {q.options.map((opt, oi) => {
                              const isSelected = quizAnswers[q.id] === opt;
                              const isCorrect = quizSubmitted && opt === q.correct_answer;
                              const isWrongSelection = quizSubmitted && isSelected && opt !== q.correct_answer;
                              
                              return (
                                <div 
                                  key={oi} 
                                  className={`quiz-choice ${isSelected ? 'selected' : ''} ${isCorrect ? 'correct' : ''} ${isWrongSelection ? 'incorrect' : ''} ${quizSubmitted ? 'submitted' : ''}`}
                                  onClick={() => !quizSubmitted && setQuizAnswers(a => ({ ...a, [q.id]: opt }))}
                                  style={{ padding: '22px 28px' }}
                                >
                                  <div className="quiz-radio">
                                    <div className="quiz-radio-inner" />
                                  </div>
                                  <span style={{ fontWeight: 600, color: isSelected ? 'var(--forge-text-main)' : 'var(--forge-text-main)' }}>{opt}</span>
                                  {isCorrect && <CheckCircle size={18} color="#10B981" style={{ marginLeft: 'auto' }} />}
                                  {isWrongSelection && <X size={18} color="#EF4444" style={{ marginLeft: 'auto' }} />}
                                </div>
                              );
                            })}
                          </div>
                          
                          {quizSubmitted && q.explanation && (
                            <div style={{ marginTop: 20, padding: '20px 24px', background: 'var(--forge-card-bg)', borderRadius: 16, borderLeft: '2px solid var(--forge-accent)', fontSize: '0.9rem', color: 'var(--forge-text-dim)', lineHeight: 1.6 }}>
                               <strong style={{ color: 'var(--forge-accent)', display: 'block', marginBottom: 6, fontSize: '0.7rem', letterSpacing: '0.1em' }}>RATIONALE</strong>
                               {q.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 60, display: 'flex', justifyContent: 'flex-end', gap: 16 }}>
                      {!quizSubmitted ? (
                        <button 
                          className="btn btn-primary" 
                          style={{ borderRadius: 12, padding: '0 40px', height: 52, background: 'var(--forge-accent)', border: 'none', fontWeight: 800 }}
                          onClick={submitQuiz}
                          disabled={Object.keys(quizAnswers).length < (section.quizzes?.length || 0)}
                        >
                          SUBMIT VERIFICATION
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-ghost" onClick={() => { setQuizSubmitted(false); setQuizAnswers({}); }} style={{ color: 'var(--forge-text-main)', background: 'var(--forge-card-bg)', borderRadius: 12 }}><RefreshCw size={16} /> RE-ATTEMPT</button>
                          {progress[section.id]?.quiz_score >= (section.pass_score || 60) && currentSection < sections.length - 1 && (
                            <button className="btn btn-primary" onClick={() => setCurrentSection(currentSection + 1)} style={{ background: 'var(--forge-accent)', border: 'none', borderRadius: 12, height: 52, padding: '0 32px', fontWeight: 800 }}>NEXT LESSON <ChevronRight size={16} /></button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 100, background: 'transparent', textAlign: 'center' }}>
                     <FileText size={48} color="var(--forge-text-dim)" style={{ marginBottom: 20 }} />
                     <p style={{ color: 'var(--forge-text-dim)' }}>Loading lesson content.</p>
                  </div>
                )}
              </div>

              {/* Lesson Action Footer */}
              {section.content_type !== 'quiz' && (
                <div style={{ 
                  background: 'var(--forge-card-bg)', padding: '32px 48px', borderRadius: 24, 
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: '1px solid var(--forge-border)', backdropFilter: 'blur(20px)'
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: 'var(--forge-text-main)', letterSpacing: '-0.01em' }}>Module Execution Complete?</h4>
                    <p style={{ margin: 0, color: 'var(--forge-text-dim)', fontSize: '0.9rem' }}>Finish this lesson to move to the next one.</p>
                  </div>
                  {!sectionDone ? (
                    <button className="btn btn-primary" onClick={() => markComplete(section.id)} style={{ borderRadius: 12, padding: '0 32px', height: 52, background: 'var(--forge-text-main)', color: 'var(--forge-bg)', border: 'none', fontWeight: 800 }}>
                      DONE
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                       <div className="player-title" style={{ color: '#10B981' }}>MASTERED</div>
                       {currentSection < sections.length - 1 && (
                         <button className="btn btn-primary" onClick={() => setCurrentSection(currentSection + 1)} style={{ borderRadius: 12, height: 52, padding: '0 32px', background: 'var(--forge-accent)', border: 'none', fontWeight: 800 }}>NEXT LESSON <ChevronRight size={16} /></button>
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
