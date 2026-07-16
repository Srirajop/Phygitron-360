import React, { useState, useEffect } from 'react';
import {
  Award, XCircle, Clock, Calendar, MessageSquare, Send, CheckCircle, ShieldAlert,
  Loader2, ChevronDown, ChevronUp, Bot, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';

export default function ResultScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const resultId = params.get('result_id');
  const { user } = useAuth();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Dispute/Query form
  const [showQuery, setShowQuery] = useState(false);
  const [querySubject, setQuerySubject] = useState('');
  const [queryMessage, setQueryMessage] = useState('');
  const [submittingQuery, setSubmittingQuery] = useState(false);

  // Expanded questions
  const [expandedQ, setExpandedQ] = useState({});

  useEffect(() => {
    if (!resultId) return;
    setLoading(true);
    fetch(`/api/verify/submissions/results/${resultId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const res = d.data;
          
          // Parse feedback JSON if it's a string
          if (typeof res.feedback === 'string') {
            try { res.feedback = JSON.parse(res.feedback); } catch(e) { res.feedback = {}; }
          }
          res.ai_summary = res.feedback?._ai_summary;
          
          // Parse scores_per_question into details array
          if (typeof res.scores_per_question === 'string') {
            try { res.scores_per_question = JSON.parse(res.scores_per_question); } catch(e) { res.scores_per_question = {}; }
          }
          
          // Match details to questions array
          const details = [];
          if (res.assessment?.questions) {
             res.assessment.questions.forEach(q => {
               const scoreObj = (res.scores_per_question || {})[q.id];
               if (scoreObj) {
                 details.push({
                   question_id: q.id,
                   score_awarded: scoreObj.score,
                   feedback: scoreObj.feedback,
                   answer_provided: scoreObj.answer_provided
                 });
               }
             });
          }
          res.details = details;
          
          setResult(res);
        } else toast.error('Failed to load result');
      })
      .catch(() => toast.error('Error loading result'))
      .finally(() => setLoading(false));
  }, [resultId]);

  const submitQuery = async (e) => {
    e.preventDefault();
    if (!queryMessage) return toast.error('Message required');
    setSubmittingQuery(true);
    try {
      const r = await fetch('/api/verify/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_result_id: parseInt(resultId),
          subject: querySubject || 'Result Dispute',
          message: queryMessage
        })
      });
      const d = await r.json();
      if (r.ok && d.success) {
        toast.success('Query submitted to HR');
        setShowQuery(false);
        setQueryMessage('');
        setQuerySubject('');
      } else {
        toast.error(d.detail || 'Submission failed');
      }
    } catch {
      toast.error('Failed to submit query');
    } finally {
      setSubmittingQuery(false);
    }
  };

  const toggleQ = (idx) => {
    setExpandedQ(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-purple-600" /></div>;
  if (!result) return <div className="p-10 text-center text-gray-400">Result not found. It may still be grading or you lack permission.</div>;

  const passed = result.score >= result.assessment.pass_score;
  const malpractice = result.is_malpractice;
  
  const scoreColor = malpractice ? 'text-rose-600' : passed ? 'text-emerald-600' : 'text-amber-600';
  const scoreBg = malpractice ? 'bg-rose-50 border-rose-200' : passed ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200';

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Assessment Result</h2>
          <p className="text-sm text-gray-500 mt-1">Detailed evaluation and feedback</p>
        </div>
        <button onClick={() => navigate('/verify')} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-sm font-medium hover:bg-gray-200 transition-colors">
          Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Score Card */}
        <div className={`md:col-span-2 bg-white rounded-2xl p-8 border-2 shadow-sm ${scoreBg}`}>
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">{result.assessment.title}</p>
              <h3 className="text-xl font-bold text-gray-800">{result.user_name}</h3>
            </div>
            {malpractice ? (
              <div className="px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <ShieldAlert size={14}/> Flagged
              </div>
            ) : passed ? (
              <div className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-2">
                <Award size={14}/> Passed
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-semibold flex items-center gap-2">
                <XCircle size={14}/> Failed
              </div>
            )}
          </div>

          <div className="flex items-end gap-4 mb-2">
            <span className={`text-5xl font-bold leading-none ${scoreColor}`}>
              {Math.round(result.score || 0)}%
            </span>
            <span className="text-sm font-medium text-gray-400 mb-2">
              Required: {result.assessment.pass_score}%
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-3 text-gray-600 text-sm">
              <Clock size={16} className="text-purple-400"/>
              {Math.floor(result.time_taken_seconds / 60)}m {result.time_taken_seconds % 60}s
            </div>
            <div className="flex items-center gap-3 text-gray-600 text-sm">
              <Calendar size={16} className="text-purple-400"/>
              {new Date(result.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* AI Summary Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 mb-4 text-xs font-semibold uppercase tracking-wider text-purple-600">
            <Bot size={14} /> AI Evaluation
          </div>
          {result.ai_summary ? (
            <p className="text-sm text-gray-600 leading-relaxed overflow-y-auto">{result.ai_summary}</p>
          ) : (
            <p className="text-sm text-gray-400 italic">No summary generated.</p>
          )}
          
          {user?.id === result.user_id && (
            <div className="mt-auto pt-4 border-t border-gray-200">
              <button onClick={() => setShowQuery(true)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors text-xs font-medium">
                <MessageSquare size={14} /> Raise Query
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Query Form */}
      {showQuery && (
        <div className="bg-white rounded-2xl p-6 border-2 border-purple-200 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Raise a Query / Appeal</h3>
          <form onSubmit={submitQuery} className="space-y-4">
            <input
              type="text"
              placeholder="Subject (Optional)"
              value={querySubject}
              onChange={e => setQuerySubject(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            />
            <textarea
              required
              placeholder="Explain your concern regarding the evaluation..."
              value={queryMessage}
              onChange={e => setQueryMessage(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all min-h-[100px]"
            />
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setShowQuery(false)} className="px-4 py-2 rounded-xl text-gray-500 hover:text-gray-700 text-sm font-medium">Cancel</button>
              <button type="submit" disabled={submittingQuery} className="px-6 py-2 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2 shadow-sm">
                {submittingQuery ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Breakdown */}
      <h3 className="text-lg font-bold text-gray-800 mt-8 mb-4">Question Breakdown</h3>
      <div className="space-y-3">
        {(result.details || []).map((detail, i) => {
          const q = result.assessment.questions.find(x => x.id === detail.question_id) || {};
          const isExpanded = expandedQ[i];
          const fullMarks = detail.score_awarded >= q.marks;
          const partial = detail.score_awarded > 0 && detail.score_awarded < q.marks;
          
          return (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <button onClick={() => toggleQ(i)} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${fullMarks ? 'bg-emerald-100 text-emerald-700' : partial ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                    Q{i+1}
                  </div>
                  <div>
                    <p className="text-sm text-gray-800 font-medium line-clamp-1 max-w-xl">{q.question_text || 'Question text unavailable'}</p>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">{q.question_type}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <span className={`text-sm font-bold ${fullMarks ? 'text-emerald-600' : partial ? 'text-amber-600' : 'text-rose-600'}`}>
                    {detail.score_awarded} / {q.marks} pts
                  </span>
                  {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>
              
              {isExpanded && (
                <div className="p-6 bg-gray-50 border-t border-gray-200 space-y-6">
                  <div>
                    <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Candidate Answer</h4>
                    <div className="bg-white p-4 rounded-xl border border-gray-200 text-sm text-gray-700 whitespace-pre-wrap font-mono">
                      {detail.answer_provided || '(No answer provided)'}
                    </div>
                  </div>
                  
                  {detail.feedback && (
                    <div>
                      <h4 className="text-xs font-medium uppercase tracking-wider text-purple-600 mb-2 flex items-center gap-2"><FileText size={12}/> AI Feedback</h4>
                      <p className="text-sm text-gray-600 leading-relaxed bg-purple-50 p-4 rounded-xl border border-purple-200">
                        {detail.feedback}
                      </p>
                    </div>
                  )}
                  
                  {detail.test_results && detail.test_results.length > 0 && (
                    <div>
                      <h4 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Test Cases</h4>
                      <div className="space-y-2">
                        {detail.test_results.map((tr, trIdx) => (
                          <div key={trIdx} className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between ${tr.passed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                            <span>Test Case {trIdx + 1}</span>
                            <span>{tr.passed ? 'PASSED' : 'FAILED'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}