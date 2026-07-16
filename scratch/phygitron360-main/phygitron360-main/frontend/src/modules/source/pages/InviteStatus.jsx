import React, { useState, useEffect, useCallback } from 'react';
import {
  X, RefreshCw, Loader2, Mail, Users,
  CheckCircle, LogIn, BarChart2, Send
} from 'lucide-react';
import { toast } from 'react-hot-toast';

const INVITE_STATUS_STYLE = {
  sent:       'bg-white/5 text-white/40 border-white/10',
  opened:     'bg-amber-400/10 text-amber-400 border-amber-400/20',
  logged_in:  'bg-indigo/10 text-indigo border-indigo/20',
  completed:  'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
};

function StatusBadge({ status }) {
  const s = (status || 'sent').toLowerCase();
  return (
    <span className={`px-3 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${INVITE_STATUS_STYLE[s] || 'bg-white/5 text-white/40 border-white/10'}`}>
      {s.replace('_', ' ')}
    </span>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className="glass-panel p-5 flex-1 min-w-[140px]">
      <div className={`flex items-center gap-2 text-[9px] font-black uppercase tracking-widest mb-2 ${color || 'text-white/40'}`}>
        {icon} {label}
      </div>
      <p className="text-3xl font-display font-black text-white">{value}</p>
    </div>
  );
}

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return d; }
}

export default function InviteStatus({ roleId, roleName, onClose }) {
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInvites = useCallback(async () => {
    if (!roleId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/source/invite-status/${roleId}`, { credentials: 'include' });
      const d = await r.json();
      if (r.ok) {
        setInvites(d.data || []);
      } else {
        toast.error(d.detail || 'Failed to load invite status');
      }
    } catch { toast.error('Network error'); }
    finally { setLoading(false); }
  }, [roleId]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  const total = invites.length;
  const opened = invites.filter(i => ['opened', 'logged_in', 'completed'].includes((i.status || '').toLowerCase())).length;
  const loggedIn = invites.filter(i => ['logged_in', 'completed'].includes((i.status || '').toLowerCase())).length;
  const completed = invites.filter(i => (i.status || '').toLowerCase() === 'completed').length;

  const openRate = total > 0 ? Math.round((opened / total) * 100) : 0;
  const loginRate = total > 0 ? Math.round((loggedIn / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-4xl max-h-[90vh] glass-panel flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-white/5 shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Invite Tracking</p>
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tighter italic">
              {roleName || 'Role'} <span className="text-primary">Invites</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchInvites}
              disabled={loading}
              className="p-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-150 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            </button>
            <button onClick={onClose} className="p-3 rounded-xl text-white/30 hover:text-white hover:bg-white/5 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 p-8 pb-0 shrink-0 flex-wrap">
          <StatCard icon={<Send size={12} />} label="Total Sent" value={total} />
          <StatCard icon={<Mail size={12} />} label={`Opened (${openRate}%)`} value={opened} color="text-amber-400" />
          <StatCard icon={<LogIn size={12} />} label={`Logged In (${loginRate}%)`} value={loggedIn} color="text-indigo" />
          <StatCard icon={<CheckCircle size={12} />} label="Completed" value={completed} color="text-emerald-400" />
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-24 text-white/40">
              <Loader2 size={24} className="animate-spin text-primary" />
              <span className="text-xs font-bold uppercase tracking-widest">Loading invites...</span>
            </div>
          ) : invites.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center glass-panel border-white/5">
              <Mail size={40} className="text-white/10" />
              <div>
                <p className="text-sm font-bold text-white mb-1">No invites sent yet</p>
                <p className="text-xs text-white/30">Send invites from the candidate directory.</p>
              </div>
            </div>
          ) : (
            <div className="glass-panel overflow-hidden border-white/5">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_1fr_120px_1fr_1fr] gap-4 px-6 py-4 border-b border-white/5 text-[9px] font-black uppercase tracking-widest text-white/30">
                <div>Candidate</div>
                <div>Email</div>
                <div className="text-center">Status</div>
                <div>Sent At</div>
                <div>Opened At</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-white/5">
                {invites.map((inv, idx) => (
                  <div key={inv.id || idx} className="grid grid-cols-[1fr_1fr_120px_1fr_1fr] gap-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-display font-black text-xs text-white shrink-0">
                        {(inv.candidate_name || inv.full_name || '?')[0]}
                      </div>
                      <span className="text-sm font-bold text-white truncate">{inv.candidate_name || inv.full_name || '—'}</span>
                    </div>
                    <span className="text-xs text-white/50 truncate">{inv.email || '—'}</span>
                    <div className="flex justify-center">
                      <StatusBadge status={inv.status} />
                    </div>
                    <span className="text-xs text-white/40">{formatDate(inv.sent_at || inv.created_at)}</span>
                    <span className="text-xs text-white/40">{formatDate(inv.opened_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
