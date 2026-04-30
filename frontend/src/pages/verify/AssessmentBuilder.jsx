import React, { useState } from 'react';
import { verifyApi } from '../../api';
import { PlusCircle, Trash2, GripVertical, ChevronDown, Sparkles, Loader2, Upload, Download, FileText, Link as LinkIcon, Image as ImageIcon, X } from 'lucide-react';
import toast from 'react-hot-toast';

const QUESTION_TYPES = [
  { value: 'mcq', label: '🔘 Multiple Choice (MCQ)' },
  { value: 'mcq_multi', label: '✅ Multiple Selection (MCQ-Multi)' },
  { value: 'written', label: '✍️ Written / Essay' },
  { value: 'coding', label: '💻 Coding Challenge' },
  { value: 'file_upload', label: '📎 File Upload' },
];

function QuestionForm({ q, index, onChange, onRemove, onAutoGenerate, generating }) {
  return (
    <div className="card animate-fade-in" style={{ marginBottom: 16, border: '1px solid var(--border)' }}>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span className="badge badge-primary">Q{index + 1}</span>
          <button className="btn btn-danger btn-sm" onClick={onRemove}><Trash2 size={13} /></button>
        </div>
        <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label className="form-label">Question Type</label>
            <select className="form-control" value={q.question_type} onChange={e => onChange('question_type', e.target.value)}>
              {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Marks</label>
            <input type="number" className="form-control" min={0.5} step={0.5} value={q.marks} onChange={e => onChange('marks', parseFloat(e.target.value))} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">{q.question_type === 'file_upload' ? 'Upload Instructions (e.g., "Upload your project zip")' : 'Question Text *'}</label>
          <textarea 
            className="form-control" 
            rows={3} 
            value={q.question_text} 
            onChange={e => onChange('question_text', e.target.value)} 
            onPaste={() => {
              if (q.question_type === 'coding' && !q.starter_code?.trim()) {
                setTimeout(() => onAutoGenerate(index), 100);
              }
            }}
            onBlur={() => {
              if (q.question_type === 'coding' && !q.starter_code?.trim() && (q.test_cases?.length === 0 || !q.test_cases)) {
                onAutoGenerate(index);
              }
            }}
            placeholder={q.question_type === 'file_upload' ? 'Enter instructions for the candidate regarding the file upload…' : 'Enter your question…'} 
          />
          
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
              {(q.images || []).map((imgUrl, imgIndex) => (
                <div key={imgIndex} style={{ position: 'relative', display: 'inline-block' }}>
                  <img 
                    src={imgUrl} 
                    alt={`Question ${imgIndex + 1}`} 
                    style={{ width: 100, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} 
                  />
                  <button 
                    className="btn btn-danger btn-xs" 
                    style={{ position: 'absolute', top: -6, right: -6, borderRadius: '50%', padding: 2, minWidth: 20, height: 20 }}
                    onClick={() => {
                      const next = q.images.filter((_, i) => i !== imgIndex);
                      onChange('images', next);
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              
              <label className="btn btn-ghost" style={{ width: 100, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', border: '2px dashed var(--border)', borderRadius: 8, fontSize: '0.7rem' }}>
                <ImageIcon size={18} />
                <span>Add Image</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    try {
                      toast.loading('Uploading...', { id: 'img-up' });
                      const res = await verifyApi.uploadQuestionImage(file);
                      const current = Array.isArray(q.images) ? q.images : [];
                      onChange('images', [...current, res.data.data.image_url]);
                      toast.success('Added!', { id: 'img-up' });
                    } catch (err) {
                      toast.error('Failed', { id: 'img-up' });
                    }
                  }} 
                />
              </label>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Upload diagrams, examples or screenshots (Multiple supported)</p>
          </div>
        </div>
        {(q.question_type === 'mcq' || q.question_type === 'mcq_multi') && (
          <div className="form-group">
            <label className="form-label">Options (press Enter to add)</label>
            {(q.options || []).map((opt, oi) => {
              const isCorrect = q.question_type === 'mcq' 
                ? q.correct_answer === opt
                : (() => {
                    try {
                      const corrArr = JSON.parse(q.correct_answer || '[]');
                      return Array.isArray(corrArr) && corrArr.includes(opt);
                    } catch { return false; }
                  })();

              const handleCorrectToggle = () => {
                if (q.question_type === 'mcq') {
                  onChange('correct_answer', opt);
                } else {
                  try {
                    let corrArr = JSON.parse(q.correct_answer || '[]');
                    if (!Array.isArray(corrArr)) corrArr = [];
                    if (corrArr.includes(opt)) {
                      corrArr = corrArr.filter(x => x !== opt);
                    } else {
                      corrArr.push(opt);
                    }
                    onChange('correct_answer', JSON.stringify(corrArr));
                  } catch {
                    onChange('correct_answer', JSON.stringify([opt]));
                  }
                }
              };

              return (
                <div key={oi} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input 
                    type={q.question_type === 'mcq' ? "radio" : "checkbox"}
                    name={`correct-${index}`} 
                    checked={isCorrect} 
                    onChange={handleCorrectToggle} 
                    style={{ accentColor: 'var(--primary)', marginTop: 8 }} 
                    title="Set as correct answer" 
                  />
                  <input className="form-control" value={opt} onChange={e => { const opts = [...q.options]; opts[oi] = e.target.value; onChange('options', opts); }} placeholder={`Option ${String.fromCharCode(65+oi)}`} />
                  <button className="btn btn-ghost btn-sm" onClick={() => { 
                    const opts = q.options.filter((_, i) => i !== oi); 
                    onChange('options', opts); 
                    // Clean up correct answers if option removed
                    if (q.question_type === 'mcq') {
                      if (q.correct_answer === opt) onChange('correct_answer', '');
                    } else {
                      try {
                        let corrArr = JSON.parse(q.correct_answer || '[]');
                        if (Array.isArray(corrArr)) {
                          corrArr = corrArr.filter(x => x !== opt);
                          onChange('correct_answer', JSON.stringify(corrArr));
                        }
                      } catch {}
                    }
                  }}><Trash2 size={13} /></button>
                </div>
              );
            })}
            <button className="btn btn-secondary btn-sm" onClick={() => onChange('options', [...(q.options || []), ''])}><PlusCircle size={13} /> Add Option</button>
            {q.correct_answer && (
              <p style={{ fontSize: '0.78rem', color: 'var(--success)', marginTop: 8 }}>
                ✅ Correct: {q.question_type === 'mcq' ? q.correct_answer : (() => {
                  try {
                    const arr = JSON.parse(q.correct_answer);
                    return Array.isArray(arr) ? arr.join(', ') : q.correct_answer;
                  } catch { return q.correct_answer; }
                })()}
              </p>
            )}
          </div>
        )}
        {q.question_type === 'written' && (
          <div className="form-group">
            <label className="form-label">Model Answer (for AI grading)</label>
            <textarea className="form-control" rows={3} value={q.model_answer || ''} onChange={e => onChange('model_answer', e.target.value)} placeholder="The ideal answer should include…" />
          </div>
        )}
        {q.question_type === 'coding' && (
          <div className="form-group">
            <label className="form-label">Starter Code (Optional)</label>
            <textarea className="form-control" rows={5} style={{ fontFamily: 'monospace', fontSize: '0.85rem', marginBottom: 12 }} value={q.starter_code || ''} onChange={e => onChange('starter_code', e.target.value)} placeholder="// function solution(input) {" />
            
            <label className="form-label" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Test Cases (for Auto-Grading & Execution)</label>
            {(q.test_cases || []).map((tc, tcIdx) => (
              <div key={tcIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 16, alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Input</div>
                  <textarea className="form-control" placeholder="Input (stdin)" rows={4} value={tc.input || ''} onChange={e => {
                    const newTc = [...(q.test_cases || [])];
                    newTc[tcIdx] = { ...newTc[tcIdx], input: e.target.value };
                    onChange('test_cases', newTc);
                  }} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' }}>Expected Output</div>
                  <textarea className="form-control" placeholder="Expected Output (stdout)" rows={4} value={tc.expected_output || ''} onChange={e => {
                    const newTc = [...(q.test_cases || [])];
                    newTc[tcIdx] = { ...newTc[tcIdx], expected_output: e.target.value };
                    onChange('test_cases', newTc);
                  }} style={{ fontFamily: 'monospace', fontSize: '0.75rem' }} />
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => {
                  const newTc = [...(q.test_cases || [])];
                  newTc.splice(tcIdx, 1);
                  onChange('test_cases', newTc);
                }} style={{ color: 'var(--danger)', marginTop: 28 }}><Trash2 size={16} /></button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => onAutoGenerate(index)}
                disabled={generating || !q.question_text}
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: 'white', border: 'none' }}
              >
                {generating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />} 
                {generating ? 'Generating...' : 'AI Auto-Generate Cases'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                const newTc = [...(q.test_cases || []), { input: '', expected_output: '' }];
                onChange('test_cases', newTc);
              }}>+ Add Test Case</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const blankQuestion = () => ({ question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', model_answer: '', starter_code: '', test_cases: [], marks: 5, order_index: 0, images: [] });

export default function AssessmentBuilder() {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [timeLimit, setTimeLimit] = useState(30);
  const [passScore, setPassScore] = useState(70);
  const [shuffle, setShuffle] = useState(true);
  const [showResult, setShowResult] = useState(true);
  const [questions, setQuestions] = useState([blankQuestion()]);
  const [loading, setLoading] = useState(false);
  const [generatingFor, setGeneratingFor] = useState(null);

  const updateQ = (i, key, val) => setQuestions(qs => qs.map((q, qi) => qi === i ? { ...q, [key]: val } : q));
  const removeQ = (i) => setQuestions(qs => qs.filter((_, qi) => qi !== i));
  const addQ = () => setQuestions(qs => [...qs, blankQuestion()]);

  const handleSave = async (publish = false) => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    if (questions.some(q => !q.question_text.trim())) { toast.error('All questions need text'); return; }
    const invalidCodingIndex = questions.findIndex(q => {
      if (q.question_type !== 'coding') return false;
      const testCases = Array.isArray(q.test_cases) ? q.test_cases : [];
      return testCases.length < 3 || testCases.some(tc => !String(tc?.expected_output || tc?.expected || '').trim());
    });
    if (invalidCodingIndex !== -1) {
      toast.error(`Q${invalidCodingIndex + 1}: Coding questions need at least 3 test cases with expected outputs.`);
      return;
    }
    setLoading(true);
    try {
      // Auto-detect assessment type
      const types = [...new Set(questions.map(q => q.question_type))];
      const asmtType = types.length > 1 ? 'mixed' : (types[0] || 'mcq');

      const res = await verifyApi.createAssessment({ 
        title, 
        description: desc, 
        type: asmtType,
        time_limit_minutes: timeLimit, 
        pass_score: passScore, 
        shuffle_questions: shuffle, 
        show_result_immediately: showResult, 
        questions 
      });
      if (publish) await verifyApi.publishAssessment(res.data.data.id);
      toast.success(publish ? 'Assessment published!' : 'Draft saved!');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoGenerate = async (index) => {
    const q = questions[index];
    if (!q.question_text.trim()) { toast.error('Please enter the question text first'); return; }
    
    setGeneratingFor(index);
    try {
      const res = await verifyApi.generateCodingMeta({ question_text: q.question_text });
      const { starter_code, test_cases } = res.data.data;
      
      const newQs = [...questions];
      newQs[index] = { 
        ...q, 
        starter_code: starter_code || q.starter_code,
        test_cases: test_cases || q.test_cases
      };
      setQuestions(newQs);
      toast.success('Generated! Please review and edit if needed.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'AI generation failed');
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target.result;
        let newQs = [];
        
        if (file.name.endsWith('.json')) {
          newQs = JSON.parse(content);
        } else if (file.name.endsWith('.csv')) {
          const lines = content.split('\n');
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          
          for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            const values = lines[i].split(',').map(v => v.trim());
            const q = { ...blankQuestion() };
            headers.forEach((h, idx) => {
              if (h === 'type') q.question_type = values[idx] || 'mcq';
              else if (h === 'text') q.question_text = values[idx];
              else if (h === 'marks') q.marks = parseFloat(values[idx]) || 5;
              else if (h === 'options') q.options = values[idx].split('|');
              else if (h === 'correct') q.correct_answer = values[idx];
            });
            newQs.push(q);
          }
        } else {
          // Send to backend for AI parsing (Word, PDF, Excel)
          setLoading(true);
          toast.loading(`AI is parsing your ${file.name.split('.').pop().toUpperCase()} file...`, { id: 'importing' });
          const formData = new FormData();
          formData.append('file', file);
          const res = await verifyApi.importQuestions(formData);
          newQs = res.data.data;
          toast.success(`AI successfully extracted ${newQs.length} questions!`, { id: 'importing' });
        }
        
        if (Array.isArray(newQs) && newQs.length > 0) {
          setQuestions(prev => [...prev.filter(q => q.question_text), ...newQs]);
        }
      } catch (err) {
        toast.error(err?.response?.data?.detail || 'Failed to parse file. Use JSON, CSV, Word, PDF or Excel.', { id: 'importing' });
      } finally {
        setLoading(false);
      }
    };
    if (file.name.endsWith('.json') || file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      // For binary files, reader is used just to trigger the async flow, 
      // but we actually send the file object via FormData.
      reader.onload({ target: { result: '' } }); 
    }
    e.target.value = ''; // Reset input
  };

  const totalMarks = questions.reduce((s, q) => s + (q.marks || 0), 0);
  const handleUrlImport = async () => {
    const url = prompt("Enter a webpage URL to extract questions from:");
    if (!url) return;
    try {
      new URL(url);
    } catch {
      toast.error('Please enter a valid URL including http:// or https://');
      return;
    }

    setLoading(true);
    toast.loading(`Scraping webpage and extracting questions with AI...`, { id: 'importing_url' });
    try {
      const res = await verifyApi.importFromUrl(url);
      const newQs = res.data.data;
      if (Array.isArray(newQs) && newQs.length > 0) {
        setQuestions(prev => [...prev.filter(q => q.question_text), ...newQs]);
        toast.success(`AI successfully extracted ${newQs.length} questions from the URL!`, { id: 'importing_url' });
      } else {
        toast.error("No questions could be extracted from that URL.", { id: 'importing_url' });
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to extract from URL.', { id: 'importing_url' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><h1>Assessment Builder</h1><p>Design multi-format assessments — MCQ, written, and coding</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label className={`btn btn-secondary ${loading ? 'disabled' : ''}`} style={{ cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />} 
            {loading ? 'Processing...' : 'Import'}
            <input type="file" accept=".csv,.json,.docx,.pdf,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileUpload} disabled={loading} />
          </label>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={handleUrlImport} disabled={loading}>
            <LinkIcon size={14} /> From URL
          </button>

          <button className="btn btn-secondary" onClick={() => handleSave(false)} disabled={loading}>Save Draft</button>
          <button className="btn btn-shimmer" onClick={() => handleSave(true)} disabled={loading}>🚀 Publish</button>
        </div>
      </div>
      <div className="page-body">
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Left: questions */}
          <div>
            {questions.map((q, i) => (
              <QuestionForm 
                key={i} 
                q={q} 
                index={i} 
                onChange={(k, v) => updateQ(i, k, v)} 
                onRemove={() => removeQ(i)} 
                onAutoGenerate={handleAutoGenerate}
                generating={generatingFor === i}
              />
            ))}
            <button className="btn btn-secondary btn-block" onClick={addQ}><PlusCircle size={16} /> Add Question</button>
          </div>

          {/* Right: settings */}
          <div>
            <div className="card animate-fade-in">
              <div className="card-header"><h4>Assessment Settings</h4></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., React Developer Assessment" />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} value={desc} onChange={e => setDesc(e.target.value)} placeholder="What this assessment evaluates…" />
                </div>
                <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Time Limit (mins)</label>
                    <input type="number" className="form-control" value={timeLimit} min={5} max={180} onChange={e => setTimeLimit(parseInt(e.target.value))} />
                  </div>
                  <div>
                    <label className="form-label">Pass Score (%)</label>
                    <input type="number" className="form-control" value={passScore} min={1} max={100} onChange={e => setPassScore(parseInt(e.target.value))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={shuffle} onChange={e => setShuffle(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                    Shuffle questions
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input type="checkbox" checked={showResult} onChange={e => setShowResult(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                    Auto-release results to candidate (turn off for manual HR approval)
                  </label>
                </div>
              </div>
            </div>

            <div className="card animate-fade-in stagger-2" style={{ marginTop: 16, background: 'var(--primary-lightest)' }}>
              <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{questions.length}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>QUESTIONS</div></div>
                  <div><div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>{totalMarks}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>TOTAL MARKS</div></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
