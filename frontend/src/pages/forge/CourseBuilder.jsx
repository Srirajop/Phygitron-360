import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { 
  PlusCircle, Trash2, ArrowRight, ArrowLeft, Image as ImageIcon, 
  Video, FileText, HelpCircle, CheckCircle, Save, Send, Eye,
  BookOpen, AlignLeft, Clock, BarChart, Settings, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

const blankSection = () => ({ 
  title: '', 
  order_index: 0, 
  content_type: 'video', 
  content_url: '', 
  duration_minutes: 30, 
  pass_score: 60, 
  quizzes: [] 
});

const blankQuiz = () => ({
  question: '',
  options: ['', '', '', ''],
  correct_index: 0,
  explanation: ''
});

export default function CourseBuilder() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingSection, setUploadingSection] = useState(null);

  // Step 1: Metadata
  const [title, setTitle] = useState(''); 
  const [desc, setDesc] = useState('');
  const [difficulty, setDifficulty] = useState('beginner'); 
  const [hours, setHours] = useState(4);

  // Step 2 & 3: Curriculum & Quizzes
  const [sections, setSections] = useState([blankSection()]);

  const addSection = () => setSections(s => [...s, { ...blankSection(), order_index: s.length }]);
  const updateSection = (i, k, v) => setSections(s => s.map((sec, si) => si === i ? { ...sec, [k]: v } : sec));
  const removeSection = (i) => setSections(s => s.filter((_, si) => si !== i));
  const moveSection = (i, dir) => {
    if ((i === 0 && dir === -1) || (i === sections.length - 1 && dir === 1)) return;
    const s = [...sections];
    const temp = s[i];
    s[i] = s[i + dir];
    s[i + dir] = temp;
    // Update order_index
    s.forEach((sec, idx) => sec.order_index = idx);
    setSections(s);
  };

  const handleFileUpload = async (i, file) => {
    if (!file) return;
    setUploadingSection(i);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await forgeApi.uploadVideo(formData);
      updateSection(i, 'content_url', res.data.data.url);
      toast.success('Video uploaded successfully!');
    } catch {
      toast.error('Failed to upload video');
    } finally {
      setUploadingSection(null);
    }
  };

  // Quiz Management
  const addQuiz = (secIndex) => {
    setSections(s => s.map((sec, si) => {
      if (si !== secIndex) return sec;
      return { ...sec, quizzes: [...sec.quizzes, blankQuiz()] };
    }));
  };
  const updateQuiz = (secIndex, quizIndex, key, value) => {
    setSections(s => s.map((sec, si) => {
      if (si !== secIndex) return sec;
      const newQuizzes = sec.quizzes.map((q, qi) => qi === quizIndex ? { ...q, [key]: value } : q);
      return { ...sec, quizzes: newQuizzes };
    }));
  };
  const updateQuizOption = (secIndex, quizIndex, optIndex, value) => {
    setSections(s => s.map((sec, si) => {
      if (si !== secIndex) return sec;
      const newQuizzes = sec.quizzes.map((q, qi) => {
        if (qi !== quizIndex) return q;
        const newOpts = [...q.options];
        newOpts[optIndex] = value;
        return { ...q, options: newOpts };
      });
      return { ...sec, quizzes: newQuizzes };
    }));
  };
  const removeQuiz = (secIndex, quizIndex) => {
    setSections(s => s.map((sec, si) => {
      if (si !== secIndex) return sec;
      return { ...sec, quizzes: sec.quizzes.filter((_, qi) => qi !== quizIndex) };
    }));
  };

  const save = async (action = 'draft') => {
    if (!title.trim()) { toast.error('Course title is required'); setStep(1); return; }
    
    // Validation
    if (sections.length === 0) { toast.error('At least one section is required'); setStep(2); return; }
    for (const sec of sections) {
      if (!sec.title.trim()) { toast.error('All sections must have a title'); setStep(2); return; }
      if (sec.content_type === 'quiz' && sec.quizzes.length === 0) {
        toast.error(`Section "${sec.title}" is a quiz but has no questions`); setStep(3); return;
      }
    }

    setLoading(true);
    try {
      const payload = { title, description: desc, difficulty, estimated_hours: hours, sections };
      const res = await forgeApi.createCourse(payload);
      const courseId = res.data.data.id;

      if (action === 'publish') {
        await forgeApi.publishCourse(courseId);
        toast.success('Course published successfully!');
        nav('/forge/my-courses');
      } else if (action === 'review') {
        await forgeApi.submitForReview(courseId);
        toast.success('Course submitted for review!');
        nav('/forge/my-courses');
      } else {
        toast.success('Draft saved successfully!');
        nav('/forge/my-courses');
      }
    } catch (err) { 
      toast.error(err?.response?.data?.detail || 'Failed to save course'); 
    } finally { 
      setLoading(false); 
    }
  };

  const hasQuizzes = sections.some(s => s.content_type === 'quiz');
  const steps = [
    { id: 1, name: 'Basic Details', icon: <BookOpen size={16} /> },
    { id: 2, name: 'Curriculum', icon: <AlignLeft size={16} /> },
    { id: 3, name: 'Assessments', icon: <HelpCircle size={16} /> },
    { id: 4, name: 'Review & Publish', icon: <CheckCircle size={16} /> }
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12, padding: '4px 0' }} onClick={() => nav('/forge/my-courses')}>
            <ArrowLeft size={14} /> Back to My Courses
          </button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <Settings size={20} />
            </div>
            Course Builder
          </h1>
          <p>Create engaging, structured learning experiences in four simple steps</p>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Wizard Progress Bar */}
        <div style={{ display: 'flex', marginBottom: 32, background: 'var(--primary-lightest)', borderRadius: 12, padding: 6 }}>
          {steps.map((s, i) => {
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            // Skip assessment step if no quizzes are added
            if (s.id === 3 && !hasQuizzes && step !== 3) return null;
            
            return (
              <div key={s.id} 
                style={{ 
                  flex: 1, textAlign: 'center', padding: '12px 16px', borderRadius: 8, 
                  fontWeight: isActive ? 700 : 600, fontSize: '0.85rem', 
                  background: isActive ? 'var(--primary)' : 'transparent', 
                  color: isActive ? 'white' : isCompleted ? 'var(--primary)' : 'var(--text-muted)', 
                  transition: 'all 0.3s ease', cursor: isCompleted ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
                onClick={() => isCompleted && setStep(s.id)}
              >
                {isCompleted ? <CheckCircle size={15} /> : s.icon}
                <span style={{ display: 'none' }} className="sm-show">{s.name}</span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Basic Details */}
        {step === 1 && (
          <div className="card animate-fade-in">
            <div className="card-header"><h4><BookOpen size={16} /> Basic Details</h4></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Course Title *</label>
                <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Introduction to Advanced React Patterns" autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={5} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What will students learn in this course?" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Difficulty Level</label>
                  <select className="form-control" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                    <option value="beginner">🌱 Beginner</option>
                    <option value="intermediate">🌿 Intermediate</option>
                    <option value="advanced">🔥 Advanced</option>
                    <option value="expert">⭐ Expert</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Estimated Duration (Hours)</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input type="number" className="form-control" value={hours} min={0.5} step={0.5} onChange={e => setHours(parseFloat(e.target.value))} style={{ paddingLeft: 40 }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-card)' }}>
              <button className="btn btn-primary" onClick={() => { if(!title) toast.error('Title is required'); else setStep(2); }}>
                Next: Curriculum <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Curriculum */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}><AlignLeft size={20} /> Course Curriculum</h3>
              <button className="btn btn-secondary btn-sm" onClick={addSection}><PlusCircle size={14} /> Add Section</button>
            </div>
            
            {sections.length === 0 && (
              <div className="empty-state" style={{ padding: 60 }}>
                <div className="empty-icon">📝</div>
                <p>Start building your course structure.</p>
                <button className="btn btn-primary" onClick={addSection} style={{ marginTop: 16 }}><PlusCircle size={15} /> Add First Section</button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {sections.map((s, i) => (
                <div key={i} className="card" style={{ borderLeft: '4px solid var(--primary)', overflow: 'visible' }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-lightest)', padding: '12px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <button className="btn btn-ghost" style={{ padding: 2, minWidth: 0, height: 'auto', opacity: i === 0 ? 0.3 : 1 }} disabled={i===0} onClick={() => moveSection(i, -1)}>▲</button>
                        <button className="btn btn-ghost" style={{ padding: 2, minWidth: 0, height: 'auto', opacity: i === sections.length-1 ? 0.3 : 1 }} disabled={i===sections.length-1} onClick={() => moveSection(i, 1)}>▼</button>
                      </div>
                      <span className="badge badge-primary">Section {i + 1}</span>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => removeSection(i)}><Trash2 size={13} /> Remove</button>
                  </div>
                  <div className="card-body">
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 16 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Section Title</label>
                        <input className="form-control" value={s.title} onChange={e => updateSection(i, 'title', e.target.value)} placeholder="e.g., Basics of Component State" />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Content Type</label>
                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                            {s.content_type === 'video' ? <Video size={16}/> : s.content_type === 'article' ? <FileText size={16}/> : <HelpCircle size={16}/>}
                          </span>
                          <select className="form-control" value={s.content_type} onChange={e => updateSection(i, 'content_type', e.target.value)} style={{ paddingLeft: 40 }}>
                            <option value="video">Video Lesson</option>
                            <option value="article">Written Article</option>
                            <option value="quiz">Interactive Quiz</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {s.content_type !== 'quiz' && (
                      <div className="form-group">
                        <label className="form-label">Content URL {s.content_type === 'video' ? 'or Video Upload' : '(PDF / Web link)'}</label>
                        {s.content_type === 'video' ? (
                          <div style={{ display: 'flex', gap: 12 }}>
                            <input className="form-control" value={s.content_url} onChange={e => updateSection(i, 'content_url', e.target.value)} placeholder="https://youtube.com/watch?v=..." style={{ flex: 1 }} />
                            <div style={{ position: 'relative' }}>
                              <button className="btn btn-secondary" disabled={uploadingSection === i} type="button">
                                {uploadingSection === i ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : <><Upload size={14} /> Upload</>}
                              </button>
                              <input 
                                type="file" 
                                accept="video/*" 
                                style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                onChange={(e) => handleFileUpload(i, e.target.files[0])}
                                disabled={uploadingSection === i}
                              />
                            </div>
                          </div>
                        ) : (
                          <input className="form-control" value={s.content_url} onChange={e => updateSection(i, 'content_url', e.target.value)} placeholder="https://..." />
                        )}
                      </div>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Duration (minutes)</label>
                        <input type="number" className="form-control" value={s.duration_minutes} onChange={e => updateSection(i, 'duration_minutes', parseInt(e.target.value))} min={1} />
                      </div>
                      {s.content_type === 'quiz' && (
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">Passing Score (%)</label>
                          <input type="number" className="form-control" value={s.pass_score} onChange={e => updateSection(i, 'pass_score', parseInt(e.target.value))} min={0} max={100} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}><ArrowLeft size={15} /> Back</button>
              <button className="btn btn-primary" onClick={() => { if(sections.length===0) toast.error('Add a section'); else setStep(hasQuizzes ? 3 : 4); }}>
                {hasQuizzes ? <>Next: Assessment Setup <ArrowRight size={15} /></> : <>Next: Review <ArrowRight size={15} /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Assessments (Only if quizzes exist) */}
        {step === 3 && hasQuizzes && (
          <div className="animate-fade-in">
            <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}><HelpCircle size={20} /> Assessment Setup</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Add questions to your quiz sections. Only single-choice questions are supported currently.</p>

            {sections.map((sec, si) => {
              if (sec.content_type !== 'quiz') return null;
              return (
                <div key={si} className="card" style={{ marginBottom: 32 }}>
                  <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0 }}>{sec.title || `Quiz Section ${si + 1}`}</h4>
                    <span className="badge badge-info">{sec.quizzes.length} Questions</span>
                  </div>
                  <div className="card-body">
                    {sec.quizzes.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', background: '#F9FAFB', borderRadius: 8 }}>
                        No questions added yet.
                      </div>
                    ) : (
                      sec.quizzes.map((q, qi) => (
                        <div key={qi} style={{ padding: 20, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16, background: '#fff' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                            <strong>Question {qi + 1}</strong>
                            <button className="btn btn-ghost btn-sm" onClick={() => removeQuiz(si, qi)}><Trash2 size={14} color="var(--danger)" /></button>
                          </div>
                          <div className="form-group">
                            <input className="form-control" style={{ fontWeight: 600 }} placeholder="Type your question here..." value={q.question} onChange={e => updateQuiz(si, qi, 'question', e.target.value)} />
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                            {q.options.map((opt, oi) => (
                              <div key={oi} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <input type="radio" style={{ accentColor: 'var(--success)', width: 18, height: 18, cursor: 'pointer' }} checked={q.correct_index === oi} onChange={() => updateQuiz(si, qi, 'correct_index', oi)} />
                                <input className="form-control" placeholder={`Option ${oi + 1}`} value={opt} onChange={e => updateQuizOption(si, qi, oi, e.target.value)} style={{ border: q.correct_index === oi ? '1px solid var(--success)' : '' }} />
                              </div>
                            ))}
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem' }}>Explanation (shown after answering)</label>
                            <input className="form-control form-control-sm" placeholder="Why is this the correct answer?" value={q.explanation} onChange={e => updateQuiz(si, qi, 'explanation', e.target.value)} />
                          </div>
                        </div>
                      ))
                    )}
                    <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => addQuiz(si)}>
                      <PlusCircle size={15} /> Add Question
                    </button>
                  </div>
                </div>
              );
            })}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)}><ArrowLeft size={15} /> Back</button>
              <button className="btn btn-primary" onClick={() => setStep(4)}>Next: Review <ArrowRight size={15} /></button>
            </div>
          </div>
        )}

        {/* Step 4: Review and Publish */}
        {step === 4 && (
          <div className="animate-fade-in">
            <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}><Eye size={20} /> Review Course Details</h3>
            
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><h4>Course Summary</h4></div>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16 }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', marginBottom: 8 }}>{title || 'Untitled Course'}</h2>
                    <p style={{ color: 'var(--text-muted)' }}>{desc || 'No description provided.'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="badge badge-primary" style={{ fontSize: '0.85rem', marginBottom: 8 }}>{difficulty.toUpperCase()}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', justifyContent: 'flex-end', fontWeight: 600 }}>
                      <Clock size={14} /> {hours} Hours Total
                    </div>
                  </div>
                </div>
                
                <h5>Curriculum Setup ({sections.length} Sections)</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {sections.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', background: 'var(--bg)', borderRadius: 8 }}>
                      <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{i + 1}</span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{s.title || 'Untitled Section'}</span>
                      <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>{s.content_type}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.duration_minutes}m</span>
                      {s.content_type === 'quiz' && <span className="badge badge-info">{s.quizzes.length} Qs</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
              <button className="btn btn-ghost" onClick={() => setStep(hasQuizzes ? 3 : 2)}><ArrowLeft size={15} /> Back</button>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" onClick={() => save('draft')} disabled={loading}>
                  <Save size={15} /> Save Draft Only
                </button>
                <button className="btn btn-primary" onClick={() => save('review')} disabled={loading} style={{ background: '#3B82F6' }}>
                  <Send size={15} /> Submit for Review
                </button>
                <button className="btn btn-shimmer" onClick={() => save('publish')} disabled={loading} style={{ fontWeight: 700 }}>
                  {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }}/> : <>🚀 Publish Course Now</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
