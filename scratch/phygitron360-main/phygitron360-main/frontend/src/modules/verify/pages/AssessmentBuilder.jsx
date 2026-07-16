import React, { useState, useEffect } from 'react';
import {
  Plus, Loader2, Save, Send, UploadCloud, Link as LinkIcon,
  Image as ImageIcon, Play, CheckCircle, Trash2, ArrowUp, ArrowDown,
  Wand2, Settings, List, Eye, Shuffle, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  isPositiveNumber,
  isValidUrl,
} from '../../../core/utils/validators';

const QUESTION_TYPES = [
  { id: 'mcq', label: 'Multiple Choice (Single)' },
  { id: 'mcq_multi', label: 'Multiple Choice (Multiple Correct)' },
  { id: 'written', label: 'Written Answer' },
  { id: 'coding', label: 'Coding Challenge' },
  { id: 'file_upload', label: 'File Upload' },
];

export default function AssessmentBuilder() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const asmId = params.get('id');

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Settings
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('Mixed');
  const [timeLimit, setTimeLimit] = useState(60);
  const [passScore, setPassScore] = useState(70);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [showResultImmediately, setShowResultImmediately] = useState(true);

  // Questions
  const [questions, setQuestions] = useState([]);
  
  // Modals
  const [showImportUrl, setShowImportUrl] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importingUrl, setImportingUrl] = useState(false);
  
  // Bank Import
  const [showBankImport, setShowBankImport] = useState(false);
  const [bankQuestions, setBankQuestions] = useState([]);
  const [loadingBank, setLoadingBank] = useState(false);

  const fetchBankQuestions = async () => {
    setLoadingBank(true);
    try {
      const r = await fetch('/api/verify/question-bank', { credentials: 'include' });
      const d = await r.json();
      setBankQuestions(d.data || []);
    } catch {
      toast.error('Failed to load bank questions');
    } finally {
      setLoadingBank(false);
    }
  };

  useEffect(() => {
    if (showBankImport && bankQuestions.length === 0) {
      fetchBankQuestions();
    }
  }, [showBankImport]);

  useEffect(() => {
    if (asmId) {
      setLoading(true);
      fetch(`/api/verify/builder/assessments/${asmId}`)
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            const asm = d.data;
            setTitle(asm.title);
            setDescription(asm.description || '');
            setType(asm.type);
            setTimeLimit(asm.time_limit_minutes);
            setPassScore(asm.pass_score);
            setShuffleQuestions(asm.shuffle_questions);
            setShowResultImmediately(asm.show_result_immediately);
            setQuestions(asm.questions || []);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [asmId]);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: `temp_${Date.now()}`,
        question_type: 'mcq',
        question_text: '',
        marks: 1.0,
        options: ['', ''],
        correct_answer: '',
        model_answer: '',
        programming_language: 'python',
        starter_code: '',
        test_cases: [],
      }
    ]);
  };

  const updateQuestion = (index, field, value) => {
    const newQs = [...questions];
    newQs[index] = { ...newQs[index], [field]: value };
    setQuestions(newQs);
  };

  const removeQuestion = (index) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const moveQuestion = (index, direction) => {
    if (direction === 'up' && index > 0) {
      const newQs = [...questions];
      [newQs[index - 1], newQs[index]] = [newQs[index], newQs[index - 1]];
      setQuestions(newQs);
    } else if (direction === 'down' && index < questions.length - 1) {
      const newQs = [...questions];
      [newQs[index + 1], newQs[index]] = [newQs[index], newQs[index + 1]];
      setQuestions(newQs);
    }
  };

  const handleImportUrl = async (e) => {
    e.preventDefault();
    if (!importUrl) return;
    if (!isValidUrl(importUrl)) {
      toast.error('Enter a valid http:// or https:// URL');
      return;
    }
    setImportingUrl(true);
    try {
      const r = await fetch('/api/verify/builder/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl })
      });
      const d = await r.json();
      if (r.ok && d.success) {
        setQuestions([...questions, ...d.data]);
        setShowImportUrl(false);
        setImportUrl('');
        toast.success('Questions imported!');
      } else {
        toast.error(d.detail || 'Import failed');
      }
    } catch (e) {
      toast.error('Import failed');
    } finally {
      setImportingUrl(false);
    }
  };

  const handleSave = async (publish = false) => {
    const validationError = validateAssessment(publish);
    if (validationError) return toast.error(validationError, { duration: 7000 });
    
    setSaving(true);
    const payload = {
      title,
      description,
      type,
      time_limit_minutes: timeLimit,
      pass_score: passScore,
      shuffle_questions: shuffleQuestions,
      show_result_immediately: showResultImmediately,
      questions: questions.map((q, i) => ({ ...q, order_index: i }))
    };

    try {
      let r, d;
      if (asmId) {
        r = await fetch(`/api/verify/builder/assessments/${asmId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        d = await r.json();
      } else {
        r = await fetch('/api/verify/builder/assessments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        d = await r.json();
      }

      if (r.ok && d.success) {
        const newId = asmId || d.data.id;
        if (publish) {
          const pr = await fetch(`/api/verify/builder/assessments/${newId}/publish`, {
            method: 'POST'
          });
          if (pr.ok) {
            toast.success('Assessment published!');
            navigate('/verify?tab=manage');
            return;
          }
        }
        toast.success('Assessment saved!');
        if (!asmId) navigate(`/verify?tab=builder&id=${newId}`);
      } else {
        toast.error(d.detail || 'Save failed');
      }
    } catch (e) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const validateAssessment = (publish) => {
    if (!title.trim()) return 'Title is required.';
    if (timeLimit !== '' && (!Number.isFinite(Number(timeLimit)) || Number(timeLimit) < 1 || Number(timeLimit) > 600)) {
      return 'Time limit must be between 1 and 600 minutes.';
    }
    if (!Number.isFinite(Number(passScore)) || Number(passScore) < 0 || Number(passScore) > 100) {
      return 'Pass score must be between 0 and 100.';
    }
    if (questions.length === 0 && publish) return 'Add questions before publishing.';

    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      const label = `Question ${i + 1}`;
      if (!q.question_text?.trim()) return `${label}: question text is required.`;
      if (!isPositiveNumber(q.marks || 0)) return `${label}: marks must be greater than 0.`;
      if (q.question_type === 'mcq') {
        const filledOptions = (q.options || []).filter(opt => String(opt || '').trim());
        if (filledOptions.length < 2) return `${label}: MCQ needs at least 2 options.`;
        if (!q.correct_answer || !filledOptions.includes(q.correct_answer)) return `${label}: select a correct MCQ answer.`;
      }
      if (q.question_type === 'coding') {
        const validTests = (q.test_cases || []).filter(tc => String(tc.expected_output ?? '').trim());
        if (validTests.length < 3) return `${label}: coding questions need at least 3 expected outputs.`;
      }
      if (q.question_type === 'written' && publish && !q.model_answer?.trim()) {
        return `${label}: add a model answer before publishing written questions.`;
      }
    }
    return '';
  };

  if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-purple-600" /></div>;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Assessment Builder</h2>
          <p className="text-sm text-gray-500 mt-1">Create and configure skills assessments</p>
        </div>
        <div className="flex gap-2">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">
              Back
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} className="px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm">
              Next Step
            </button>
          ) : (
            <>
              <button onClick={() => handleSave(false)} disabled={saving} className="px-6 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2">
                <Save size={14} /> Draft
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm">
                <Send size={14} /> Publish
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex gap-4">
        {[
          { icon: Settings, label: 'Settings' },
          { icon: List, label: 'Questions' },
          { icon: Eye, label: 'Review' }
        ].map((s, i) => (
          <div key={i} className={`flex-1 flex items-center gap-3 p-4 rounded-xl border ${step === i + 1 ? 'bg-purple-50 border-purple-300 text-purple-700' : 'bg-white border-gray-200 text-gray-500'}`}>
            <s.icon size={18} />
            <span className="text-xs font-semibold uppercase tracking-wider">Step {i + 1}: {s.label}</span>
          </div>
        ))}
      </div>

      {/* STEP 1: Settings */}
      {step === 1 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm space-y-6">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Title</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" placeholder="e.g. Senior Frontend Developer Assessment" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all min-h-[100px]" placeholder="Brief description of the assessment..." />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Assessment Type</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all">
                <option value="Mixed">Mixed</option>
                <option value="MCQ">Multiple Choice Only</option>
                <option value="Coding">Coding Only</option>
                <option value="Written">Written Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Time Limit (Minutes)</label>
              <input type="number" value={timeLimit} onChange={e => setTimeLimit(parseInt(e.target.value) || 0)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Pass Score (%)</label>
              <input type="number" value={passScore} onChange={e => setPassScore(parseInt(e.target.value) || 0)} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all" />
            </div>
          </div>
          <div className="flex gap-6 pt-4 border-t border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={shuffleQuestions} onChange={e => setShuffleQuestions(e.target.checked)} className="hidden" />
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${shuffleQuestions ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white group-hover:border-purple-400'}`}>
                <CheckCircle size={12} />
              </div>
              <span className="text-xs font-medium text-gray-700">Shuffle Questions</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <input type="checkbox" checked={showResultImmediately} onChange={e => setShowResultImmediately(e.target.checked)} className="hidden" />
              <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${showResultImmediately ? 'bg-purple-600 border-purple-600 text-white' : 'border-gray-300 bg-white group-hover:border-purple-400'}`}>
                <CheckCircle size={12} />
              </div>
              <span className="text-xs font-medium text-gray-700">Show Result Immediately</span>
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: Questions */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="flex gap-3">
            <button onClick={addQuestion} className="px-4 py-3 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-100 transition-colors flex items-center gap-2">
              <Plus size={14} /> Add Question
            </button>
            <button onClick={() => setShowBankImport(true)} className="px-4 py-3 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-2">
              <List size={14} /> Import from Bank
            </button>
            <button onClick={() => setShowImportUrl(true)} className="px-4 py-3 rounded-xl bg-gray-50 text-gray-600 border border-gray-200 text-xs font-medium hover:bg-gray-100 transition-colors flex items-center gap-2">
              <LinkIcon size={14} /> Import from URL
            </button>
          </div>

          {questions.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-400 font-medium">No questions added yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {questions.map((q, i) => (
                <div key={q.id || i} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm border-l-4 border-l-purple-600 relative group">
                  <div className="absolute right-4 top-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => moveQuestion(i, 'up')} disabled={i === 0} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-30"><ArrowUp size={14}/></button>
                    <button onClick={() => moveQuestion(i, 'down')} disabled={i === questions.length - 1} className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 disabled:opacity-30"><ArrowDown size={14}/></button>
                    <button onClick={() => removeQuestion(i)} className="p-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600"><Trash2 size={14}/></button>
                  </div>

                  <div className="flex gap-4 mb-4 pr-32">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-lg text-gray-600 shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="flex gap-4 flex-wrap">
                        <select value={q.question_type} onChange={e => updateQuestion(i, 'question_type', e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400">
                          {QUESTION_TYPES.map(qt => <option key={qt.id} value={qt.id}>{qt.label}</option>)}
                        </select>
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-gray-500">Marks:</span>
                          <input type="number" value={q.marks || 1} onChange={e => updateQuestion(i, 'marks', parseFloat(e.target.value) || 0)} className="bg-transparent w-12 text-sm text-gray-700 outline-none text-right" />
                        </div>
                      </div>

                      <textarea
                        value={q.question_text}
                        onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                        placeholder="Enter question text..."
                        className="w-full bg-transparent border-b border-gray-200 focus:border-purple-400 outline-none py-2 text-sm text-gray-700 resize-none min-h-[60px]"
                      />

                      {/* Type-specific UI */}
                      {(q.question_type === 'mcq' || q.question_type === 'mcq_multi') && (
                        <div className="space-y-2 mt-4 pl-4 border-l border-gray-200">
                          {(q.options || []).map((opt, oIdx) => (
                            <div key={oIdx} className="flex items-center gap-3">
                              <input
                                type={q.question_type === 'mcq' ? 'radio' : 'checkbox'}
                                name={`correct_${i}`}
                                checked={q.question_type === 'mcq' ? (q.correct_answer === opt && opt !== '') : ((q.correct_answer || '').includes(opt) && opt !== '')}
                                onChange={(e) => {
                                  if (q.question_type === 'mcq') {
                                    updateQuestion(i, 'correct_answer', opt);
                                  } else {
                                    let curr = q.correct_answer ? q.correct_answer.split('|||') : [];
                                    if (e.target.checked) curr.push(opt);
                                    else curr = curr.filter(c => c !== opt);
                                    updateQuestion(i, 'correct_answer', curr.join('|||'));
                                  }
                                }}
                                className={`w-4 h-4 accent-purple-600 ${q.question_type === 'mcq_multi' ? 'rounded' : ''}`}
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={e => {
                                  const newOpts = [...(q.options || [])];
                                  newOpts[oIdx] = e.target.value;
                                  updateQuestion(i, 'options', newOpts);
                                  // Simplified correct answer updates on option text change for demo
                                  if (q.question_type === 'mcq' && q.correct_answer === opt) updateQuestion(i, 'correct_answer', e.target.value);
                                }}
                                placeholder={`Option ${oIdx + 1}`}
                                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400"
                              />
                              <button onClick={() => updateQuestion(i, 'options', q.options.filter((_, idx) => idx !== oIdx))} className="text-gray-400 hover:text-rose-600"><X size={14}/></button>
                            </div>
                          ))}
                          <button onClick={() => updateQuestion(i, 'options', [...(q.options || []), ''])} className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors mt-2">
                            + Add Option
                          </button>
                        </div>
                      )}

                      {q.question_type === 'coding' && (
                        <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex gap-4 items-center flex-wrap">
                            <select value={q.programming_language || 'python'} onChange={e => updateQuestion(i, 'programming_language', e.target.value)} className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 outline-none focus:border-purple-400">
                              <option value="python">Python</option>
                              <option value="javascript">JavaScript</option>
                              <option value="java">Java</option>
                              <option value="cpp">C++</option>
                            </select>
                            <button className="flex items-center gap-2 text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-100">
                              <Wand2 size={12} /> Generate Template
                            </button>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2">Starter Code</label>
                            <textarea
                              value={q.starter_code || ''}
                              onChange={e => updateQuestion(i, 'starter_code', e.target.value)}
                              className="w-full bg-white border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-700 outline-none focus:border-purple-400 min-h-[120px]"
                              placeholder="def solve(x):\n    pass"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-2 flex justify-between">
                              <span>Test Cases</span>
                              <button onClick={() => updateQuestion(i, 'test_cases', [...(q.test_cases || []), {input: '', expected_output: ''}])} className="text-purple-600 hover:text-purple-800 text-xs font-medium">+ Add Test</button>
                            </label>
                            <div className="space-y-2">
                              {(q.test_cases || []).map((tc, tIdx) => (
                                <div key={tIdx} className="flex gap-2 items-start bg-white p-2 rounded-lg border border-gray-200">
                                  <textarea value={tc.input} onChange={e => {
                                    const tcs = [...q.test_cases]; tcs[tIdx].input = e.target.value; updateQuestion(i, 'test_cases', tcs);
                                  }} placeholder="Input" className="flex-1 bg-gray-50 border border-gray-200 rounded p-2 text-sm font-mono text-gray-700 outline-none focus:border-purple-400 h-16 resize-none" />
                                  <textarea value={tc.expected_output} onChange={e => {
                                    const tcs = [...q.test_cases]; tcs[tIdx].expected_output = e.target.value; updateQuestion(i, 'test_cases', tcs);
                                  }} placeholder="Expected Output" className="flex-1 bg-gray-50 border border-gray-200 rounded p-2 text-sm font-mono text-gray-700 outline-none focus:border-purple-400 h-16 resize-none" />
                                  <button onClick={() => updateQuestion(i, 'test_cases', q.test_cases.filter((_, idx) => idx !== tIdx))} className="p-2 text-gray-400 hover:text-rose-600"><Trash2 size={14}/></button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {q.question_type === 'written' && (
                        <div className="mt-4">
                          <label className="block text-xs font-medium text-gray-600 mb-2">Model Answer (for AI Grading)</label>
                          <textarea
                            value={q.model_answer || ''}
                            onChange={e => updateQuestion(i, 'model_answer', e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all min-h-[80px]"
                            placeholder="Expected points to cover..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* STEP 3: Review */}
      {step === 3 && (
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
            <p className="text-sm text-gray-500 mt-2">{description}</p>
            <div className="flex justify-center gap-4 mt-6">
              <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">{type}</span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">{timeLimit} Mins</span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-xs font-medium text-gray-600">{questions.length} Questions</span>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Question Summary</h3>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-4">
                    <span className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">{i+1}</span>
                    <span className="text-sm text-gray-700 line-clamp-1">{q.question_text || '(Empty Question)'}</span>
                  </div>
                  <div className="flex gap-3">
                    <span className="text-xs font-medium text-purple-600">{q.question_type}</span>
                    <span className="text-xs font-medium text-gray-400">{q.marks} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowImportUrl(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-8 relative shadow-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowImportUrl(false)} className="absolute top-5 right-5 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <LinkIcon className="text-purple-600"/> Import from URL
            </h2>
            <form onSubmit={handleImportUrl}>
              <div className="mb-6">
                <label className="block text-xs font-medium text-gray-600 mb-2">URL</label>
                <input
                  type="url"
                  required
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  placeholder="https://leetcode.com/problems/two-sum/"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                />
              </div>
              <button type="submit" disabled={importingUrl} className="w-full py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50">
                {importingUrl ? <Loader2 className="animate-spin mx-auto" size={16} /> : 'Import Questions'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Bank Import Modal */}
      {showBankImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowBankImport(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-8 relative shadow-2xl border border-gray-200 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowBankImport(false)} className="absolute top-5 right-5 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
              <List className="text-indigo-600"/> Import from Bank
            </h2>
            <div className="flex-1 overflow-y-auto min-h-[300px]">
              {loadingBank ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-indigo-600" /></div>
              ) : bankQuestions.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No questions found in bank.</div>
              ) : (
                <div className="space-y-3">
                  {bankQuestions.map(bq => (
                    <div key={bq.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{bq.question_text}</p>
                        <span className="text-xs text-gray-500 mt-1 block uppercase">{bq.question_type} | {bq.marks} pts</span>
                      </div>
                      <button onClick={() => {
                        setQuestions([...questions, { ...bq, id: `bank_${bq.id}_${Date.now()}` }]);
                        toast.success('Question added');
                      }} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-semibold hover:bg-indigo-100">
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
