import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2, Clock, CheckCircle, AlertTriangle, Play,
  BarChart2, RefreshCw, Calendar, FileText, TrendingUp, Award, Users
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';

const STATUS_STYLE = {
  pending:   'bg-amber-50 text-amber-700 border-amber-200',
  started:   'bg-purple-50 text-purple-700 border-purple-200',
  submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  graded:    'bg-indigo-50 text-indigo-700 border-indigo-200',
  expired:   'bg-rose-50 text-rose-700 border-rose-200',
};

function DeadlineCountdown({ deadline }) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (!deadline) { setDisplay('No deadline'); return; }
    const calc = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) { setDisplay('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h > 48) setDisplay(`${Math.floor(h / 24)}d ${h % 24}h left`);
      else setDisplay(`${h}h ${m}m left`);
    };
    calc();
    const iv = setInterval(calc, 60000);
    return () => clearInterval(iv);
  }, [deadline]);

  const isUrgent = deadline && (new Date(deadline) - new Date()) < 24 * 3600000;

  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${isUrgent ? 'text-rose-600' : 'text-gray-400'}`}>
      <Clock size={11} /> {display}
    </span>
  );
}

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [assignments, setAssignments] = useState([]);
  const [results, setResults] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [loadingResults, setLoadingResults] = useState(true);

  const fetchAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    try {
      const r = await fetch('/api/verify/assignments/my-tests', { credentials: 'include' });
      const d = await r.json();
      setAssignments(d.data || d || []);
    } catch { toast.error('Failed to load assignments'); }
    finally { setLoadingAssignments(false); }
  }, []);

  const fetchResults = useCallback(async () => {
    setLoadingResults(true);
    try {
      const r = await fetch('/api/verify/submissions/my-results', { credentials: 'include' });
      const d = await r.json();
      setResults(d.data || d || []);
    } catch { /* silent */ }
    finally { setLoadingResults(false); }
  }, []);

  useEffect(() => { fetchAssignments(); fetchResults(); }, [fetchAssignments, fetchResults]);

  const pendingCount = assignments.filter(a => ['pending', 'started'].includes(a.status?.toLowerCase())).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-purple-50 rounded-full blur-2xl opacity-50" />
        <div className="relative">
          <p className="text-xs font-semibold text-purple-600 mb-2">CANDIDATE PORTAL</p>
          <h2 className="text-2xl font-bold text-gray-800">
            Welcome, <span className="text-purple-600">{user?.name?.split(' ')[0] || 'Candidate'}</span>
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {pendingCount > 0 ? `${pendingCount} assessment${pendingCount > 1 ? 's' : ''} awaiting your attention` : 'All caught up • No pending assessments'}
          </p>

          <div className="flex gap-4 mt-6">
            <div className="px-6 py-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs font-medium text-gray-500">Assigned</p>
              <p className="text-xl font-bold text-gray-800">{assignments.length}</p>
            </div>
            <div className="px-6 py-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs font-medium text-gray-500">Pending</p>
              <p className="text-xl font-bold text-amber-600">{pendingCount}</p>
            </div>
            <div className="px-6 py-3 rounded-xl bg-gray-50 border border-gray-200">
              <p className="text-xs font-medium text-gray-500">Completed</p>
              <p className="text-xl font-bold text-emerald-600">{results.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* My Assignments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText size={16} className="text-purple-600" /> My Assignments
          </h3>
          <button onClick={fetchAssignments} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <RefreshCw size={14} />
          </button>
        </div>

        {loadingAssignments ? (
          <div className="flex items-center justify-center gap-3 py-12 text-gray-400">
            <Loader2 size={20} className="animate-spin text-purple-600" />
            <span className="text-sm font-medium">Loading assignments...</span>
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-gray-200 shadow-sm flex flex-col items-center gap-4 text-center">
            <Calendar size={40} className="text-gray-300" />
            <div>
              <p className="text-base font-semibold text-gray-800 mb-1">No assignments yet</p>
              <p className="text-sm text-gray-500">You'll see your assessments here when assigned</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map(a => {
              const s = a.status?.toLowerCase();
              const isActionable = s === 'pending' || s === 'started';
              const isCompleted = s === 'submitted' || s === 'graded';
              return (
                <div key={a.id} className={`bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center gap-4 ${isActionable ? 'hover:border-purple-300' : ''} transition-colors`}>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    isActionable ? 'bg-purple-100 text-purple-600' :
                    isCompleted ? 'bg-emerald-100 text-emerald-600' :
                    'bg-gray-100 text-gray-400'
                  }`}>
                    {isCompleted ? <CheckCircle size={22} /> : <FileText size={22} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h4 className="font-semibold text-gray-800 truncate">{a.assessment_title || a.title || 'Assessment'}</h4>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-medium uppercase tracking-wider shrink-0 ${STATUS_STYLE[s] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                        {a.status || 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <DeadlineCountdown deadline={a.deadline} />
                      {a.time_limit_minutes && (
                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <Clock size={11} /> {a.time_limit_minutes}m
                        </span>
                      )}
                    </div>
                  </div>

                  {isActionable && (
                    <button
                      onClick={() => navigate(`/verify?tab=take&asm_id=${a.assessment_id || a.id}`)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors shadow-sm shrink-0"
                    >
                      <Play size={13} fill="currentColor" /> Start
                    </button>
                  )}
                  {isCompleted && a.result_id && (
                    <button
                      onClick={() => navigate(`/verify?tab=result&result_id=${a.result_id}`)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors shrink-0"
                    >
                      <BarChart2 size={13} /> Results
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* My Results */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-purple-600" /> Score History
        </h3>

        {loadingResults ? (
          <div className="flex items-center justify-center gap-3 py-8 text-gray-400">
            <Loader2 size={18} className="animate-spin text-purple-600" />
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm flex flex-col items-center gap-3 text-center opacity-60">
            <Award size={32} className="text-gray-300" />
            <p className="text-sm text-gray-500">No completed assessments yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {results.map(r => {
              const pct = Math.round(r.percentage_score ?? r.score ?? 0);
              const passed = r.passed;
              return (
                <div key={r.id} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-semibold text-gray-800 text-sm truncate">{r.assessment_title || 'Assessment'}</h4>
                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-medium uppercase tracking-wider shrink-0 ${
                      passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {passed ? 'Pass' : 'Fail'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${passed ? 'bg-emerald-500' : 'bg-rose-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`text-sm font-bold ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {pct}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {r.submitted_at ? new Date(r.submitted_at).toLocaleDateString() : ''}
                    </span>
                    {r.id && (
                      <button
                        onClick={() => navigate(`/verify?tab=result&result_id=${r.id}`)}
                        className="text-xs font-medium text-purple-600 hover:text-purple-800 transition-colors"
                      >
                        View →
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}