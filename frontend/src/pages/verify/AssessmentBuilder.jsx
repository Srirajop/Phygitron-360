import React, { useState } from 'react';
import { verifyApi } from '../../api';
import { PlusCircle, Trash2, GripVertical, ChevronDown, Sparkles, Loader2, Upload, Download, FileText, Link as LinkIcon, Image as ImageIcon, X, Database, Tag, Edit2 } from 'lucide-react';
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
              <button className="btn btn-secondary btn-sm" onClick={() => { const newTc = [...(q.test_cases || []), { input: '', expected_output: '' }]; onChange('test_cases', newTc); }}>+ Add Test Case</button>
            </div>
          </div>
        )}
        <div className="form-group" style={{ marginTop: 8 }}>
          <label className="form-label"><Tag size={13} style={{verticalAlign:'middle',marginRight:4}}/>Tags <span style={{fontWeight:400,color:'var(--text-muted)',fontSize:'0.8rem'}}>(e.g. Java, English)</span></label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {(q.tags || []).map((tag, ti) => (
              <span key={ti} style={{ display:'inline-flex',alignItems:'center',gap:4,background:'var(--primary-lightest)',color:'var(--primary)',borderRadius:999,padding:'3px 10px',fontSize:'0.72rem',fontWeight:600 }}>
                {tag}
                <button onClick={() => onChange('tags', (q.tags||[]).filter((_,i)=>i!==ti))} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',padding:0,display:'flex'}}><X size={11}/></button>
              </span>
            ))}
          </div>
          <input className="form-control" placeholder="Type a tag and press Enter" style={{fontSize:'0.82rem'}}
            onKeyDown={(e) => { if(e.key==='Enter'&&e.target.value.trim()){e.preventDefault();const tag=e.target.value.trim();if(!(q.tags||[]).includes(tag))onChange('tags',[...(q.tags||[]),tag]);e.target.value='';}}}
            onBlur={(e) => { if(e.target.value.trim()){const tag=e.target.value.trim();if(!(q.tags||[]).includes(tag))onChange('tags',[...(q.tags||[]),tag]);e.target.value='';} }} />
        </div>
      </div>
    </div>


  );
}

