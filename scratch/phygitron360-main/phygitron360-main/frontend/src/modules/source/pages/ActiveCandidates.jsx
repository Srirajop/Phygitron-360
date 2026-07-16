import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Loader2, RefreshCw, UserCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ActiveTraineeModal from './ActiveTraineeModal';

function CandidateRow({ c, onSelect }) {
  const insights = c.insights || { total_tests: 0, avg_score: 0, has_malpractice: false, resume_score: c.fit_score || 0, final_score: c.fit_score || 0, signals: [], job_title: '' };
  const scoreColor = insights.avg_score >= 70 ? 'bg-emerald-400' : insights.avg_score >= 40 ? 'bg-amber-400' : 'bg-rose-400';
  const textColor = insights.avg_score >= 70 ? 'text-emerald-400' : insights.avg_score >= 40 ? 'text-amber-400' : 'text-rose-400';
  
  const finalScoreColor = (insights.final_score || 0) >= 70 ? '#34d399' : (insights.final_score || 0) >= 40 ? '#fbbf24' : '#fb7185';
  
  return (
    <div className="border-b border-white/5 last:border-0 flex flex-col transition-colors duration-150">
      <div 
        onClick={() => onSelect()}
        className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_1fr_1fr_1fr] gap-4 px-6 py-4 items-center cursor-pointer hover:bg-white/[0.04]"
      >
        {/* Name & Email */}
        <div className="min-w-0">
          <div className="font-bold text-white text-sm truncate">{c.full_name || c.name || '—'}</div>
          <div className="text-xs text-white/40 truncate">{c.email || '—'}</div>
        </div>

        {/* Job */}
        <div className="min-w-0">
          <div className="font-medium text-white/80 text-xs truncate bg-white/5 px-2 py-1 rounded inline-block">{insights.job_title || 'General'}</div>
        </div>

        {/* Tests Taken */}
        <div className="flex items-center gap-2">
          <span className="font-bold text-white/80">{insights.total_tests || 0}</span>
          {insights.has_malpractice && <span title="Malpractice flagged" className="text-sm">⚠️</span>}
        </div>

        {/* Resume Profile */}
        <div className="font-bold text-white/80">{Math.round(insights.resume_score || 0)}</div>

        {/* Assessment Avg */}
        <div>
          {insights.total_tests > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${scoreColor}`} style={{ width: `${insights.avg_score}%` }} />
              </div>
              <span className={`font-bold text-xs ${textColor}`}>{Math.round(insights.avg_score)}%</span>
            </div>
          ) : (
            <span className="text-[10px] font-black uppercase tracking-widest text-white/30">No Data</span>
          )}
        </div>

        {/* Fit Score */}
        <div>
          <div 
            className="w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-black"
            style={{ borderColor: finalScoreColor, color: finalScoreColor }}
          >
            {Math.round(insights.final_score || 0)}
          </div>
        </div>

        {/* Joined */}
        <div className="text-xs text-white/40">
          {new Date(c.created_at || c.updated_at || Date.now()).toLocaleDateString()}
        </div>

        {/* Actions */}
        <div>
          <button 
            onClick={(e) => { e.stopPropagation(); onSelect(); }} 
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-colors inline-block text-center"
          >
            Manage
          </button>
        </div>
      </div>
    </div>
  );
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'favourite', label: 'Favourite' },
  { value: 'invited', label: 'Invited' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ActiveCandidates({ onViewProfile }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [selectedTrainee, setSelectedTrainee] = useState(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const r = await fetch(`/api/source/candidates/active?${params}`, { credentials: 'include' });
      const d = await r.json();
      if (r.ok) {
        setCandidates(d.data || []);
      } else {
        toast.error(d.detail || 'Failed to load candidates');
      }
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  const uniqueJobs = [...new Set(candidates.map(c => c.insights?.job_title).filter(Boolean))];
  const filteredCandidates = candidates.filter(c => !jobFilter || c.insights?.job_title === jobFilter);

  return (
    <div className="flex flex-col gap-6 h-full animate-fade-in">

      <div className="flex items-center justify-end gap-3 shrink-0">
        {/* Job filter */}
        <select
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/40 transition-colors max-w-[200px]"
          value={jobFilter}
          onChange={e => setJobFilter(e.target.value)}
        >
          <option value="">All Jobs</option>
          {uniqueJobs.map(job => (
            <option key={job} value={job}>{job}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-primary/40 transition-colors"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          {STATUS_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <button
          onClick={fetchCandidates}
          disabled={loading}
          className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-primary/20 hover:text-primary transition-colors duration-150 disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        </button>
      </div>

      {/* Table */}
      <div className="glass-panel flex-1 flex flex-col overflow-hidden min-h-0 animate-scale-in">
        {/* Table header */}
        <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-white/10 text-[10px] font-black uppercase tracking-widest text-white/40 shrink-0 bg-white/5">
          <div>Name</div>
          <div>Job Role</div>
          <div>Tests Taken</div>
          <div>Resume Profile</div>
          <div>Assessment Avg</div>
          <div>Fit Score</div>
          <div>Joined</div>
          <div>Actions</div>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ overscrollBehavior: 'contain' }}>
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-white/40">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading active candidates...</span>
            </div>
          ) : filteredCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
                <UserCheck size={32} />
              </div>
              <div>
                <p className="text-base font-bold text-white mb-1">No active trainees found.</p>
                <p className="text-xs text-white/40">Candidates taking assessments will appear here.</p>
              </div>
            </div>
          ) : (
            filteredCandidates.map(c => (
              <CandidateRow key={c.id} c={c} onSelect={() => setSelectedTrainee(c)} />
            ))
          )}
        </div>
      </div>
      
      {/* Action Modal */}
      <ActiveTraineeModal 
        trainee={selectedTrainee} 
        onClose={() => setSelectedTrainee(null)} 
        onRefresh={fetchCandidates}
      />
    </div>
  );
}
