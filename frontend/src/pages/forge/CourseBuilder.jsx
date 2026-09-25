import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles, BookOpen, Layers, PlusCircle, Trash2, Save,
  Play, CheckCircle, Clock, ArrowLeft, ArrowRight, ChevronRight,
  FileText, Award, HelpCircle, Edit3, Eye, Download, RefreshCw,
  Zap, AlignLeft, Check, Radio, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import TopHeader from '../../components/TopHeader';
import './forge_styles.css';

const defaultLesson = (idx = 0) => ({
  title: `Lesson ${idx + 1}: Core Principles`,
  duration_minutes: 15,
  content_type: 'article',
  summary_card: 'Key foundational insight summarizing the primary objective of this module.',
  content_markdown: `## Overview\n\nThis lesson introduces critical concepts and methodologies.\n\n### Core Pillars\n- **Principle 1**: Reliability and scalability by design.\n- **Principle 2**: Idempotent operations and resilient workflows.\n\n### Practical Implementation\nBegin by mapping requirements against architectural constraints before deploying.`,
  narration_script: `Welcome to this session. We are going to explore foundational best practices and how to implement them in production.`,
  key_takeaways: ['Understand core primitives', 'Apply defensive architecture', 'Validate output accuracy'],
  quizzes: [
    {
      question_text: 'What is the primary architectural principle emphasized in this lesson?',
      options: ['Reliability and scalability by design', 'Bypassing verification gates', 'Eliminating telemetry logging', 'Ad-hoc script execution'],
      correct_answer: 'Reliability and scalability by design',
      explanation: 'Building for reliability and scalability from day one prevents catastrophic production bottlenecks.',
      marks: 1.0,
    }
  ]
});