const blankQuestion = () => ({ question_text:'', question_type:'mcq', options:['','','',''], correct_answer:'', model_answer:'', starter_code:'', test_cases:[], marks:5, order_index:0, images:[], tags:[] });

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
  const [bankModal, setBankModal] = useState(false);
  const [bankItems, setBankItems] = useState([]);
  const [bankSearch, setBankSearch] = useState('');
  const [bankSelected, setBankSelected] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [showBankAddForm, setShowBankAddForm] = useState(false);
  const [editBankItemId, setEditBankItemId] = useState(null);
  const [bankAddForm, setBankAddForm] = useState({ question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', marks: 1, tags: [], tagInput: '' });
  const [bankAddSaving, setBankAddSaving] = useState(false);
  const [bankFileUploading, setBankFileUploading] = useState(false);
  const [bankImportPreview, setBankImportPreview] = useState(null);

  const handlePreviewAutoGenerate = async (index) => {
    const q = bankImportPreview[index];
    if (!q.question_text.trim()) { toast.error('Please enter the question text first'); return; }
    
    setGeneratingFor(`bank-prev-${index}`);
    try {
      const res = await verifyApi.generateCodingMeta({ question_text: q.question_text });
      const { starter_code, test_cases } = res.data.data;
      
      const newQs = [...bankImportPreview];
      newQs[index] = { 
        ...q, 
        starter_code: starter_code || q.starter_code,
        test_cases: test_cases || q.test_cases
      };
      setBankImportPreview(newQs);
      toast.success('Generated! Please review and edit if needed.');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'AI generation failed');
    } finally {
      setGeneratingFor(null);
    }
  };

  const saveBankAddForm = async () => {
    if (!bankAddForm.question_text.trim()) { toast.error('Question text required'); return; }
    
    // Auto-flush pending tag input
    let finalTags = [...bankAddForm.tags];
    if (bankAddForm.tagInput.trim() && !finalTags.includes(bankAddForm.tagInput.trim())) {
      finalTags.push(bankAddForm.tagInput.trim());
    }
    
    try {
      setBankAddSaving(true);
      const payload = { ...bankAddForm, tags: finalTags };
      if (editBankItemId) {
        await verifyApi.updateBankItem(editBankItemId, payload);
        toast.success('Question updated in Bank!');
      } else {
        await verifyApi.createBankItem(payload);
        toast.success('Question added to Bank!');
      }
      setBankAddForm({ question_text: '', question_type: 'mcq', options: ['', '', '', ''], correct_answer: '', marks: 1, tags: [], tagInput: '' });
      setShowBankAddForm(false);
      setEditBankItemId(null);
      const newBankItemsRes = await verifyApi.listQuestionBank();
      setBankItems(newBankItemsRes.data.data);
    } catch(e) { toast.error(e?.response?.data?.detail || 'Failed to save to bank'); }
    finally { setBankAddSaving(false); }
  };

  const updateQ = (i, key, val) => setQuestions(qs => qs.map((q, qi) => qi === i ? { ...q, [key]: val } : q));
  const removeQ = (i) => setQuestions(qs => qs.filter((_, qi) => qi !== i));
  const addQ = () => setQuestions(qs => [...qs, blankQuestion()]);

  const openBankModal = async () => {
    setBankModal(true); setBankSelected([]); setBankSearch(''); setBankImportPreview(null);
    if (bankItems.length === 0) {
      setBankLoading(true);
      try { const r = await verifyApi.listQuestionBank(); setBankItems(r.data.data || []); } catch {}
      setBankLoading(false);
    }
  };

  const addFromBank = () => {
    const toAdd = bankItems.filter(i => bankSelected.includes(i.id)).map(i => ({ ...blankQuestion(), ...i, tags: i.tags || [] }));
    setQuestions(qs => [...qs.filter(q => q.question_text), ...toAdd]);
    setBankModal(false); setBankSelected([]);
    toast.success(`Added ${toAdd.length} question(s) from bank`);
  };

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
          const tags = prompt("Enter default tags for these questions (comma separated, optional):") || "";
          const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean);
          if (tagsArr.length > 0) {
            newQs = newQs.map(q => ({ ...q, tags: [...new Set([...(q.tags || []), ...tagsArr])] }));
          }
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
      const tags = prompt("Enter default tags for these questions (comma separated, optional):") || "";
      const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean);
      
      const res = await verifyApi.importFromUrl(url);
      let newQs = res.data.data;
      if (Array.isArray(newQs) && newQs.length > 0) {
        if (tagsArr.length > 0) {
          newQs = newQs.map(q => ({ ...q, tags: [...new Set([...(q.tags || []), ...tagsArr])] }));
        }
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

  const handleBankFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBankFileUploading(true);
    const toastId = toast.loading('Extracting questions...');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await verifyApi.importQuestions(formData);
      let newQs = res.data.data || [];
      if (newQs.length > 0) {
        const tags = prompt("Enter default tags for these questions (comma separated, optional):") || "";
        const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean);
        if (tagsArr.length > 0) newQs = newQs.map(q => ({ ...q, tags: [...new Set([...(q.tags || []), ...tagsArr])] }));
        setBankImportPreview(newQs);
        toast.success(`Extracted ${newQs.length} questions! Please review.`, { id: toastId });
      } else {
        toast.error("No questions extracted.", { id: toastId });
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to extract file', { id: toastId });
    }
    setBankFileUploading(false);
    e.target.value = '';
  };

  const handleBankUrlImport = async () => {
    const url = prompt("Enter URL to extract questions into the Bank:");
    if (!url) return;
    try { new URL(url); } catch { toast.error('Please enter a valid URL'); return; }
    
    setBankFileUploading(true);
    const toastId = toast.loading('Scraping URL...', { id: 'bank_url' });
    try {
      const tags = prompt("Enter tags (comma separated, optional):") || "";
      const tagsArr = tags.split(',').map(t => t.trim()).filter(Boolean);
      const res = await verifyApi.importFromUrl(url);
      let newQs = res.data.data || [];
      if (newQs.length > 0) {
         if (tagsArr.length > 0) newQs = newQs.map(q => ({ ...q, tags: [...new Set([...(q.tags || []), ...tagsArr])] }));
         setBankImportPreview(newQs);
         toast.success(`Extracted ${newQs.length} questions! Please review.`, { id: 'bank_url' });
      } else {
         toast.error("No questions extracted.", { id: 'bank_url' });
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to import URL', { id: 'bank_url' });
    }
    setBankFileUploading(false);
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

          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={openBankModal} disabled={loading}>
            <Database size={14} /> From Bank
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

      {bankModal && (
        <div className="modal-overlay">
          <div className="modal card animate-scale-in" style={{maxWidth:700}}>
            <div className="card-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h3><Database size={16} style={{verticalAlign:'middle',marginRight:6}}/>Question Bank</h3>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <label className={`btn btn-sm btn-secondary ${bankFileUploading ? 'disabled' : ''}`} style={{cursor:bankFileUploading?'not-allowed':'pointer', display:'flex', alignItems:'center', gap:4}}>
                  {bankFileUploading ? <Loader2 size={13} className="animate-spin"/> : <Upload size={13}/>} File
                  <input type="file" style={{display:'none'}} accept=".pdf,.doc,.docx,.txt,.csv,.json" onChange={handleBankFileUpload} disabled={bankFileUploading} />
                </label>
                <button className="btn btn-sm btn-secondary" onClick={handleBankUrlImport} disabled={bankFileUploading} style={{display:'flex', alignItems:'center', gap:4}}>
                  <LinkIcon size={13}/> URL
                </button>
                <button
                  className={`btn btn-sm ${showBankAddForm ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => setShowBankAddForm(v => !v)}
                  style={{display:'flex',alignItems:'center',gap:5}}
                  disabled={bankFileUploading}
                >
                  {showBankAddForm ? <X size={13}/> : <PlusCircle size={13}/>}
                  {showBankAddForm ? 'Cancel' : 'Manual Add'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setBankModal(false); setShowBankAddForm(false); }}>✕</button>
              </div>
            </div>
            <div className="card-body">

              {bankImportPreview ? (
                <div style={{animation:'fadeIn .2s ease'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
                    <h4 style={{margin:0,color:'var(--primary)'}}>Review Imported Questions</h4>
                    <div style={{display:'flex',gap:8}}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setBankImportPreview(null)}>Discard</button>
                      <button className="btn btn-primary btn-sm" onClick={async () => {
                        const toastId = toast.loading('Saving to Bank...');
                        try {
                          for (const q of bankImportPreview) {
                            await verifyApi.createBankItem(q);
                          }
                          toast.success(`Saved ${bankImportPreview.length} questions to Bank!`, { id: toastId });
                          setBankImportPreview(null);
                          setBankLoading(true);
                          const r = await verifyApi.listQuestionBank();
                          setBankItems(r.data.data || []);
                          setBankLoading(false);
                        } catch (err) {
                          toast.error('Some questions failed to save', { id: toastId });
                        }
                      }}>Save {bankImportPreview.length} Questions to Bank</button>
                    </div>
                  </div>
                  <div style={{maxHeight:500,overflowY:'auto',paddingRight:8}}>
                    {bankImportPreview.map((q, i) => (
                      <QuestionForm 
                        key={i} 
                        q={q} 
                        index={i} 
                        onChange={(k, v) => setBankImportPreview(qs => qs.map((x,idx) => idx === i ? {...x, [k]: v} : x))}
                        onRemove={() => setBankImportPreview(qs => qs.filter((_,idx) => idx !== i))}
                        onAutoGenerate={handlePreviewAutoGenerate}
                        generating={generatingFor === `bank-prev-${i}`}
                      />
                    ))}
                    {bankImportPreview.length === 0 && <div style={{textAlign:'center',padding:20}}>No questions left.</div>}
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Inline Add-to-Bank Form ─────────────────────────────── */}
                  {showBankAddForm && (
                <div style={{background:'var(--bg-hover)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:16,marginBottom:16,animation:'fadeIn .2s ease'}}>
                  <div style={{fontWeight:700,fontSize:'0.85rem',marginBottom:12,color:'var(--primary)'}}>➕ New Bank Question</div>
                  <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:10}}>
                    <div>
                      <label className="form-label" style={{fontSize:'0.78rem'}}>Type</label>
                      <select className="form-control" value={bankAddForm.question_type} onChange={e => setBankAddForm(f=>({...f,question_type:e.target.value,correct_answer:'',options:['','','','']}))}
                        style={{fontSize:'0.82rem'}}>
                        {QUESTION_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label" style={{fontSize:'0.78rem'}}>Marks</label>
                      <input type="number" className="form-control" min={0.5} step={0.5} value={bankAddForm.marks}
                        onChange={e=>setBankAddForm(f=>({...f,marks:parseFloat(e.target.value)||1}))} style={{fontSize:'0.82rem'}}/>
                    </div>
                  </div>
                  <div style={{marginBottom:10}}>
                    <label className="form-label" style={{fontSize:'0.78rem'}}>Question Text *</label>
                    <textarea className="form-control" rows={2} placeholder="Enter your question…" value={bankAddForm.question_text}
                      onChange={e=>setBankAddForm(f=>({...f,question_text:e.target.value}))} style={{fontSize:'0.82rem'}}/>
                  </div>
                  {(bankAddForm.question_type==='mcq'||bankAddForm.question_type==='mcq_multi') && (
                    <div style={{marginBottom:10}}>
                      <label className="form-label" style={{fontSize:'0.78rem'}}>Options (check correct)</label>
                      {bankAddForm.options.map((opt,oi)=>(
                        <div key={oi} style={{display:'flex',gap:8,marginBottom:6}}>
                          <input type={bankAddForm.question_type==='mcq'?'radio':'checkbox'} name="bankcorrect"
                            checked={bankAddForm.question_type==='mcq'?bankAddForm.correct_answer===opt:(() => { try { return JSON.parse(bankAddForm.correct_answer||'[]').includes(opt); } catch { return false; } })()}
                            onChange={()=>{
                              if(bankAddForm.question_type==='mcq') setBankAddForm(f=>({...f,correct_answer:opt}));
                              else { try { let a=JSON.parse(bankAddForm.correct_answer||'[]'); a=a.includes(opt)?a.filter(x=>x!==opt):[...a,opt]; setBankAddForm(f=>({...f,correct_answer:JSON.stringify(a)})); } catch { setBankAddForm(f=>({...f,correct_answer:JSON.stringify([opt])})); } }
                            }}
                            style={{accentColor:'var(--primary)',marginTop:8}}/>
                          <input className="form-control" value={opt} placeholder={`Option ${String.fromCharCode(65+oi)}`} style={{fontSize:'0.82rem'}}
                            onChange={e=>{const o=[...bankAddForm.options];o[oi]=e.target.value;setBankAddForm(f=>({...f,options:o}));}}/>
                          <button className="btn btn-ghost btn-sm" onClick={()=>setBankAddForm(f=>({...f,options:f.options.filter((_,i)=>i!==oi)}))}><Trash2 size={13}/></button>
                        </div>
                      ))}
                      <button className="btn btn-secondary btn-sm" onClick={()=>setBankAddForm(f=>({...f,options:[...f.options,'']}))}>+ Option</button>
                    </div>
                  )}
                  <div style={{marginBottom:10}}>
                    <label className="form-label" style={{fontSize:'0.78rem'}}><Tag size={11} style={{verticalAlign:'middle',marginRight:3}}/>Tags (press Enter)</label>
                    <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:5}}>
                      {bankAddForm.tags.map((tag,ti)=>(
                        <span key={ti} style={{display:'inline-flex',alignItems:'center',gap:3,background:'var(--primary-lightest)',color:'var(--primary)',borderRadius:999,padding:'2px 8px',fontSize:'0.7rem',fontWeight:600}}>
                          {tag}<button onClick={()=>setBankAddForm(f=>({...f,tags:f.tags.filter((_,i)=>i!==ti)}))} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',padding:0,display:'flex'}}><X size={10}/></button>
                        </span>
                      ))}
                    </div>
                    <input className="form-control" value={bankAddForm.tagInput} placeholder="e.g. Java, English" style={{fontSize:'0.82rem'}}
                      onChange={e=>setBankAddForm(f=>({...f,tagInput:e.target.value}))}
                      onKeyDown={e=>{ if(e.key==='Enter'&&bankAddForm.tagInput.trim()){ e.preventDefault(); const tag=bankAddForm.tagInput.trim(); if(!bankAddForm.tags.includes(tag)) setBankAddForm(f=>({...f,tags:[...f.tags,tag],tagInput:''})); else setBankAddForm(f=>({...f,tagInput:''})); }}}/>
                  </div>
                  <div style={{display:'flex',justifyContent:'flex-end'}}>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={bankAddSaving || !bankAddForm.question_text.trim()}
                      onClick={saveBankAddForm}
                    >{bankAddSaving ? 'Saving…' : (editBankItemId ? 'Update Question' : 'Save to Bank')}</button>
                  </div>
                </div>
              )}

              {/* ── Search + list ───────────────────────────────────────── */}
              {!showBankAddForm && (
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <input className="form-control" placeholder="Search questions..." value={bankSearch} onChange={e => setBankSearch(e.target.value)} style={{flex:1}} />
                  <button className="btn btn-ghost btn-sm" onClick={() => setBankSelected(bankItems.map(i=>i.id))}>Select All</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBankSelected([])}>Clear</button>
                </div>
              )}
              {bankLoading ? <div className="spinner" style={{margin:'24px auto'}}/> : (() => {
                const filteredBankItems = bankItems.filter(i => !bankSearch || i.question_text.toLowerCase().includes(bankSearch.toLowerCase()));
                if (filteredBankItems.length === 0) {
                  return (
                    <div style={{maxHeight:300,overflowY:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius)'}}>
                      <div style={{padding:32,textAlign:'center',color:'var(--text-muted)'}}>
                        <Database size={32} style={{opacity:0.3,marginBottom:10}}/>
                        <div style={{fontWeight:600,marginBottom:6}}>{bankSearch ? 'No matches found' : 'Bank is empty'}</div>
                        {!bankSearch && (
                          <>
                            <div style={{fontSize:'0.82rem',marginBottom:12}}>Add questions using the button above, or visit the Question Bank page.</div>
                            <button className="btn btn-primary btn-sm" onClick={()=>setShowBankAddForm(true)}>
                              <PlusCircle size={13}/> Add First Question
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                }

                const allBankTags = [...new Set(filteredBankItems.flatMap(q => q.tags || []))].sort();
                const untaggedBankQs = filteredBankItems.filter(q => !q.tags || q.tags.length === 0);
                
                const groupByType = (qs) => {
                  const types = [...new Set(qs.map(q => q.question_type))].sort();
                  return types.map(type => ({ type, items: qs.filter(q => q.question_type === type) }));
                };

                const taggedBankGroups = allBankTags.map(tag => ({
                  tag, typeGroups: groupByType(filteredBankItems.filter(q => (q.tags || []).includes(tag)))
                }));
                const untaggedBankTypeGroups = groupByType(untaggedBankQs);

                const renderItem = (item) => (
                  <label key={item.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'8px 12px',borderBottom:'1px solid var(--border-light)',cursor:'pointer',margin:0,background:'var(--bg-card)'}}>
                    <input type="checkbox" checked={bankSelected.includes(item.id)} onChange={e => setBankSelected(prev => e.target.checked ? [...prev,item.id] : prev.filter(x=>x!==item.id))} style={{marginTop:3,accentColor:'var(--primary)'}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'0.85rem',fontWeight:500,marginBottom:2,lineHeight:1.4}}>{item.question_text.slice(0,120)}{item.question_text.length>120?'…':''}</div>
                      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                        <span className="badge badge-muted" style={{fontSize:'0.6rem',padding:'2px 6px'}}>{item.marks} mark{item.marks!==1?'s':''}</span>
                        {(item.tags||[]).map(t => <span key={t} className="badge badge-primary" style={{fontSize:'0.6rem',padding:'2px 6px'}}>{t}</span>)}
                      </div>
                    </div>
                    <div style={{display:'flex', gap:4, marginTop:-4}}>
                      <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--primary)',padding:4}} onClick={async (e) => {
                        e.preventDefault(); e.stopPropagation();
                        setEditBankItemId(item.id);
                        setBankAddForm({
                          question_text: item.question_text || '',
                          question_type: item.question_type || 'mcq',
                          options: item.options || ['', '', '', ''],
                          correct_answer: item.correct_answer || '',
                          marks: item.marks || 1,
                          tags: item.tags || [],
                          tagInput: '',
                          model_answer: item.model_answer || '',
                          starter_code: item.starter_code || '',
                          test_cases: item.test_cases || [],
                          programming_language: item.programming_language || ''
                        });
                        setShowBankAddForm(true);
                      }}>
                        <Edit2 size={14}/>
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{color:'var(--danger)',padding:4}} onClick={async (e) => {
                        e.preventDefault(); e.stopPropagation();
                        if (!window.confirm('Are you sure you want to permanently delete this question from the bank?')) return;
                        try {
                          await verifyApi.deleteBankItem(item.id);
                          setBankItems(prev => prev.filter(x => x.id !== item.id));
                          setBankSelected(prev => prev.filter(x => x !== item.id));
                          toast.success('Question deleted from bank');
                        } catch (err) {
                          toast.error('Failed to delete question');
                        }
                      }}>
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </label>
                );

                const renderTypeGroup = (typeGroup, isUntagged=false) => {
                  const allTypeIds = typeGroup.items.map(i=>i.id);
                  const allSelected = allTypeIds.every(id => bankSelected.includes(id));
                  return (
                    <div key={typeGroup.type} style={{marginBottom:8, marginLeft:12}}>
                      <label style={{display:'flex',alignItems:'center',gap:8,background:isUntagged ? 'var(--bg-hover)' : 'var(--bg-body)',padding:'4px 10px',borderLeft:'3px solid var(--border-light)',marginBottom:2,cursor:'pointer'}}>
                        <input 
                          type="checkbox" 
                          checked={allSelected} 
                          onChange={(e)=>{
                            if(e.target.checked) setBankSelected(prev => [...new Set([...prev, ...allTypeIds])]);
                            else setBankSelected(prev => prev.filter(id => !allTypeIds.includes(id)));
                          }}
                          style={{ accentColor: 'var(--primary)', transform: 'scale(0.85)' }}
                          title={`Select all ${typeGroup.type.replace('_', ' ')} questions in this group`}
                        />
                        <div style={{fontSize:'0.7rem',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase'}}>📄 Type: {typeGroup.type.replace('_', ' ')} ({typeGroup.items.length})</div>
                      </label>
                      <div style={{borderLeft:'1px solid var(--border-light)',marginLeft:6,paddingLeft:6}}>
                        {typeGroup.items.map(renderItem)}
                      </div>
                    </div>
                  );
                };

                return (
                  <div style={{maxHeight:350,overflowY:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius)',background:'var(--bg-hover)',padding:8}}>
                    {taggedBankGroups.map(group => {
                      const allTagIds = group.typeGroups.flatMap(tg => tg.items.map(i=>i.id));
                      const allSelected = allTagIds.every(id => bankSelected.includes(id));
                      return (
                        <div key={group.tag} style={{marginBottom:16,background:'var(--bg-card)',border:'1px solid var(--border-light)',borderRadius:6,overflow:'hidden'}}>
                          <label style={{display:'flex',alignItems:'center',gap:10,background:'var(--primary-lightest)',padding:'8px 12px',borderBottom:'1px solid var(--border-light)',margin:0,cursor:'pointer'}}>
                            <input 
                              type="checkbox" 
                              checked={allSelected} 
                              onChange={(e)=>{
                                if(e.target.checked) setBankSelected(prev => [...new Set([...prev, ...allTagIds])]);
                                else setBankSelected(prev => prev.filter(id => !allTagIds.includes(id)));
                              }}
                              style={{ accentColor: 'var(--primary)' }}
                              title={`Select all questions in ${group.tag}`}
                            />
                            <div style={{fontSize:'0.85rem',fontWeight:700,color:'var(--primary)'}}>🏷️ {group.tag} ({allTagIds.length} Questions)</div>
                          </label>
                          <div style={{padding:'8px 0'}}>
                            {group.typeGroups.map(tg => renderTypeGroup(tg, false))}
                          </div>
                        </div>
                      );
                    })}

                    {untaggedBankTypeGroups.length > 0 && (() => {
                      const allUntaggedIds = untaggedBankQs.map(q=>q.id);
                      const allSelected = allUntaggedIds.every(id => bankSelected.includes(id));
                      return (
                        <div style={{marginBottom:16,background:'var(--bg-card)',border:'1px dashed var(--border)',borderRadius:6,overflow:'hidden'}}>
                          <label style={{display:'flex',alignItems:'center',gap:10,background:'var(--bg-hover)',padding:'8px 12px',borderBottom:'1px solid var(--border-light)',margin:0,cursor:'pointer'}}>
                            <input 
                              type="checkbox" 
                              checked={allSelected} 
                              onChange={(e)=>{
                                if(e.target.checked) setBankSelected(prev => [...new Set([...prev, ...allUntaggedIds])]);
                                else setBankSelected(prev => prev.filter(id => !allUntaggedIds.includes(id)));
                              }}
                              style={{ accentColor: 'var(--primary)' }}
                              title="Select all untagged questions"
                            />
                            <div style={{fontSize:'0.85rem',fontWeight:700,color:'var(--text-muted)'}}>Untagged ({untaggedBankQs.length} Questions)</div>
                          </label>
                          <div style={{padding:'8px 0'}}>
                            {untaggedBankTypeGroups.map(tg => renderTypeGroup(tg, true))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
              <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:16}}>
                <button className="btn btn-ghost" onClick={() => { setBankModal(false); setShowBankAddForm(false); setBankImportPreview(null); }}>Cancel</button>
                <button className="btn btn-primary" onClick={addFromBank} disabled={bankSelected.length===0}>Add {bankSelected.length} Question{bankSelected.length!==1?'s':''} to Assessment</button>
              </div>
            </>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
