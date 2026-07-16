import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { BookOpen, Plus, CheckCircle, Clock, Users } from 'lucide-react';
import { isDateString } from '../../../core/utils/validators';

export default function TrainingPanel() {
  const [programs, setPrograms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [form, setForm] = useState({ employee_codes: [], program_id: '', date: '', duration: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [p, a, e] = await Promise.all([
        fetch('/api/training/programs', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/training/assignments', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/employees', { credentials: 'include' }).then(r => r.json()),
      ]);
      setPrograms(Array.isArray(p) ? p : []);
      setAssignments(Array.isArray(a) ? a : []);
      setEmployees(Array.isArray(e) ? e : []);
    } catch { toast.error('Failed to load training data'); }
    finally { setLoading(false); }
  };

  const updateStatus = async (id, status) => {
    if (!['Pending', 'Completed'].includes(status)) {
      toast.error('Invalid training status');
      return;
    }
    try {
      await fetch(`/api/training/assignment/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      toast.success('Status updated');
      loadData();
    } catch { toast.error('Update failed'); }
  };

  const assignTraining = async () => {
    if (!form.program_id) return toast.error('Select a training program');
    if (!form.employee_codes.length) return toast.error('Select at least one employee');
    if (!isDateString(form.date)) return toast.error('Training date is required');
    if (!form.duration.trim()) return toast.error('Duration is required, e.g. 2 Days');
    try {
      const res = await fetch('/api/training/assign', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error();
      toast.success('Training assigned!');
      setShowAssignForm(false);
      setForm({ employee_codes: [], program_id: '', date: '', duration: '' });
      loadData();
    } catch { toast.error('Assignment failed'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const statusStats = assignments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Programs', value: programs.length, color: '#CC97FF' },
          { label: 'Assigned', value: assignments.length, color: '#F59E0B' },
          { label: 'Completed', value: statusStats['Completed'] || 0, color: '#10B981' },
          { label: 'Pending', value: statusStats['Pending'] || 0, color: '#6366F1' },
        ].map((s, i) => (
          <div key={i} className="glass-panel p-6 border-white/5 text-center">
            <p className="text-3xl font-display font-black" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Programs */}
      <div className="flex justify-between items-center">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-3">
          <BookOpen size={14} /> Training Programs
        </h3>
        <button
          onClick={() => setShowAssignForm(true)}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-primary/80 transition-all"
        >
          <Plus size={12} /> Assign Training
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {programs.map((p, i) => (
          <div key={p.id || i} className="glass-panel p-6 border-white/5 hover:border-white/10 transition-all">
            <div className="flex items-start justify-between mb-3">
              <BookOpen size={18} className="text-primary" />
              <span className="text-[9px] font-black text-white/20 uppercase">{p.default_duration}</span>
            </div>
            <h4 className="text-sm font-bold text-white mb-2 leading-tight">{p.program_name}</h4>
            <p className="text-[10px] text-white/40 leading-relaxed">{p.description || 'No description'}</p>
          </div>
        ))}
      </div>

      {/* Assignments Table */}
      <div className="glass-panel border-white/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 bg-white/5 flex items-center gap-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">Active Assignments</h3>
        </div>
        <table className="w-full text-left">
          <thead className="border-b border-white/5">
            <tr>
              {['Employee', 'Program', 'Date', 'Duration', 'Status', 'Action'].map(h => (
                <th key={h} className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-white/20">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {assignments.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-12 text-center text-[10px] text-white/20 uppercase font-black">No training assignments</td></tr>
            ) : assignments.slice(0, 20).map((a, i) => (
              <tr key={i} className="hover:bg-white/[0.02]">
                <td className="px-6 py-4 text-xs font-bold text-white">{a.employee_code}</td>
                <td className="px-6 py-4 text-xs text-white/60">{a.program_name || `Program #${a.program_id}`}</td>
                <td className="px-6 py-4 text-xs text-white/40">{a.training_date || '—'}</td>
                <td className="px-6 py-4 text-xs text-white/40">{a.duration || '—'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                    a.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>{a.status}</span>
                </td>
                <td className="px-6 py-4">
                  {a.status !== 'Completed' && (
                    <button onClick={() => updateStatus(a.id, 'Completed')}
                      className="text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors">
                      Mark Done
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Modal */}
      {showAssignForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel border-white/10 rounded-3xl p-8 w-full max-w-md mx-4 space-y-5">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Assign Training</h3>
            <select
              value={form.program_id}
              onChange={e => setForm(f => ({ ...f, program_id: e.target.value }))}
              className="w-full glass-panel border-white/5 text-white text-xs bg-transparent px-4 py-3 rounded-xl focus:outline-none"
            >
              <option value="" className="bg-[#080f1f]">Select Program</option>
              {programs.map(p => <option key={p.id} value={p.id} className="bg-[#080f1f]">{p.program_name}</option>)}
            </select>
            <select
              multiple
              value={form.employee_codes}
              onChange={e => setForm(f => ({ ...f, employee_codes: Array.from(e.target.selectedOptions, o => o.value) }))}
              className="w-full glass-panel border-white/5 text-white text-xs bg-transparent px-4 py-3 rounded-xl focus:outline-none h-32"
            >
              {employees.filter(e => e.employment_status === 'Active').map(e => (
                <option key={e.employee_code} value={e.employee_code} className="bg-[#080f1f]">
                  {e.name} ({e.employee_code})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="glass-panel border-white/5 text-white text-xs bg-transparent px-4 py-3 rounded-xl focus:outline-none" />
              <input placeholder="Duration (e.g. 2 Days)" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                className="glass-panel border-white/5 text-white text-xs bg-transparent px-4 py-3 rounded-xl focus:outline-none placeholder-white/20" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowAssignForm(false)}
                className="flex-1 py-3 rounded-2xl glass-panel border-white/10 text-white/40 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">
                Cancel
              </button>
              <button onClick={assignTraining}
                className="flex-1 py-3 rounded-2xl bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:bg-primary/80 transition-all">
                Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
