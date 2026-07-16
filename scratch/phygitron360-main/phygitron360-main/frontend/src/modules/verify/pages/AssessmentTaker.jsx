import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Shield, AlertTriangle, CheckCircle, Clock, Play,
  ChevronRight, ChevronLeft, Send, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  isValidEmail,
  isValidPhone,
  isValidURL,
  isPositiveNumber
} from '../../../core/utils/validators';

export default function AssessmentTaker({ assessmentId: propAsmId }) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const asmId = propAsmId || params.get('asm_id');

  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // States
  const [step, setStep] = useState('setup'); // setup, taking, finished
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef(null);

  // Test state
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [proctoringEvents, setProctoringEvents] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const startTimeRef = useRef(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!asmId) return;
    setLoading(true);
    fetch(`/api/verify/builder/assessments/${asmId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setAssessment(d.data);
          setTimeLeft(d.data.time_limit_minutes * 60);
        } else {
          toast.error('Failed to load assessment');
        }
      })
      .finally(() => setLoading(false));
  }, [asmId]);

  // Timer
  useEffect(() => {
    if (step === 'taking' && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timer);
            handleSubmit(true);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, timeLeft]);

  // Proctoring basic checks (tab switch, fullscreen exit)
  useEffect(() => {
    if (step !== 'taking') return;
    const handleProctoringViolation = async (type, detailStr) => {
      setProctoringEvents(prev => [...prev, {
        type: type,
        timestamp: new Date().toISOString(),
        details: detailStr
      }]);
      toast.error(`Warning: ${detailStr} recorded!`, { icon: '⚠️' });
      try {
        const r = await fetch(`/api/verify/assignments/${asmId}/record-strike`, {
          method: 'POST', credentials: 'include'
        });
        const d = await r.json();
        if (d.data?.terminated_by_proctor) {
          toast.error('Assessment terminated due to excessive proctoring violations.', { duration: 5000 });
          handleSubmit(true);
        }
      } catch(e){}
    };

    const handleVisibility = () => {
      if (document.hidden) handleProctoringViolation('tab_switch', 'Tab switching');
    };
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) handleProctoringViolation('fullscreen_exit', 'Exiting fullscreen');
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [step, asmId]);

  const requestCamera = async () => {
    try {
      setCameraError('');
      const str = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(str);
      if (videoRef.current) {
        videoRef.current.srcObject = str;
      }
    } catch (e) {
      setCameraError('Camera and Microphone access denied or unavailable. This assessment requires both to proceed.');
    }
  };

  const startAssessment = async () => {
    if (!stream) {
      toast.error('Camera & Mic access required to start');
      return;
    }
    try {
      const r = await fetch(`/api/verify/assignments/${asmId}/start-session`, {
        method: 'POST',
        credentials: 'include'
      });
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log('Fullscreen rejected by browser', e));
      }
      setStep('taking');
      startTimeRef.current = Date.now();
    } catch (e) {
      toast.error('Failed to start session');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  // ── Validation for submission ──
  const validateAnswers = () => {
    const newErrors = {};
    
    if (!assessment || !assessment.questions) return true;

    assessment.questions.forEach((q, index) => {
      const answer = answers[q.id];
      
      // Check if question requires an answer (all questions are required in this context)
      if (!answer || (typeof answer === 'string' && !answer.trim())) {
        newErrors[q.id] = `Question ${index + 1} requires an answer`;
      }
      
      // For file upload questions, validate file type/size
      if (q.question_type === 'file_upload') {
        if (answer instanceof File) {
          const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
          const maxSize = 10 * 1024 * 1024; // 10MB
          
          if (!allowedTypes.includes(answer.type)) {
            newErrors[q.id] = `File type not allowed for Question ${index + 1}. Please upload PDF, JPEG, PNG, WebP, DOC, or DOCX.`;
          }
          if (answer.size > maxSize) {
            newErrors[q.id] = `File size exceeds 10MB limit for Question ${index + 1}`;
          }
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (autoSubmit = false) => {
    if (!autoSubmit && !window.confirm('Are you sure you want to submit?')) return;
    
    // ── Run validation before submit ──
    if (!autoSubmit && !validateAnswers()) {
      const firstError = Object.keys(errors)[0];
      if (firstError) {
        toast.error(errors[firstError]);
        // Find the question index and scroll to it
        const questionIndex = assessment.questions.findIndex(q => q.id === firstError);
        if (questionIndex !== -1) setCurrentQ(questionIndex);
      }
      return;
    }
    
    setIsSubmitting(true);
    stopCamera();

    const timeTaken = startTimeRef.current ? Math.floor((Date.now() - startTimeRef.current) / 1000) : 0;
    const isMalpractice = proctoringEvents.length > 5;

    try {
      const r = await fetch('/api/verify/submissions/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_id: parseInt(asmId),
          answers,
          time_taken_seconds: timeTaken,
          proctoring_events: proctoringEvents,
          is_malpractice: isMalpractice
        })
      });
      const d = await r.json();
      if (r.ok && d.success) {
        toast.success('Assessment submitted successfully!');
        setStep('finished');
        if (assessment.show_result_immediately) {
          navigate(`/verify?tab=result&result_id=${d.data.result_id}`);
        } else {
          navigate('/verify?tab=candidate');
        }
      } else {
        toast.error(d.detail || 'Submission failed');
      }
    } catch (e) {
      toast.error('Failed to submit. Please contact support.');
    } finally {
      setIsSubmitting(false);
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.log(e));
      }
    }
  };

  // Helper to render error message
  const renderError = (questionId) => {
    if (errors[questionId]) {
      return <p className="text-red-500 text-xs font-medium mt-2">{errors[questionId]}</p>;
    }
    return null;
  };

  if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-purple-600" /></div>;
  if (!assessment) return <div className="p-10 text-center text-gray-400">Assessment not found</div>;

  if (step === 'setup') {
    return (
      <div className="max-w-2xl mx-auto flex flex-col gap-6 pt-10">
        <div className="text-center mb-4">
          <Shield size={40} className="text-purple-600 mx-auto mb-4 opacity-80" />
          <h1 className="text-3xl font-bold text-gray-800">{assessment.title}</h1>
          <p className="text-gray-500 mt-2">{assessment.description}</p>
        </div>
        
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-purple-600 border-b border-purple-200 pb-4">Proctoring Setup</h2>
          
          <div className="bg-gray-50 border border-gray-200 rounded-xl aspect-video relative overflow-hidden flex items-center justify-center">
            {stream ? (
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
            ) : (
              <div className="text-center">
                <Camera size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-xs font-medium text-gray-400">Camera Preview</p>
              </div>
            )}
            {!stream && (
              <button onClick={requestCamera} className="absolute bottom-6 px-6 py-3 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors text-xs font-medium">
                Enable Camera
              </button>
            )}
          </div>
          
          {cameraError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex gap-3 text-rose-600">
              <AlertTriangle size={18} className="shrink-0" />
              <p className="text-xs font-medium leading-relaxed">{cameraError}</p>
            </div>
          )}

          <ul className="space-y-3 text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-xl">
            <li className="flex gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0"/> Ensure you are in a well-lit room.</li>
            <li className="flex gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0"/> Do not switch tabs or minimize the window.</li>
            <li className="flex gap-2"><CheckCircle size={14} className="text-emerald-500 shrink-0"/> Time limit: {assessment.time_limit_minutes} minutes.</li>
          </ul>

          <button 
            onClick={startAssessment}
            disabled={!stream} 
            className="w-full py-4 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm disabled:opacity-50 disabled:hover:bg-purple-600"
          >
            Start Assessment
          </button>
        </div>
      </div>
    );
  }

  const q = assessment.questions[currentQ];
  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Top Bar */}
      <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-8 rounded border border-gray-200 overflow-hidden relative bg-gray-100">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1] opacity-50" />
            <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <h2 className="text-sm font-semibold text-gray-800 truncate max-w-sm">{assessment.title}</h2>
        </div>
        
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-sm font-bold ${timeLeft < 300 ? 'bg-rose-50 border-rose-200 text-rose-600' : 'bg-gray-100 border-gray-200 text-gray-700'}`}>
          <Clock size={16} />
          {mins.toString().padStart(2, '0')}:{secs.toString().padStart(2, '0')}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row">
        {/* Left Sidebar - Question List */}
        <div className="md:w-64 bg-gray-50 border-r border-gray-200 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Questions</h3>
          <div className="grid grid-cols-4 gap-2">
            {assessment.questions.map((_, i) => {
              const hasError = errors[assessment.questions[i].id];
              const isAnswered = answers[assessment.questions[i].id] && 
                (typeof answers[assessment.questions[i].id] === 'string' ? 
                  answers[assessment.questions[i].id].trim() : 
                  true);
              
              return (
                <button
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-colors relative ${
                    currentQ === i 
                      ? hasError ? 'bg-red-500 text-white' : 'bg-purple-600 text-white'
                      : isAnswered 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                        : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {i + 1}
                  {hasError && currentQ !== i && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">!</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Area */}
        <div className="flex-1 p-8">
          <div className="flex justify-between items-center mb-6">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${errors[q.id] ? 'bg-red-50 text-red-600 border-red-200' : 'bg-purple-50 text-purple-600 border-purple-200'}`}>
              Question {currentQ + 1} of {assessment.questions.length}
              {errors[q.id] && ' ⚠️'}
            </span>
            <span className="text-xs font-medium text-gray-500">
              {q.marks} Points | {q.question_type}
            </span>
          </div>

          <div className="mb-8">
            <p className="text-lg text-gray-800 leading-relaxed font-medium whitespace-pre-wrap">{q.question_text}</p>
            {renderError(q.id)}
          </div>

          {/* MCQ Answer Input */}
          {q.question_type === 'mcq' && (
            <div className="space-y-3">
              {(q.options || []).map((opt, i) => (
                <label key={i} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${answers[q.id] === opt ? 'bg-purple-50 border-purple-300 text-gray-800' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${answers[q.id] === opt ? 'border-purple-600' : 'border-gray-300'}`}>
                    {answers[q.id] === opt && <div className="w-2.5 h-2.5 rounded-full bg-purple-600" />}
                  </div>
                  <span className="text-sm font-medium">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {/* Written Answer Input */}
          {q.question_type === 'written' && (
            <textarea
              value={answers[q.id] || ''}
              onChange={e => {
                setAnswers({ ...answers, [q.id]: e.target.value });
                // Clear error for this question when user types
                if (errors[q.id]) {
                  const newErrors = { ...errors };
                  delete newErrors[q.id];
                  setErrors(newErrors);
                }
              }}
              placeholder="Type your answer here..."
              className={`w-full bg-gray-50 border ${errors[q.id] ? 'border-red-400' : 'border-gray-200'} rounded-xl p-5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all min-h-[300px] resize-y`}
            />
          )}

          {/* Coding Challenge Input */}
          {q.question_type === 'coding' && (
            <div className="flex flex-col h-[500px] border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
              <div className="bg-gray-100 px-4 py-2 flex justify-between items-center border-b border-gray-200">
                <span className="text-xs font-semibold text-purple-600">{q.programming_language}</span>
              </div>
              <textarea
                value={answers[q.id] !== undefined ? answers[q.id] : (q.starter_code || '')}
                onChange={e => {
                  setAnswers({ ...answers, [q.id]: e.target.value });
                  if (errors[q.id]) {
                    const newErrors = { ...errors };
                    delete newErrors[q.id];
                    setErrors(newErrors);
                  }
                }}
                className={`flex-1 bg-white p-4 text-sm font-mono text-gray-700 outline-none resize-none ${errors[q.id] ? 'border-2 border-red-400' : ''}`}
                spellCheck="false"
              />
            </div>
          )}
          
          {/* Bottom Navigation */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between">
            <button
              onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
              disabled={currentQ === 0}
              className="px-6 py-3 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:hover:bg-gray-100 flex items-center gap-2"
            >
              <ChevronLeft size={16} /> Previous
            </button>
            
            {currentQ === assessment.questions.length - 1 ? (
              <button
                onClick={() => handleSubmit()}
                disabled={isSubmitting}
                className="px-8 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <><Send size={16} /> Submit Assessment</>}
              </button>
            ) : (
              <button
                onClick={() => setCurrentQ(q => Math.min(assessment.questions.length - 1, q + 1))}
                className="px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm"
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}