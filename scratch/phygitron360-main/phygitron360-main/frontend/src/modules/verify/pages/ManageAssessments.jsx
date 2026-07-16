import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, RefreshCw, Filter, Trash2, Edit3, Users,
  BarChart2, Send, ChevronDown, Clock, FileText, CheckCircle,
  XCircle, AlertTriangle, Lock, Unlock, Shuffle, Search, Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';

const TYPE_STYLE = {
  MCQ:     'bg-purple-50 text-purple-700 border-purple-200',
  Coding:  'bg-indigo-50 text-indigo-700 border-indigo-200',
  Written: 'bg-blue-50 text-blue-700 border-blue-200',
  Mixed:   'bg-amber-50 text-amber-700 border-amber-200',
};

const STATUS_STYLE = {
  draft:   'bg-gray-50 text-gray-600 border-gray-200',
  active:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed:  'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUSES = ['draft', 'active', 'closed'];

function Modal({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg p-8 relative shadow-2xl border border-gray-200" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-5 right-5 p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
          <XCircle size={18} />
        </button>
        <h2 className="text-xl font-bold text-gray-800 mb-6">{title}</h2>
        {children}
      </div>
    </div>
  );
}

function AssignModal({ assessment, onClose }) {
  const [userIds, setUserIds] = useState('');
  const [questionIds, setQuestionIds] = useState('');
  const [deadline, setDeadline] = useState('');
  const [generateVariants, setGenerateVariants] = useState(false);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userIds.trim()) return toast.error('Enter at least one user ID');
    const ids = userIds.split(',').map(s => parseInt(s.trim())).filter(Boolean);
    if (!ids.length) return toast.error('Invalid user IDs');
    const qIds = questionIds ? questionIds.split(',').map(s => parseInt(s.trim())).filter(Boolean) : null;
    
    setSubmitting(true);
    try {
      const r = await fetch(`/api/verify/assignments/${assessment.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          user_ids: ids, 
          deadline: deadline || null, 
          generate_variants: generateVariants,
          question_ids: qIds && qIds.length ? qIds : null,
          shuffle_questions: shuffleQuestions
        }),
      });
      const d = await r.json();
      if (r.ok) {
        toast.success(`Assigned to ${ids.length} candidate(s)`);
        onClose();
      } else {
        toast.error(d.detail || 'Assignment failed');
      }
    } catch { toast.error('Network error'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal onClose={onClose} title={`Assign: ${assessment.title}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">User IDs (comma-separated)</label>
          <input
            type="text"
            placeholder="e.g. 1, 2, 3"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            value={userIds}
            onChange={e => setUserIds(e.target.value)}
          />
          <p className="text-xs text-gray-400 mt-0.5">Enter the numeric IDs of candidates to assign</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Deadline (optional)</label>
          <input
            type="datetime-local"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-600">Question Subset IDs (comma-separated, optional)</label>
          <input
            type="text"
            placeholder="e.g. 101, 102 (leave blank for all)"
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            value={questionIds}
            onChange={e => setQuestionIds(e.target.value)}
          />
        </div>
        
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-gray-50 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">Generate AI Variants</p>
              <p className="text-xs text-gray-400 mt-0.5">AI shuffles options and regenerates questions</p>
            </div>
            <button type="button" onClick={() => setGenerateVariants(v => !v)} className={`relative w-12 h-6 rounded-full border transition-colors duration-200 ${generateVariants ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${generateVariants ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          
          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div>
              <p className="text-sm font-semibold text-gray-800">Shuffle Questions Locally</p>
              <p className="text-xs text-gray-400 mt-0.5">Randomize the order per candidate</p>
            </div>
            <button type="button" onClick={() => setShuffleQuestions(v => !v)} className={`relative w-12 h-6 rounded-full border transition-colors duration-200 ${shuffleQuestions ? 'bg-purple-600 border-purple-600' : 'bg-gray-200 border-gray-300'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${shuffleQuestions ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors duration-150 shadow-sm disabled:opacity-50"
        >
          {submitting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          Assign Candidates
        </button>
      </form>
    </Modal>
  );
}

export default function ManageAssessments() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasRole } = useAuth();

  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [assignTarget, setAssignTarget] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/verify/builder/assessments', { credentials: 'include' });
      const d = await r.json();
      setAssessments(d.data || d || []);
    } catch { toast.error('Failed to load assessments'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  const handlePublish = async (asm) => {
    setPublishing(asm.id);
    try {
      const r = await fetch(`/api/verify/builder/assessments/${asm.id}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      if (r.ok) {
        toast.success(`"${asm.title}" is now live`);
        fetchAssessments();
      } else {
        const d = await r.json();
        toast.error(d.detail || 'Publish failed');
      }
    } catch { toast.error('Network error'); }
    finally { setPublishing(null); }
  };

  const handleStatusChange = async (asm, newStatus) => {
    try {
      const r = await fetch(`/api/verify/builder/assessments/${asm.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });
      if (r.ok) {
        toast.success('Status updated');
        fetchAssessments();
      } else {
        const d = await r.json();
        toast.error(d.detail || 'Update failed');
      }
    } catch { toast.error('Network error'); }
  };

  const handleDelete = async (asm) => {
    if (!window.confirm(`Delete "${asm.title}"? This cannot be undone.`)) return;
    setDeleting(asm.id);
    try {
      const r = await fetch(`/api/verify/builder/assessments/${asm.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (r.ok) {
        toast.success('Assessment deleted');
        fetchAssessments();
      } else {
        const d = await r.json();
        toast.error(d.detail || 'Delete failed');
      }
    } catch { toast.error('Network error'); }
    finally { setDeleting(null); }
  };

  const filtered = assessments.filter(a => {
    const matchesStatus = filterStatus === 'all' || a.status?.toLowerCase() === filterStatus;
    const matchesSearch = a.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          a.description?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
            <Search size={15} />
          </span>
          <input
            type="text"
            placeholder="Search assessments..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          {['all', 'draft', 'active', 'closed'].map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-4 py-1.5 rounded-lg border text-xs font-medium uppercase tracking-wider transition-colors ${
                filterStatus === s
                  ? 'bg-purple-50 border-purple-300 text-purple-700'
                  : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        
        <button
          onClick={fetchAssessments}
          className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
        
        <span className="text-xs text-gray-400 ml-auto">
          {filtered.length} of {assessments.length} shown
        </span>
      </div>

      {/* Content */}
      <div className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-24 text-gray-400">
            <Loader2 size={24} className="animate-spin text-purple-600" />
            <span className="text-sm font-medium">Loading assessments...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-24 bg-white rounded-2xl border border-gray-200 shadow-sm">
            <FileText size={48} className="text-gray-300" />
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800 mb-1">No assessments found</p>
              <p className="text-sm text-gray-500">
                {filterStatus !== 'all' ? `No ${filterStatus} assessments` : 'Create your first assessment to get started'}
              </p>
            </div>
            {filterStatus === 'all' && (
              <button
                onClick={() => navigate('/verify?tab=builder')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors duration-150 shadow-sm"
              >
                <Plus size={15} /> New Assessment
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {filtered.map(asm => (
              <div key={asm.id} className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all hover:-translate-y-1 flex flex-col gap-4">
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-gray-800 truncate">{asm.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{asm.description || 'No description'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${TYPE_STYLE[asm.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {asm.type || 'MCQ'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${STATUS_STYLE[asm.status?.toLowerCase()] || STATUS_STYLE.draft}`}>
                      {asm.status || 'Draft'}
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-5 py-3 border-t border-b border-gray-100">
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-800">{asm.question_count ?? 0}</span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 mt-0.5">Questions</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-800">{asm.time_limit_minutes ?? '—'}</span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 mt-0.5">Minutes</span>
                  </div>
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-purple-600">{asm.pass_score ?? 70}%</span>
                    <span className="text-[10px] font-medium uppercase tracking-widest text-gray-400 mt-0.5">Pass Score</span>
                  </div>
                  {asm.shuffle_questions && (
                    <>
                      <div className="w-px h-8 bg-gray-200" />
                      <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
                        <Shuffle size={12} /> Shuffled
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => navigate(`/verify?tab=builder&id=${asm.id}`)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-700 text-xs font-medium hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition-colors"
                  >
                    <Edit3 size={13} /> Edit
                  </button>

                  {asm.status?.toLowerCase() === 'draft' && (
                    <button
                      onClick={() => handlePublish(asm)}
                      disabled={publishing === asm.id}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
                    >
                      {publishing === asm.id ? <Loader2 size={13} className="animate-spin" /> : <Unlock size={13} />}
                      Publish
                    </button>
                  )}

                  {/* Status changer */}
                  <div className="relative group/status">
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium hover:bg-gray-100 transition-colors">
                      <Lock size={13} /> Status <ChevronDown size={11} />
                    </button>
                    <div className="absolute top-full left-0 mt-1 z-20 bg-white rounded-xl border border-gray-200 shadow-lg p-2 min-w-[140px] opacity-0 invisible group-hover/status:opacity-100 group-hover/status:visible transition-all duration-150">
                      {STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(asm, s)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-gray-50 ${
                            asm.status?.toLowerCase() === s ? 'text-purple-600 bg-purple-50' : 'text-gray-600'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/verify?tab=analytics&asm_id=${asm.id}`)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
                  >
                    <BarChart2 size={13} /> Results
                  </button>

                  {asm.status?.toLowerCase() === 'active' && (
                    <button
                      onClick={() => navigate(`/verify?tab=live&asm_id=${asm.id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Activity size={13} className="animate-pulse" /> Live
                    </button>
                  )}

                  <button
                    onClick={() => setAssignTarget(asm)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-medium hover:bg-purple-100 transition-colors"
                  >
                    <Users size={13} /> Assign
                  </button>

                  <button
                    onClick={() => handleDelete(asm)}
                    disabled={deleting === asm.id}
                    className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                  >
                    {deleting === asm.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign Modal */}
      {assignTarget && (
        <AssignModal assessment={assignTarget} onClose={() => setAssignTarget(null)} />
      )}
    </div>
  );
}