import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { 
  PlusCircle, Trash2, ArrowRight, ArrowLeft, Image as ImageIcon, 
  Video, FileText, HelpCircle, CheckCircle, Save, Send, Eye,
  BookOpen, AlignLeft, Clock, BarChart, Settings, Upload, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import TopHeader from '../../components/TopHeader';
import './forge_styles.css';

const blankSection = () => ({ 
  title: '', 
  order_index: 0, 
  content_type: 'video', 
  content_url: '', 
  content_markdown: '',
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
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploadingSection, setUploadingSection] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');
  const canPublishDirectly = ['org_admin', 'super_admin'].includes(user?.role);

  // Step 1: Metadata
  const [title, setTitle] = useState(''); 
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState('Engineering');
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

  const handleBulkZipUpload = async (file) => {
    if (!file) return;
    setLoading(true);
    setBulkProgress('Reading SCORM manifests and arranging lessons...');
    try {
      const res = await forgeApi.bulkUploadZip(file);
      const summary = res?.data?.data?.import_summary;
      const count = res?.data?.data?.sections_created;
      const mode = summary?.mode === 'scorm_manifest' ? 'SCORM package' : 'learning materials';
      toast.success(`Successfully imported ${count || 'all'} lessons from ${mode}.`);
      nav('/forge/my-courses');
    } catch (err) {
      console.error('Bulk upload error:', err);
      const detail = err?.response?.data?.detail || err?.message || 'Bulk upload failed';
      toast.error(detail, { duration: 5000 });
    } finally {
      setLoading(false);
      setBulkProgress('');
      setIsBulkMode(false);
    }
  };

  const save = async (action = 'draft') => {
    if (!title.trim()) { toast.error('Please enter a course title'); setStep(1); return; }
    
    // Validation
    if (sections.length === 0) { toast.error('Please add at least one lesson'); setStep(2); return; }
    for (const sec of sections) {
      if (!sec.title.trim()) { toast.error('All lessons must have a title'); setStep(2); return; }
      if (sec.content_type === 'quiz' && sec.quizzes.length === 0) {
        toast.error(`Lesson "${sec.title}" needs questions for the quiz`); setStep(3); return;
      }
    }

    setLoading(true);
    try {
      const payload = { 
        title, 
        description: desc, 
        category,
        difficulty, 
        estimated_hours: hours, 
        sections: sections.map(s => ({
          ...s,
          // Ensure correct mapping for backend
          content_type: s.content_type,
          content_url: s.content_type === 'article' ? null : s.content_url,
          content_markdown: s.content_type === 'article' ? s.content_markdown : null,
          quizzes: s.quizzes?.map(q => ({
            question_text: q.question,
            options: q.options,
            correct_answer: q.options[q.correct_index] || '',
            explanation: q.explanation,
            marks: 1.0
          }))
        }))
      };
      const res = await forgeApi.createCourse(payload);
      const courseId = res.data.data.id;

      if (action === 'publish' && canPublishDirectly) {
        await forgeApi.publishCourse(courseId);
        toast.success('Course published!');
        nav('/forge/my-courses');
      } else if (action === 'review' || (action === 'publish' && !canPublishDirectly)) {
        await forgeApi.submitForReview(courseId);
        toast.success('Course submitted for review!');
        nav('/forge/my-courses');
      } else {
        toast.success('Draft saved.');
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
    { id: 1, name: 'Basic Info', icon: <BookOpen size={16} /> },
    { id: 2, name: 'Curriculum', icon: <AlignLeft size={16} /> },
    { id: 3, name: 'Review', icon: <CheckCircle size={16} /> }
  ];

  const categories = ['Engineering', 'Architecture', 'Design', 'Strategy', 'Product', 'Data', 'Leadership'];

  return (
    <div className="forge-grain" style={{ minHeight: '100vh', padding: '0 40px 80px', background: 'var(--forge-bg)', color: 'var(--forge-text-main)' }}>
      <TopHeader />
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: 40, marginBottom: 60 }}>
        <div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 16, padding: '4px 0', color: 'var(--forge-text-dim)', fontSize: '0.75rem', fontWeight: 800 }} onClick={() => nav('/forge/my-courses')}>
            <ArrowLeft size={14} /> COURSES
          </button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--forge-text-main)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--forge-accent)' }}>
              <Zap size={22} />
            </div>
            Studio
          </h1>
          <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--forge-text-dim)' }}>Create refined learning courses or import materials in bulk.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <label className="btn btn-ghost" style={{ background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', borderRadius: 12, height: 50, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 800, color: 'var(--forge-text-main)' }}>
            {loading ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Upload size={18} />} 
            SCORM / ZIP IMPORT
            <input type="file" accept=".zip" style={{ display: 'none' }} onChange={e => handleBulkZipUpload(e.target.files[0])} disabled={loading} />
          </label>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Wizard Progress Bar */}
        <div style={{ display: 'flex', marginBottom: 48, background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', borderRadius: '20px', padding: 8 }}>
          {steps.map((s, i) => {
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            // Skip assessment step if no quizzes are added
            if (s.id === 3 && !hasQuizzes && step !== 3) return null;
            
            return (
              <div key={s.id} 
                style={{ 
                  flex: 1, textAlign: 'center', padding: '14px 16px', borderRadius: '14px', 
                  fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: isActive ? 'var(--forge-accent)' : 'transparent', 
                  color: isActive ? 'white' : isCompleted ? 'var(--forge-accent)' : 'var(--forge-text-dim)', 
                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', cursor: isCompleted ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                }}
                onClick={() => isCompleted && setStep(s.id)}
              >
                {isCompleted ? <CheckCircle size={15} /> : s.icon}
                <span>{s.name}</span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Conceptualize */}
        {step === 1 && (
          <div className="animate-fade-in">
            <div className="forge-course-card" style={{ background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', padding: 40 }}>
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ color: 'var(--forge-text-main)', margin: 0, fontSize: '1.25rem' }}>Course Details</h3>
                <p style={{ color: 'var(--forge-text-dim)', fontSize: '0.9rem', margin: '4px 0 0' }}>Tell us about the course you're creating.</p>
              </div>

              <div className="form-group" style={{ marginBottom: 32 }}>
                <label className="forge-card-category" style={{ fontSize: '0.65rem', display: 'block' }}>COURSE TITLE *</label>
                <input 
                  className="form-control" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  placeholder="e.g., Designing Real-time Collaborative Systems at Scale" 
                  autoFocus 
                  style={{ background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', height: 56, fontSize: '1.1rem', borderRadius: 12 }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 32 }}>
                <label className="forge-card-category" style={{ fontSize: '0.65rem', display: 'block' }}>SUMMARY</label>
                <textarea 
                  className="form-control" 
                  rows={4} 
                  value={desc} 
                  onChange={e => setDesc(e.target.value)} 
                  placeholder="Synthesize the primary objectives and learning outcomes..." 
                  style={{ background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', borderRadius: 12, padding: 20, resize: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, marginBottom: 8 }}>
                <div className="form-group">
                  <label className="forge-card-category" style={{ fontSize: '0.65rem', display: 'block' }}>DOMAIN</label>
                  <select 
                    className="form-control" 
                    value={category} 
                    onChange={e => setCategory(e.target.value)}
                    style={{ background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', height: 50, borderRadius: 12 }}
                  >
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="forge-card-category" style={{ fontSize: '0.65rem', display: 'block' }}>COMPLEXITY</label>
                  <select 
                    className="form-control" 
                    value={difficulty} 
                    onChange={e => setDifficulty(e.target.value)}
                    style={{ background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', height: 50, borderRadius: 12 }}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="forge-card-category" style={{ fontSize: '0.65rem', display: 'block' }}>TIME NEEDED (HOURS)</label>
                  <div style={{ position: 'relative' }}>
                    <Clock size={14} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--forge-text-dim)' }} />
                    <input 
                      type="number" 
                      className="form-control" 
                      value={hours} 
                      min={0.5} 
                      step={0.5} 
                      onChange={e => setHours(parseFloat(e.target.value))} 
                      style={{ paddingLeft: 44, background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', height: 50, borderRadius: 12 }} 
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 40, borderTop: '1px solid var(--forge-border)', paddingTop: 40 }}>
                <button className="btn btn-primary" onClick={() => { if(!title) toast.error('Title is required'); else setStep(2); }} style={{ height: 54, padding: '0 40px', borderRadius: 14, background: 'var(--forge-accent)', border: 'none', fontWeight: 800 }}>
                  GO TO LESSON PLAN <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Design Studio (Unified Curriculum & Content) */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--forge-text-main)', letterSpacing: '-0.02em', fontSize: '1.8rem' }}>Course Structure</h3>
                <p style={{ color: 'var(--forge-text-dim)', fontSize: '0.95rem', margin: '6px 0 0' }}>Design your lessons and assessment modules in one focus area.</p>
              </div>
              <button className="btn btn-ghost" onClick={addSection} style={{ background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', borderRadius: 12, height: 44, padding: '0 24px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: 'var(--forge-text-main)' }}>
                <PlusCircle size={16} /> ADD LESSON
              </button>
            </div>
            
            {sections.length === 0 && (
              <div style={{ textAlign: 'center', padding: '100px 40px', background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', borderRadius: 32, borderStyle: 'dotted' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: 20, opacity: 0.5 }}>🏗️</div>
                <p style={{ color: 'var(--forge-text-dim)', fontSize: '1.1rem', fontWeight: 600 }}>Your curriculum is empty. Start by adding your first lesson.</p>
                <button className="btn btn-primary" onClick={addSection} style={{ marginTop: 24, background: 'var(--forge-accent)', border: 'none', borderRadius: 12, padding: '14px 32px' }}>
                  <PlusCircle size={16} /> ADD FIRST LESSON
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {sections.map((s, i) => {
                const isExpanded = expandedIndex === i;
                return (
                  <div key={i} className={`forge-course-card ${isExpanded ? 'expanded' : ''}`} style={{ 
                    background: 'var(--forge-card-bg)', 
                    border: isExpanded ? '2px solid var(--forge-accent)' : '1px solid var(--forge-border)', 
                    borderRadius: 24,
                    padding: isExpanded ? 40 : 24,
                    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: isExpanded ? '0 20px 60px rgba(0,0,0,0.15)' : 'none'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--forge-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: 'var(--forge-accent)', border: '1px solid var(--forge-border)' }}>
                          {i + 1}
                        </div>
                        {isExpanded ? (
                          <div className="form-group" style={{ flex: 1, margin: 0 }}>
                            <input 
                              className="form-control" 
                              value={s.title} 
                              onChange={e => updateSection(i, 'title', e.target.value)} 
                              placeholder="Lesson Title..." 
                              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--forge-border)', borderRadius: 0, fontSize: '1.4rem', fontWeight: 800, color: 'var(--forge-text-main)', padding: '4px 0' }} 
                            />
                          </div>
                        ) : (
                          <div style={{ flex: 1 }}>
                            <h4 style={{ margin: 0, color: 'var(--forge-text-main)', fontSize: '1.15rem', fontWeight: 700 }}>{s.title || 'Untitled Lesson'}</h4>
                            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--forge-accent)', letterSpacing: '0.05em' }}>{s.content_type.toUpperCase()}</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--forge-text-dim)' }}>{s.duration_minutes} MINS</span>
                            </div>
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button className="btn btn-ghost" style={{ padding: 8, height: 'auto', minWidth: 0, color: 'var(--forge-text-dim)' }} disabled={i===0} onClick={() => moveSection(i, -1)}>▲</button>
                        <button className="btn btn-ghost" style={{ padding: 8, height: 'auto', minWidth: 0, color: 'var(--forge-text-dim)' }} disabled={i===sections.length-1} onClick={() => moveSection(i, 1)}>▼</button>
                        <button 
                          className={`btn ${isExpanded ? 'btn-primary' : 'btn-ghost'}`} 
                          onClick={() => setExpandedIndex(isExpanded ? -1 : i)}
                          style={{ borderRadius: 12, padding: '8px 24px', fontSize: '0.75rem', fontWeight: 800, background: isExpanded ? 'var(--forge-accent)' : 'var(--forge-card-bg)', border: isExpanded ? 'none' : '1px solid var(--forge-border)', color: isExpanded ? '#FFF' : 'var(--forge-text-main)' }}
                        >
                          {isExpanded ? 'CONFIRM' : 'OPEN EDITOR'}
                        </button>
                        <button className="btn btn-ghost" style={{ color: '#EF4444', padding: 8, height: 'auto', minWidth: 0 }} onClick={() => removeSection(i)}><Trash2 size={18} /></button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="animate-fade-in" style={{ marginTop: 40, paddingTop: 40, borderTop: '1px solid var(--forge-border)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 32 }}>
                          <div className="form-group">
                            <label className="forge-card-category" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--forge-text-dim)' }}>TYPE OF CONTENT</label>
                            <select className="form-control" value={s.content_type} onChange={e => updateSection(i, 'content_type', e.target.value)} style={{ background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', borderRadius: 12, height: 50 }}>
                              <option value="video">Cinema / Video Courseware</option>
                              <option value="article">Technical Article / Documentation</option>
                              <option value="quiz">Verification Quiz / Assessment</option>
                              <option value="pdf">Manual / PDF Document</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="forge-card-category" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--forge-text-dim)' }}>ESTIMATED TIME (MINS)</label>
                            <input type="number" className="form-control" value={s.duration_minutes} onChange={e => updateSection(i, 'duration_minutes', parseInt(e.target.value))} style={{ background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', borderRadius: 12, height: 50 }} />
                          </div>
                        </div>

                        {s.content_type === 'video' && (
                          <div className="form-group">
                            <label className="forge-card-category" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--forge-text-dim)' }}>VIDEO ASSET LOCATION</label>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <input className="form-control" value={s.content_url} onChange={e => updateSection(i, 'content_url', e.target.value)} placeholder="https://..." style={{ flex: 1, background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', borderRadius: 12, height: 50 }} />
                              <div style={{ position: 'relative' }}>
                                <button className="btn btn-ghost" style={{ background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', borderRadius: 12, height: 50, padding: '0 24px', fontWeight: 800 }}>
                                  {uploadingSection === i ? 'UPLOADING...' : 'UPLOAD RAW'}
                                </button>
                                <input type="file" accept="video/*" style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} onChange={(e) => handleFileUpload(i, e.target.files[0])} disabled={uploadingSection === i} />
                              </div>
                            </div>
                          </div>
                        )}

                        {s.content_type === 'article' && (
                          <div className="form-group">
                            <label className="forge-card-category" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--forge-text-dim)', marginBottom: 12, display: 'block' }}>ARTICLE CONTENT (MARKDOWN)</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 1, background: 'var(--forge-border)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--forge-border)' }}>
                              <textarea 
                                className="form-control" 
                                rows={14} 
                                value={s.content_markdown} 
                                onChange={e => updateSection(i, 'content_markdown', e.target.value)} 
                                placeholder="# Introduction\nWrite the technical content for this lesson using markdown syntax..."
                                style={{ border: 'none', borderRadius: 0, resize: 'none', background: 'var(--forge-bg)', color: 'var(--forge-text-main)', fontSize: '0.9rem', fontFamily: 'monospace', padding: 24 }}
                              />
                              <div style={{ padding: 24, background: 'rgba(0,0,0,0.02)', overflowY: 'auto', maxHeight: 400 }} className="markdown-body">
                                <ReactMarkdown>{s.content_markdown || '*Neural preview awaiting data...*'}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        )}

                        {s.content_type === 'quiz' && (
                          <div className="animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                              <label className="forge-card-category" style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--forge-text-dim)' }}>MCQ REPOSITORY ({s.quizzes.length})</label>
                              <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>MINIMUM SCORE:</span>
                                <input type="number" value={s.pass_score} onChange={e => updateSection(i, 'pass_score', parseInt(e.target.value))} style={{ width: 60, height: 32, background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', textAlign: 'center', borderRadius: 8, fontWeight: 900 }} />
                                <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>%</span>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                              {s.quizzes.map((q, qi) => (
                                <div key={qi} style={{ background: 'var(--forge-bg)', border: '1px solid var(--forge-border)', borderRadius: 20, padding: 32 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--forge-accent)', background: 'rgba(124, 58, 237, 0.1)', padding: '4px 12px', borderRadius: 8 }}>QUESTION {qi + 1}</span>
                                    <button className="btn btn-ghost" style={{ padding: 0, height: 'auto', color: '#EF4444' }} onClick={() => removeQuiz(i, qi)}><Trash2 size={16} /></button>
                                  </div>
                                  <textarea className="form-control" value={q.question} onChange={e => updateQuiz(i, qi, 'question', e.target.value)} placeholder="Formulate the verification query..." style={{ background: 'transparent', border: 'none', borderBottom: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', borderRadius: 0, marginBottom: 24, fontSize: '1.1rem', fontWeight: 700, padding: '0 0 12px 0' }} />
                                  
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    {q.options.map((opt, oi) => (
                                      <div key={oi} style={{ display: 'flex', gap: 12, alignItems: 'center', background: 'var(--forge-card-bg)', padding: '4px 16px', borderRadius: 12, border: q.correct_index === oi ? '2px solid #10B981' : '1px solid var(--forge-border)' }}>
                                        <input 
                                          type="radio" 
                                          name={`q-${i}-${qi}`} 
                                          checked={q.correct_index === oi} 
                                          onChange={() => updateQuiz(i, qi, 'correct_index', oi)} 
                                          style={{ accentColor: '#10B981', width: 18, height: 18 }} 
                                        />
                                        <input className="form-control" value={opt} onChange={e => updateQuizOption(i, qi, oi, e.target.value)} placeholder={`Potential Conclusion ${oi + 1}`} style={{ background: 'transparent', border: 'none', color: 'var(--forge-text-main)', borderRadius: 0, fontSize: '0.9rem' }} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <button className="btn btn-ghost" onClick={() => addQuiz(i)} style={{ background: 'var(--forge-card-bg)', border: '1px dashed var(--forge-border)', borderRadius: 16, padding: '24px', fontWeight: 800, color: 'var(--forge-text-main)' }}>
                                <PlusCircle size={14} /> APPEND NEW VERIFICATION QUERY
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 80, paddingTop: 40, borderTop: '1px solid var(--forge-border)' }}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} style={{ color: 'var(--forge-text-dim)', fontWeight: 800 }}><ArrowLeft size={18} /> BACK TO IDENTITY</button>
              <button className="btn btn-primary" onClick={() => setStep(3)} style={{ background: 'var(--forge-text-main)', color: 'var(--forge-bg)', border: 'none', borderRadius: 14, padding: '0 48px', height: 56, fontWeight: 900 }}>
                REVIEW FOR PUBLISHING <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Publish (Final) */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ margin: 0, color: 'var(--forge-text-main)', letterSpacing: '-0.02em', fontSize: '1.8rem' }}>Final Review</h3>
              <p style={{ color: 'var(--forge-text-dim)', fontSize: '0.95rem', margin: '4px 0 0' }}>Confirm the architecture before committing to the neural engine.</p>
            </div>
            
            <div className="forge-course-card" style={{ background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', padding: 40, marginBottom: 40, borderRadius: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--forge-border)', paddingBottom: 32, marginBottom: 32 }}>
                <div>
                  <div className="forge-card-category" style={{ fontSize: '0.7rem', marginBottom: 12 }}>METADATA PROFILE</div>
                  <h2 style={{ fontSize: '2.5rem', color: 'var(--forge-text-main)', margin: 0, letterSpacing: '-0.03em', fontWeight: 900 }}>{title || 'Untitled Course'}</h2>
                  <p style={{ color: 'var(--forge-text-dim)', fontSize: '1.1rem', marginTop: 12, maxWidth: 600, lineHeight: 1.6 }}>{desc || 'Zero context provided.'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                   <div style={{ fontSize: '0.65rem', fontWeight: 900, color: 'var(--forge-accent)', background: 'rgba(124, 58, 237, 0.1)', padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(124, 58, 237, 0.2)', display: 'inline-block', marginBottom: 16 }}>{difficulty.toUpperCase()}</div>
                   <div style={{ color: 'var(--forge-text-main)', fontWeight: 800, fontSize: '1.1rem', display: 'block' }}>{category.toUpperCase()}</div>
                   <div style={{ color: 'var(--forge-text-dim)', fontSize: '0.8rem', marginTop: 6, fontWeight: 700 }}>{hours}H DURATION</div>
                </div>
              </div>
              
              <h5 style={{ color: 'var(--forge-text-main)', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 24 }}>Curriculum Manifest ({sections.length} Lessons)</h5>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sections.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '18px 24px', background: 'rgba(0,0,0,0.02)', border: '1px solid var(--forge-border)', borderRadius: 16 }}>
                    <span style={{ color: 'var(--forge-accent)', fontWeight: 900, fontSize: '1rem' }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 800, color: 'var(--forge-text-main)', fontSize: '1rem' }}>{s.title || 'Untitled Lesson'}</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--forge-text-dim)', fontWeight: 900, textTransform: 'uppercase', marginTop: 2 }}>{s.content_type} • {s.duration_minutes}M</div>
                    </div>
                    {s.content_type === 'quiz' && <div style={{ color: '#10B981', fontSize: '0.75rem', fontWeight: 900, background: 'rgba(16, 185, 129, 0.1)', padding: '4px 12px', borderRadius: 20 }}>{s.quizzes.length} QUESTIONS</div>}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setStep(2)} style={{ color: 'var(--forge-text-dim)', fontWeight: 800 }}><ArrowLeft size={16} /> BACK TO STUDIO</button>
              <div style={{ display: 'flex', gap: 16 }}>
                <button className="btn btn-ghost" onClick={() => save('draft')} disabled={loading} style={{ background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', borderRadius: 12, padding: '0 32px', height: 56, fontWeight: 800 }}>
                  SAVE DRAFT
                </button>
                <button className="btn btn-primary" onClick={() => save(canPublishDirectly ? 'publish' : 'review')} disabled={loading} style={{ background: 'var(--forge-text-main)', color: 'var(--forge-bg)', border: 'none', borderRadius: 14, padding: '0 40px', height: 56, fontWeight: 900, boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                  {loading ? 'PROCESSING...' : '🚀 DEPLOY TO FORGE'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Upload Processing Overlay */}
        {bulkProgress && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <div className="animate-fade-in" style={{ maxWidth: 400 }}>
              <div className="spinner" style={{ width: 60, height: 60, border: '4px solid rgba(124, 58, 237, 0.2)', borderTopColor: 'var(--forge-accent)', margin: '0 auto 40px' }} />
              <h2 style={{ color: '#FFF', fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 12 }}>Course Import Architect</h2>
              <p style={{ color: 'var(--forge-text-dim)', fontSize: '1.1rem', lineHeight: 1.6 }}>{bulkProgress}</p>
              <div style={{ marginTop: 40 }}>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                  <div className="progress-bar-glow" style={{ height: '100%', width: '60%', background: 'var(--forge-accent)' }} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