export default function CourseBuilder() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const courseIdParam = searchParams.get('id');
  const { user } = useAuth();

  // Mode: 'ai' (AI Generator) | 'studio' (Visual Editor)
  const [mode, setMode] = useState(courseIdParam ? 'studio' : 'ai');
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const [editorSubTab, setEditorSubTab] = useState('cards'); // 'cards' | 'markdown' | 'quiz'

  // Course State
  const [courseId, setCourseId] = useState(courseIdParam ? parseInt(courseIdParam, 10) : null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Engineering');
  const [difficulty, setDifficulty] = useState('beginner');
  const [estimatedHours, setEstimatedHours] = useState(2.0);
  const [domainId, setDomainId] = useState('');
  const [domains, setDomains] = useState([]);
  const [lessons, setLessons] = useState([defaultLesson(0)]);

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiAudience, setAiAudience] = useState('Enterprise Engineering & Operations Staff');
  const [aiTone, setAiTone] = useState('Professional & Practical');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewLessonIdx, setPreviewLessonIdx] = useState(0);
  const [previewQuizAnswer, setPreviewQuizAnswer] = useState({});
  const [previewQuizSubmitted, setPreviewQuizSubmitted] = useState({});

  // Load Domains
  useEffect(() => {
    forgeApi.domains()
      .then(res => setDomains(res.data.data || []))
      .catch(() => {});
  }, []);

  // Load existing course if ID is present
  useEffect(() => {
    if (!courseIdParam) return;
    forgeApi.getCourse(courseIdParam)
      .then(res => {
        const c = res.data.data;
        if (!c) return;
        setCourseId(c.id);
        setTitle(c.title || '');
        setDescription(c.description || '');
        setCategory(c.category || 'General');
        setDifficulty(c.difficulty || 'beginner');
        setEstimatedHours(c.estimated_hours || 2.0);
        setDomainId(c.domain_id || '');
        if (c.sections && c.sections.length > 0) {
          setLessons(c.sections.map((sec, idx) => ({
            id: sec.id,
            title: sec.title || `Lesson ${idx + 1}`,
            duration_minutes: sec.duration_minutes || 15,
            content_type: sec.content_type || 'article',
            summary_card: 'Core lesson fundamentals and key takeaways.',
            content_markdown: sec.content_markdown || '',
            narration_script: '',
            key_takeaways: ['Core concept review', 'Operational checklist'],
            quizzes: (sec.quizzes || []).map(q => ({
              question_text: q.question_text,
              options: q.options || [],
              correct_answer: q.correct_answer,
              explanation: q.explanation || '',
              marks: q.marks || 1.0,
            }))
          })));
        }
      })
      .catch(() => toast.error('Failed to load existing course'));
  }, [courseIdParam]);

  // AI Generation Handler
  const handleGenerateCourse = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please enter a course topic, storyboard, or syllabus description.');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Generating course with AI...');

    try {
      const res = await forgeApi.generateAiCourse({
        prompt: aiPrompt.trim(),
        audience: aiAudience,
        difficulty: difficulty,
        estimated_hours: estimatedHours,
        category: category,
        domain_id: domainId ? parseInt(domainId, 10) : null,
        tone: aiTone,
      });

      const data = res.data.data;
      setTitle(data.title || 'Untitled AI Course');
      setDescription(data.description || '');
      setDifficulty(data.difficulty || difficulty);
      setEstimatedHours(data.estimated_hours || estimatedHours);
      setCategory(data.category || category);

      if (data.lessons && data.lessons.length > 0) {
        setLessons(data.lessons);
        setActiveLessonIdx(0);
      }

      toast.success('Course generated successfully! Now refine it in the Visual Studio.', { id: toastId });
      setMode('studio');
    } catch (err) {
      console.error('Course generation error:', err);
      const detail = err.response?.data?.detail || 'Failed to generate course. Please try again.';
      toast.error(detail, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  // Lesson Management
  const addLesson = () => {
    const nextIdx = lessons.length;
    setLessons([...lessons, defaultLesson(nextIdx)]);
    setActiveLessonIdx(nextIdx);
  };

  const removeLesson = (idx) => {
    if (lessons.length <= 1) {
      toast.error('A course must have at least one lesson.');
      return;
    }
    const filtered = lessons.filter((_, i) => i !== idx);
    setLessons(filtered);
    setActiveLessonIdx(Math.max(0, idx - 1));
  };

  const moveLesson = (idx, dir) => {
    if ((idx === 0 && dir === -1) || (idx === lessons.length - 1 && dir === 1)) return;
    const reordered = [...lessons];
    const target = reordered[idx];
    reordered[idx] = reordered[idx + dir];
    reordered[idx + dir] = target;
    setLessons(reordered);
    setActiveLessonIdx(idx + dir);
  };

  const updateActiveLesson = (field, val) => {
    setLessons(prev => {
      const copy = [...prev];
      copy[activeLessonIdx] = { ...copy[activeLessonIdx], [field]: val };
      return copy;
    });
  };

  // Quiz Management
  const addQuizQuestion = () => {
    const activeLesson = lessons[activeLessonIdx];
    const newQuiz = {
      question_text: 'What is the primary conclusion of this lesson?',
      options: ['Option A (Recommended)', 'Option B', 'Option C', 'Option D'],
      correct_answer: 'Option A (Recommended)',
      explanation: 'Detailed pedagogical explanation of why this answer is correct.',
      marks: 1.0,
    };
    const updatedQuizzes = [...(activeLesson.quizzes || []), newQuiz];
    updateActiveLesson('quizzes', updatedQuizzes);
  };

  const updateQuiz = (qIdx, field, val) => {
    const activeLesson = lessons[activeLessonIdx];
    const quizzes = [...(activeLesson.quizzes || [])];
    quizzes[qIdx] = { ...quizzes[qIdx], [field]: val };
    updateActiveLesson('quizzes', quizzes);
  };

  const updateQuizOption = (qIdx, optIdx, val) => {
    const activeLesson = lessons[activeLessonIdx];
    const quizzes = [...(activeLesson.quizzes || [])];
    const opts = [...quizzes[qIdx].options];
    const oldVal = opts[optIdx];
    opts[optIdx] = val;
    // If the changed option was the correct answer, update correct_answer too
    if (quizzes[qIdx].correct_answer === oldVal) {
      quizzes[qIdx].correct_answer = val;
    }
    quizzes[qIdx].options = opts;
    updateActiveLesson('quizzes', quizzes);
  };

  const removeQuizQuestion = (qIdx) => {
    const activeLesson = lessons[activeLessonIdx];
    const quizzes = (activeLesson.quizzes || []).filter((_, i) => i !== qIdx);
    updateActiveLesson('quizzes', quizzes);
  };

  // Save Course Handler
  const handleSaveCourse = async (publish = true) => {
    if (!title.trim()) {
      toast.error('Please enter a course title.');
      return;
    }
    if (lessons.length === 0) {
      toast.error('Course must have at least one lesson.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(publish ? 'Publishing course to library...' : 'Saving draft...');

    try {
      const payload = {
        id: courseId,
        title: title.trim(),
        description: description.trim(),
        difficulty: difficulty,
        estimated_hours: estimatedHours,
        category: category,
        domain_id: domainId ? parseInt(domainId, 10) : null,
        status: publish ? 'published' : 'draft',
        lessons: lessons.map(l => ({
          title: l.title,
          duration_minutes: l.duration_minutes || 15,
          content_type: l.content_type || 'article',
          summary_card: l.summary_card || '',
          content_markdown: l.content_markdown || '',
          narration_script: l.narration_script || '',
          key_takeaways: l.key_takeaways || [],
          quizzes: l.quizzes || [],
        }))
      };

      const res = await forgeApi.saveAiCourse(payload);
      toast.success(publish ? '🎉 Course published to Course Library!' : 'Draft saved successfully!', { id: toastId });
      nav('/forge/library');
    } catch (err) {
      console.error('Save course error:', err);
      const detail = err.response?.data?.detail || 'Failed to save course.';
      toast.error(detail, { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const activeLesson = lessons[activeLessonIdx] || lessons[0] || defaultLesson(0);

  return (
    <div className="forge-grain" style={{ minHeight: '100vh', padding: '0 40px 80px', background: 'var(--forge-bg)', color: 'var(--forge-text-main)' }}>
      <TopHeader />

      {/* ── Top Header Navigation ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 28, paddingBottom: 24, borderBottom: '1px solid var(--forge-border)', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => nav('/forge/library')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, padding: 0, marginBottom: 8 }}
          >
            <ArrowLeft size={14} /> Back to Course Library
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(124, 58, 237, 0.15)', color: '#A78BFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
                AI Course Studio & Visual Editor
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Generate full interactive enterprise courses automatically with Groq, then refine visually.
              </p>
            </div>
          </div>
        </div>

        {/* Mode Switcher & Global Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', borderRadius: 12, padding: 4 }}>
            <button
              onClick={() => setMode('ai')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: mode === 'ai' ? 'var(--forge-accent)' : 'transparent',
                color: mode === 'ai' ? 'white' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Sparkles size={14} /> 1. AI Architect
            </button>
            <button
              onClick={() => setMode('studio')}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                background: mode === 'studio' ? 'var(--forge-accent)' : 'transparent',
                color: mode === 'studio' ? 'white' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Edit3 size={14} /> 2. Visual Studio
            </button>
          </div>

          <button
            onClick={() => setPreviewModalOpen(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 12, fontWeight: 700, fontSize: '0.82rem' }}
          >
            <Eye size={15} /> Preview As Learner
          </button>

          <button
            onClick={() => handleSaveCourse(true)}
            disabled={isSaving}
            className="btn btn-primary"
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
              borderRadius: 12, fontWeight: 800, fontSize: '0.85rem',
              background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
              boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)'
            }}
          >
            {isSaving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <CheckCircle size={16} />}
            Publish Course
          </button>
        </div>
      </div>

      {/* ── TAB 1: AI Course Architect ────────────────────────────────────── */}
      {mode === 'ai' && (
        <div className="animate-fade-in" style={{ maxWidth: 880, margin: '0 auto' }}>
          <div className="card" style={{ padding: '36px 32px', borderRadius: 20, background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)' }}>
            <div style={{ marginBottom: 24 }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--forge-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Prompt to Interactive Curriculum
              </span>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: 900 }}>
                What would you like to teach your employees?
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Paste a topic, outline, raw notes, or storyboard. Our Groq-powered AI will generate a complete interactive course with structured lessons, takeaways, audio narration scripts, and knowledge checks.
              </p>
            </div>

            {/* Prompt Textarea */}
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, display: 'block', marginBottom: 8 }}>
                Course Topic, Storyboard Notes, or Syllabus *
              </label>
              <textarea
                className="form-control"
                rows={5}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. Enterprise Incident Response & Forensics: Live triaging, threat containment, log analysis with Splunk, post-mortem playbooks. Target: SecOps engineers. Include voiceover narration, key concept cards, and formative quiz checks."
                style={{
                  fontSize: '0.95rem',
                  lineHeight: 1.5,
                  padding: 16,
                  borderRadius: 14,
                  background: '#0B0F19',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'white',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Generation Parameters Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Target Audience
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={aiAudience}
                  onChange={e => setAiAudience(e.target.value)}
                  placeholder="e.g. Software Engineers, HR, Sales"
                  style={{ borderRadius: 10, background: '#0B0F19', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Difficulty Level
                </label>
                <select
                  className="form-control"
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  style={{ borderRadius: 10, background: '#0B0F19', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <option value="beginner">Beginner (Foundational)</option>
                  <option value="intermediate">Intermediate (Practitioner)</option>
                  <option value="advanced">Advanced (Deep Dive)</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Category / Domain
                </label>
                <select
                  className="form-control"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{ borderRadius: 10, background: '#0B0F19', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  <option value="Engineering">Engineering</option>
                  <option value="Product">Product</option>
                  <option value="Design">Design</option>
                  <option value="Cybersecurity">Cybersecurity</option>
                  <option value="Leadership">Leadership</option>
                  <option value="HR & Compliance">HR & Compliance</option>
                  <option value="General">General</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.78rem', fontWeight: 700, display: 'block', marginBottom: 6 }}>
                  Estimated Time (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="40"
                  className="form-control"
                  value={estimatedHours}
                  onChange={e => setEstimatedHours(parseFloat(e.target.value) || 2.0)}
                  style={{ borderRadius: 10, background: '#0B0F19', color: 'white', border: '1px solid rgba(255,255,255,0.12)' }}
                />
              </div>
            </div>

            {/* Quick Inspiration Prompts */}
            <div style={{ marginBottom: 28, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.05em' }}>
                Quick Inspiration Templates (Click to fill)
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: '🛡️ Zero Trust Architecture', prompt: 'Zero Trust Security Architecture: Identity-first security, micro-segmentation, continuous verification, and principle of least privilege in enterprise cloud networks.' },
                  { label: '🤖 GenAI for Developers', prompt: 'Prompt Engineering & LLM Application Development: Retrieval-Augmented Generation (RAG), vector embeddings, token budgets, and preventing hallucinations in production.' },
                  { label: '⚡ Incident Response', prompt: 'Enterprise Incident Response Playbooks: Triage, forensic analysis, stakeholder communication, root cause analysis, and blameless post-mortems.' },
                  { label: '📊 Product Strategy', prompt: 'Data-Driven Product Strategy: North Star metrics, cohort retention analysis, customer journey mapping, and experiment velocity.' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAiPrompt(item.prompt);
                      setCategory(idx === 0 || idx === 2 ? 'Cybersecurity' : idx === 1 ? 'Engineering' : 'Product');
                    }}
                    style={{
                      background: 'rgba(124, 58, 237, 0.1)',
                      border: '1px solid rgba(124, 58, 237, 0.25)',
                      borderRadius: 8,
                      padding: '6px 12px',
                      color: '#C4B5FD',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate Action Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
              <button
                type="button"
                onClick={() => setMode('studio')}
                className="btn btn-ghost"
                style={{ color: 'var(--text-muted)', fontWeight: 700 }}
              >
                Skip & Use Blank Studio Canvas
              </button>
              <button
                type="button"
                onClick={handleGenerateCourse}
                disabled={isGenerating || !aiPrompt.trim()}
                className="btn btn-primary"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '14px 32px',
                  borderRadius: 14, fontWeight: 800, fontSize: '1rem',
                  background: 'linear-gradient(135deg, #7C3AED, #9333EA)',
                  boxShadow: '0 6px 20px rgba(124, 58, 237, 0.4)'
                }}
              >
                {isGenerating ? (
                  <>
                    <div className="spinner" style={{ width: 18, height: 18 }} />
                    Generating Curriculum with Groq...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate Full Course with AI →
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Visual Studio & Course Editor ───────────────────────────── */}
      {mode === 'studio' && (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
          
          {/* Left Column: Lesson Tree & Course Metadata */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Course Title Card */}
            <div className="card" style={{ padding: 18, borderRadius: 16, background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--forge-accent)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
                Course Title
              </label>
              <input
                type="text"
                className="form-control"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Course Title..."
                style={{ fontWeight: 800, fontSize: '1rem', background: '#0B0F19', color: 'white', borderRadius: 10 }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>Difficulty</label>
                  <select
                    className="form-control"
                    value={difficulty}
                    onChange={e => setDifficulty(e.target.value)}
                    style={{ fontSize: '0.78rem', background: '#0B0F19', color: 'white', borderRadius: 8, padding: '4px 8px' }}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)' }}>Estimated (Hrs)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={estimatedHours}
                    onChange={e => setEstimatedHours(parseFloat(e.target.value) || 1)}
                    className="form-control"
                    style={{ fontSize: '0.78rem', background: '#0B0F19', color: 'white', borderRadius: 8, padding: '4px 8px' }}
                  />
                </div>
              </div>
            </div>

            {/* Lessons List Navigation */}
            <div className="card" style={{ padding: 18, borderRadius: 16, background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
                  Curriculum Lessons ({lessons.length})
                </span>
                <button
                  type="button"
                  onClick={addLesson}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.72rem', borderRadius: 8 }}
                >
                  <PlusCircle size={12} /> Add Lesson
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 460, overflowY: 'auto' }}>
                {lessons.map((lesson, idx) => {
                  const isActive = idx === activeLessonIdx;
                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveLessonIdx(idx)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: isActive ? 'rgba(124, 58, 237, 0.15)' : 'rgba(255,255,255,0.02)',
                        border: isActive ? '1px solid var(--forge-accent)' : '1px solid rgba(255,255,255,0.06)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '0.7rem', color: isActive ? 'var(--forge-accent)' : 'var(--text-muted)', fontWeight: 800 }}>
                            LESSON {idx + 1}
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lesson.title || 'Untitled Lesson'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                            <span><Clock size={10} style={{ verticalAlign: 'middle' }} /> {lesson.duration_minutes || 15}m</span>
                            <span>•</span>
                            <span>{lesson.quizzes?.length || 0} Quiz Qs</span>
                          </div>
                        </div>

                        {/* Move & Delete controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveLesson(idx, -1)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '2px 4px', cursor: 'pointer', fontSize: '0.7rem' }}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            disabled={idx === lessons.length - 1}
                            onClick={() => moveLesson(idx, 1)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', padding: '2px 4px', cursor: 'pointer', fontSize: '0.7rem' }}
                          >
                            ▼
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLesson(idx)}
                            style={{ background: 'none', border: 'none', color: '#EF4444', padding: '2px 4px', cursor: 'pointer' }}
                            title="Delete Lesson"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Studio Active Lesson Workspace */}
          <div className="card" style={{ padding: '28px 24px', borderRadius: 20, background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)' }}>
            
            {/* Active Lesson Header Input */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--forge-border)', paddingBottom: 20, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--forge-accent)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Editing Lesson {activeLessonIdx + 1} of {lessons.length}
                </div>
                <input
                  type="text"
                  className="form-control"
                  value={activeLesson.title}
                  onChange={e => updateActiveLesson('title', e.target.value)}
                  placeholder="Lesson Title..."
                  style={{ fontSize: '1.25rem', fontWeight: 900, background: 'transparent', border: 'none', borderBottom: '1px solid var(--forge-border)', borderRadius: 0, padding: '4px 0', color: 'white' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <Clock size={14} />
                  <span>Duration:</span>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={activeLesson.duration_minutes || 15}
                    onChange={e => updateActiveLesson('duration_minutes', parseInt(e.target.value, 10) || 15)}
                    style={{ width: 55, padding: '4px 8px', borderRadius: 6, background: '#0B0F19', border: '1px solid var(--forge-border)', color: 'white', textAlign: 'center' }}
                  />
                  <span>mins</span>
                </div>
              </div>
            </div>

            {/* Visual Studio Sub-Tabs */}
            <div style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--forge-border)', marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => setEditorSubTab('cards')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: editorSubTab === 'cards' ? '3px solid var(--forge-accent)' : '3px solid transparent',
                  color: editorSubTab === 'cards' ? 'var(--forge-accent)' : 'var(--text-muted)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Layers size={14} /> 1. Visual Card & Narration
              </button>

              <button
                type="button"
                onClick={() => setEditorSubTab('markdown')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: editorSubTab === 'markdown' ? '3px solid var(--forge-accent)' : '3px solid transparent',
                  color: editorSubTab === 'markdown' ? 'var(--forge-accent)' : 'var(--text-muted)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <AlignLeft size={14} /> 2. Full Instructional Body
              </button>

              <button
                type="button"
                onClick={() => setEditorSubTab('quiz')}
                style={{
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: editorSubTab === 'quiz' ? '3px solid var(--forge-accent)' : '3px solid transparent',
                  color: editorSubTab === 'quiz' ? 'var(--forge-accent)' : 'var(--text-muted)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <HelpCircle size={14} /> 3. Knowledge Check Quizzes ({activeLesson.quizzes?.length || 0})
              </button>
            </div>

            {/* Sub-Tab 1: Visual Cards & Narration Script */}
            {editorSubTab === 'cards' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Hero Key Concept Card */}
                <div style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#A78BFA', fontWeight: 800, fontSize: '0.82rem' }}>
                    <Zap size={16} /> Key Concept Card (Hero Insight)
                  </div>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={activeLesson.summary_card || ''}
                    onChange={e => updateActiveLesson('summary_card', e.target.value)}
                    placeholder="Enter the primary punchy insight learners will see first..."
                    style={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 10, fontSize: '0.9rem' }}
                  />
                </div>

                {/* Narration & Voiceover Script Card */}
                <div style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#60A5FA', fontWeight: 800, fontSize: '0.82rem' }}>
                    🎙️ Audio Narration & Storyboard Voiceover Script
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 8px 0' }}>
                    Instructional script for voice recording, TTS synthesis, or human video presenter.
                  </p>
                  <textarea
                    rows={4}
                    className="form-control"
                    value={activeLesson.narration_script || ''}
                    onChange={e => updateActiveLesson('narration_script', e.target.value)}
                    placeholder="e.g. Welcome everyone. In this section we examine why decoupling microservices protects database performance..."
                    style={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 10, fontSize: '0.88rem' }}
                  />
                </div>

                {/* Key Takeaways */}
                <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 14, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#34D399', fontWeight: 800, fontSize: '0.82rem' }}>
                    <CheckCircle size={16} /> Key Takeaways (Bullet Points)
                  </div>
                  <textarea
                    rows={3}
                    className="form-control"
                    value={(activeLesson.key_takeaways || []).join('\n')}
                    onChange={e => updateActiveLesson('key_takeaways', e.target.value.split('\n').filter(Boolean))}
                    placeholder="Enter one key takeaway per line..."
                    style={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.1)', color: 'white', borderRadius: 10, fontSize: '0.85rem' }}
                  />
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Markdown Lesson Body with Live Split Preview */}
            {editorSubTab === 'markdown' && (
              <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Markdown Source Code
                  </label>
                  <textarea
                    rows={18}
                    className="form-control"
                    value={activeLesson.content_markdown || ''}
                    onChange={e => updateActiveLesson('content_markdown', e.target.value)}
                    placeholder="# Lesson Title&#10;&#10;Explain your concepts here with markdown headers, bullets, code blocks..."
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem', background: '#0B0F19', color: '#E2E8F0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    Live Visual Preview
                  </label>
                  <div style={{ height: 380, overflowY: 'auto', padding: 16, background: '#0B0F19', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', fontSize: '0.88rem', lineHeight: 1.6 }}>
                    <ReactMarkdown>{activeLesson.content_markdown || '*No content provided yet.*'}</ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Knowledge Check Quizzes */}
            {editorSubTab === 'quiz' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Formative multiple-choice questions testing core concepts from this lesson.
                  </p>
                  <button
                    type="button"
                    onClick={addQuizQuestion}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 8, fontWeight: 700 }}
                  >
                    <PlusCircle size={14} /> Add Question
                  </button>
                </div>

                {(activeLesson.quizzes || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 36, background: 'rgba(255,255,255,0.02)', borderRadius: 14, border: '1px dashed var(--forge-border)' }}>
                    <HelpCircle size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>No quizzes added to this lesson yet.</p>
                    <button type="button" onClick={addQuizQuestion} className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                      <PlusCircle size={13} /> Add Knowledge Check
                    </button>
                  </div>
                ) : (
                  (activeLesson.quizzes || []).map((q, qIdx) => (
                    <div key={qIdx} style={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--forge-accent)', textTransform: 'uppercase' }}>
                          Question {qIdx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeQuizQuestion(qIdx)}
                          className="btn btn-ghost btn-sm"
                          style={{ color: '#EF4444', padding: 4 }}
                          title="Remove Question"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Question Text */}
                      <input
                        type="text"
                        className="form-control"
                        value={q.question_text || ''}
                        onChange={e => updateQuiz(qIdx, 'question_text', e.target.value)}
                        placeholder="Enter the question text..."
                        style={{ fontWeight: 700, fontSize: '0.95rem', background: '#131926', color: 'white', borderRadius: 8, marginBottom: 14 }}
                      />

                      {/* 4 Options */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                          Select the Radio Button next to the Correct Answer:
                        </span>
                        {(q.options || []).map((opt, optIdx) => {
                          const isCorrect = q.correct_answer === opt;
                          return (
                            <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <input
                                type="radio"
                                name={`correct_ans_${qIdx}`}
                                checked={isCorrect}
                                onChange={() => updateQuiz(qIdx, 'correct_answer', opt)}
                                style={{ accentColor: '#10B981', width: 16, height: 16, cursor: 'pointer' }}
                                title="Mark as correct answer"
                              />
                              <input
                                type="text"
                                className="form-control"
                                value={opt}
                                onChange={e => updateQuizOption(qIdx, optIdx, e.target.value)}
                                placeholder={`Option ${String.fromCharCode(65 + optIdx)}...`}
                                style={{
                                  flex: 1,
                                  fontSize: '0.85rem',
                                  borderRadius: 8,
                                  background: isCorrect ? 'rgba(16, 185, 129, 0.08)' : '#131926',
                                  borderColor: isCorrect ? '#10B981' : 'rgba(255,255,255,0.08)',
                                  color: 'white'
                                }}
                              />
                              {isCorrect && (
                                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#10B981' }}>
                                  ✓ Correct
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      <div>
                        <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                          Pedagogical Explanation (Shown after answering)
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={q.explanation || ''}
                          onChange={e => updateQuiz(qIdx, 'explanation', e.target.value)}
                          placeholder="Explain why this option is correct and how it reinforces the concept..."
                          style={{ fontSize: '0.82rem', background: '#131926', color: '#CBD5E1', borderRadius: 8 }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--forge-border)' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  disabled={activeLessonIdx === 0}
                  onClick={() => setActiveLessonIdx(Math.max(0, activeLessonIdx - 1))}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  <ArrowLeft size={14} /> Previous Lesson
                </button>
                <button
                  type="button"
                  disabled={activeLessonIdx === lessons.length - 1}
                  onClick={() => setActiveLessonIdx(Math.min(lessons.length - 1, activeLessonIdx + 1))}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  Next Lesson <ArrowRight size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => handleSaveCourse(false)}
                  disabled={isSaving}
                  className="btn btn-secondary"
                  style={{ fontWeight: 700 }}
                >
                  <Save size={14} /> Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCourse(true)}
                  disabled={isSaving}
                  className="btn btn-primary"
                  style={{ fontWeight: 800, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}
                >
                  <CheckCircle size={15} /> Publish to Library
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── INTERACTIVE LEARNER PREVIEW MODAL ─────────────────────────────── */}
      {previewModalOpen && (
        <div className="modal-overlay" onClick={() => setPreviewModalOpen(false)} style={{ zIndex: 700 }}>
          <div
            className="modal animate-scale-in"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 880, width: '95%', maxHeight: '90vh', background: '#0F172A', color: 'white', borderRadius: 20, display: 'flex', flexDirection: 'column' }}
          >
            {/* Modal Header */}
            <div className="modal-header" style={{ padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#A78BFA', textTransform: 'uppercase' }}>
                  Learner Simulation Mode
                </span>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900 }}>
                  {title || 'Untitled Course'}
                </h3>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreviewModalOpen(false)} style={{ color: '#94A3B8' }}>
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20 }}>
              {/* Left: Lesson Checklist */}
              <div style={{ borderRight: '1px solid rgba(255,255,255,0.08)', paddingRight: 16 }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                  Curriculum Progress
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {lessons.map((l, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPreviewLessonIdx(idx)}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: previewLessonIdx === idx ? 'rgba(124, 58, 237, 0.25)' : 'transparent',
                        border: previewLessonIdx === idx ? '1px solid #7C3AED' : 'none',
                        color: previewLessonIdx === idx ? 'white' : '#94A3B8',
                        fontSize: '0.8rem',
                        fontWeight: previewLessonIdx === idx ? 800 : 500,
                        cursor: 'pointer'
                      }}
                    >
                      {idx + 1}. {l.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Active Lesson View */}
              <div>
                {lessons[previewLessonIdx] && (
                  <div>
                    <h2 style={{ margin: '0 0 16px 0', fontSize: '1.4rem', fontWeight: 900 }}>
                      {lessons[previewLessonIdx].title}
                    </h2>

                    {/* Key Concept Hero Card */}
                    {lessons[previewLessonIdx].summary_card && (
                      <div style={{ background: 'rgba(124, 58, 237, 0.1)', border: '1px solid rgba(124, 58, 237, 0.3)', borderRadius: 12, padding: 14, marginBottom: 18 }}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#A78BFA', marginBottom: 4 }}>
                          💡 KEY CONCEPT
                        </div>
                        <div style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>
                          {lessons[previewLessonIdx].summary_card}
                        </div>
                      </div>
                    )}

                    {/* Narration Script Box */}
                    {lessons[previewLessonIdx].narration_script && (
                      <details style={{ background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 10, padding: 10, marginBottom: 18 }}>
                        <summary style={{ cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, color: '#60A5FA' }}>
                          🎙️ Audio Voiceover / Storyboard Script
                        </summary>
                        <div style={{ fontSize: '0.85rem', color: '#CBD5E1', marginTop: 8, fontStyle: 'italic' }}>
                          "{lessons[previewLessonIdx].narration_script}"
                        </div>
                      </details>
                    )}

                    {/* Lesson Markdown */}
                    <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#E2E8F0', marginBottom: 24 }}>
                      <ReactMarkdown>{lessons[previewLessonIdx].content_markdown || ''}</ReactMarkdown>
                    </div>

                    {/* Interactive Quizzes */}
                    {lessons[previewLessonIdx].quizzes?.length > 0 && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 18, marginTop: 18 }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '1rem', fontWeight: 800, color: '#34D399' }}>
                          Interactive Knowledge Check
                        </h4>
                        {lessons[previewLessonIdx].quizzes.map((q, qIdx) => {
                          const qKey = `${previewLessonIdx}_${qIdx}`;
                          const selectedOpt = previewQuizAnswer[qKey];
                          const submitted = previewQuizSubmitted[qKey];
                          const isCorrect = selectedOpt === q.correct_answer;

                          return (
                            <div key={qIdx} style={{ background: '#131926', borderRadius: 12, padding: 14, marginBottom: 12 }}>
                              <p style={{ margin: '0 0 10px 0', fontWeight: 700, fontSize: '0.9rem' }}>
                                {q.question_text}
                              </p>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {q.options.map((opt, optIdx) => (
                                  <label
                                    key={optIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      padding: '8px 10px',
                                      borderRadius: 8,
                                      background: submitted
                                        ? opt === q.correct_answer
                                          ? 'rgba(16, 185, 129, 0.2)'
                                          : selectedOpt === opt
                                          ? 'rgba(239, 68, 68, 0.2)'
                                          : 'rgba(255,255,255,0.02)'
                                        : selectedOpt === opt
                                        ? 'rgba(124, 58, 237, 0.15)'
                                        : 'rgba(255,255,255,0.02)',
                                      cursor: submitted ? 'default' : 'pointer',
                                      fontSize: '0.85rem'
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`quiz_sim_${qKey}`}
                                      checked={selectedOpt === opt}
                                      onChange={() => !submitted && setPreviewQuizAnswer(p => ({ ...p, [qKey]: opt }))}
                                      disabled={submitted}
                                      style={{ accentColor: '#7C3AED' }}
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>

                              {!submitted ? (
                                <button
                                  type="button"
                                  disabled={!selectedOpt}
                                  onClick={() => setPreviewQuizSubmitted(p => ({ ...p, [qKey]: true }))}
                                  className="btn btn-secondary btn-sm"
                                  style={{ marginTop: 10, fontSize: '0.75rem' }}
                                >
                                  Submit Answer
                                </button>
                              ) : (
                                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', fontSize: '0.82rem' }}>
                                  <div style={{ fontWeight: 800, color: isCorrect ? '#34D399' : '#F87171' }}>
                                    {isCorrect ? '✓ Correct!' : '✕ Incorrect'}
                                  </div>
                                  <div style={{ color: '#CBD5E1', marginTop: 4 }}>
                                    {q.explanation}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  disabled={previewLessonIdx === 0}
                  onClick={() => setPreviewLessonIdx(Math.max(0, previewLessonIdx - 1))}
                  className="btn btn-secondary btn-sm"
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  disabled={previewLessonIdx === lessons.length - 1}
                  onClick={() => setPreviewLessonIdx(Math.min(lessons.length - 1, previewLessonIdx + 1))}
                  className="btn btn-secondary btn-sm"
                >
                  Next →
                </button>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => setPreviewModalOpen(false)}>
                Done Previewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
