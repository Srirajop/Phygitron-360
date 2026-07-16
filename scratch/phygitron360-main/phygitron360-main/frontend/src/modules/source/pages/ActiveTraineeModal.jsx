import React, { useState } from 'react';
import { X, Send, User, MapPin, Mail, Loader2, MessageSquare, CheckCircle, Bell, UserX } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ActiveTraineeModal({ trainee, onClose, onRefresh }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (!trainee) return null;

  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required.');
      return;
    }
    setSending(true);
    const tid = toast.loading('Dispatching notification...');
    try {
      const res = await fetch(`/api/source/candidates/${trainee.id}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success('Notification sent and emailed successfully!', { id: tid });
        setSubject('');
        setMessage('');
        onClose();
      } else {
        toast.error(data.detail || 'Failed to send notification.', { id: tid });
      }
    } catch (err) {
      toast.error('Network error while sending notification.', { id: tid });
    } finally {
      setSending(false);
    }
  };


  const handleCancelInvite = async () => {
    if (!window.confirm(`Are you sure you want to cancel the invite for ${trainee.full_name}? This will unlink their user account if they are a trainee and convert them back to an active candidate.`)) return;
    
    setCancelling(true);
    const tid = toast.loading('Cancelling invite...');
    try {
      const res = await fetch('/api/source/cancel-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate_ids: [trainee.id] }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'Invite cancelled successfully.', { id: tid });
        onClose();
        if (onRefresh) onRefresh();
      } else {
        toast.error(data.detail || 'Failed to cancel invite.', { id: tid });
      }
    } catch (err) {
      toast.error('Network error while cancelling invite.', { id: tid });
    } finally {
      setCancelling(false);
    }
  };

  const insights = trainee.insights || { total_tests: 0, avg_score: 0, final_score: trainee.fit_score || 0 };
  const scoreColor = insights.final_score >= 70 ? 'text-emerald-400 border-emerald-400' : insights.final_score >= 40 ? 'text-amber-400 border-amber-400' : 'text-rose-400 border-rose-400';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left Side: Trainee Info */}
        <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 p-8 flex flex-col items-center text-center overflow-y-auto">
          <button onClick={onClose} className="absolute top-4 left-4 p-2 md:hidden text-slate-400 hover:text-slate-900 rounded-lg bg-slate-100">
            <X size={16} />
          </button>
          
          <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-display font-black text-3xl mb-4 mt-8 md:mt-0 shadow-lg shadow-primary/20">
            {(trainee.full_name || 'T').charAt(0).toUpperCase()}
          </div>
          
          <h2 className="text-xl font-bold text-slate-900 mb-1">{trainee.full_name || 'Unknown Trainee'}</h2>
          <p className="text-xs text-slate-500 mb-6 uppercase tracking-widest font-bold flex items-center gap-2">
            <MapPin size={12} /> {trainee.location || 'Remote'}
          </p>

          <div className="w-full space-y-4 mb-8">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center shadow-sm">
              <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-1">Final Score</span>
              <span className={`text-3xl font-display font-black ${scoreColor.split(' ')[0]}`}>
                {Math.round(insights.final_score)}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center shadow-sm">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-1">Assessments</span>
                <span className="text-lg font-bold text-slate-900">{insights.total_tests}</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col items-center shadow-sm">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-1">Avg Score</span>
                <span className="text-lg font-bold text-slate-900">{Math.round(insights.avg_score)}%</span>
              </div>
            </div>
          </div>

          <div className="w-full text-left bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3 text-xs mb-4">
            <div className="flex items-center gap-3 text-slate-600">
              <Mail size={14} className="text-primary/60" /> 
              <span className="truncate">{trainee.email}</span>
            </div>
            {trainee.phone && (
              <div className="flex items-center gap-3 text-slate-600">
                <User size={14} className="text-primary/60" /> 
                <span>{trainee.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle size={14} />
              <span className="font-medium">Status: {trainee.status || 'Active'}</span>
            </div>
          </div>

          <div className="w-full text-left flex flex-col gap-3">
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-2">Resume Flags</div>
              <div className="text-xs space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                {insights.signals && insights.signals.length > 0 ? (
                  insights.signals.map((sig, idx) => (
                    <div key={idx} className={`p-2 rounded border ${sig.flag ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                      <div className="font-bold flex items-center gap-1">
                        {sig.flag ? '⚠️' : '✓'} {sig.skill || sig.name}
                      </div>
                      <div className="mt-1 opacity-80 text-[10px]">{sig.reason}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-slate-500 italic">No signals generated.</div>
                )}
              </div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-black">Attached Resumes</div>
              <div className="text-xs font-bold text-slate-700">{trainee.resume_path || trainee.resume_url ? '1 Resume' : 'No Resume'}</div>
            </div>
          </div>
        </div>

        {/* Right Side: Action Panel */}
        <div className="w-full md:w-2/3 p-8 flex flex-col h-full bg-white">
          <div className="flex items-start justify-between mb-8">
            <div>
              <h3 className="text-2xl font-display font-black text-slate-900 uppercase italic tracking-tight flex items-center gap-3">
                <Bell className="text-primary" size={24} /> Notification Center
              </h3>
              <p className="text-xs text-slate-500 mt-2 max-w-md leading-relaxed">
                Send a custom update, interview link, or assessment instruction directly to {trainee.full_name?.split(' ')[0] || 'the trainee'}'s dashboard and email inbox.
              </p>
            </div>
            <button onClick={onClose} className="hidden md:flex p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSendNotification} className="flex-1 flex flex-col justify-between">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500">Subject</label>
                <input 
                  type="text"
                  required
                  placeholder="e.g., Interview Scheduled: Phase 2"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400"
                />
              </div>

              <div className="space-y-2 flex-1">
                <label className="text-[10px] uppercase tracking-widest font-black text-slate-500 flex items-center gap-2">
                  Message Body <span className="text-primary normal-case font-normal">(URLs will be clickable)</span>
                </label>
                <textarea 
                  required
                  rows={8}
                  placeholder={`Hi ${trainee.full_name?.split(' ')[0] || 'there'},\n\nPlease join us for a quick sync at: https://meet.google.com/xxx-xxxx-xxx`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 outline-none focus:border-primary/50 focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-slate-400 resize-none font-mono"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-between items-center gap-3 pt-6 border-t border-slate-200">
              <button 
                type="button" 
                onClick={handleCancelInvite}
                disabled={cancelling || sending}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold uppercase tracking-widest hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-colors disabled:opacity-50"
              >
                {cancelling ? <Loader2 size={16} className="animate-spin" /> : <UserX size={16} />}
                Cancel Invite
              </button>
              
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={onClose}
                  className="px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 text-xs font-bold uppercase tracking-widest hover:text-slate-900 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
                <button 
                  type="submit" 
                  disabled={sending || cancelling}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Dispatch Notification
                </button>
              </div>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
