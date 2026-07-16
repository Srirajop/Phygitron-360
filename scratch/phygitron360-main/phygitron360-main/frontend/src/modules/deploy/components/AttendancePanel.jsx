import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';
import { Clock, CheckCircle, XCircle, LogIn, LogOut, Calendar, Users, BarChart3, Activity, Zap, Shield, Edit, Save, Plus, Search, AlertCircle } from 'lucide-react';

export default function AttendancePanel({ mode }) {
  const { user } = useAuth();
  const isAdmin = mode === 'admin';
  const isEmployee = mode === 'employee';
  const [status, setStatus] = useState(null);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({ date: '', correction_type: 'both', clock_in: '', clock_out: '', reason: '' });
  const [submittedCorrections, setSubmittedCorrections] = useState(new Set());
  const [correctionQueue, setCorrectionQueue] = useState([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedCorrectionId, setSelectedCorrectionId] = useState(null);
  const [history, setHistory] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [myLeaves, setMyLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [dailyLog, setDailyLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workLog, setWorkLog] = useState('');
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [adminTab, setAdminTab] = useState('today');
  
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '', leave_type: 'Leave', reason: '', start_day_type: 'Full Day', end_day_type: 'Full Day' });
  const [attendanceSummary, setAttendanceSummary] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({ employee_code: '', date: new Date().toISOString().split('T')[0], clock_in: '', clock_out: '', work_log: '' });

  // New States
  const [selectedLog, setSelectedLog] = useState(null); // For employee log details modal
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedEmployeeHistory, setSearchedEmployeeHistory] = useState([]);
  const [searchedEmployeeLeaves, setSearchedEmployeeLeaves] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  const panelStyle =
  "bg-white border border-[#ebe4ff] rounded-[2.5rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)]";

  const inputStyle =
  "w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#c084fc] transition-all";

  const buttonPrimary =
  "bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white shadow-[0_12px_30px_rgba(180,140,255,0.28)]";

  const buttonSecondary =
  "bg-white border border-[#ebe4ff] text-[#6b7280] hover:bg-[#faf7ff]";

  const tableHeader =
  "bg-[#f5efff] border-b border-[#ece2ff]";

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isAdmin && adminTab === 'heatmap') {
        fetchSummary();
    }
  }, [adminTab, selectedMonth, selectedYear, isAdmin]);

  const fetchSummary = async () => {
      try {
          const res = await fetch(`/api/attendance/admin/summary?year=${selectedYear}&month=${selectedMonth}`, { credentials: 'include' });
          if (!res.ok) {
              const d = await res.json();
              throw new Error(d.detail || 'Failed to load summary');
          }
          const data = await res.json();
          setAttendanceSummary(Array.isArray(data) ? data : []);
      } catch (e) { toast.error(e.message || 'Failed to load summary'); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (user?.employee_code) {
          const [s, h, b, ml] = await Promise.all([
            fetch('/api/attendance/status', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/attendance/history', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/attendance/leave/balance', { credentials: 'include' }).then(r => r.json()),
            fetch('/api/attendance/leave/my-requests', { credentials: 'include' }).then(r => r.json()),
          ]);
          setStatus(s);
          setHistory(Array.isArray(h) ? h : []);
          setLeaveBalance(b);
          setMyLeaves(Array.isArray(ml) ? ml : []);
      }

      if (isAdmin) {
        const [al, dl, el, cq] = await Promise.all([
          fetch('/api/attendance/leave/all-requests', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/attendance/admin/today', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/attendance/admin/employees', { credentials: 'include' }).then(r => r.json()),
          fetch('/api/attendance/correction/pending', { credentials: 'include' }).then(r => r.json()).catch(() => []),
        ]);
        setAllLeaves(Array.isArray(al) ? al : []);
        setDailyLog(Array.isArray(dl) ? dl : []);
        setEmployees(Array.isArray(el) ? el : []);
        setCorrectionQueue(Array.isArray(cq) ? cq : []);
      }
    } catch (e) { 
        toast.error(e.message || 'Failed to load attendance data'); 
    } finally { 
        setLoading(false); 
    }
  };

  const clockIn = async () => {
    try {
      const now = new Date();
      const local_date = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
      const local_time = now.toTimeString().split(' ')[0]; // HH:MM:SS
      
      const res = await fetch('/api/attendance/clock-in', { 
          method: 'POST', 
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ local_date, local_time })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Clock in failed');
      toast.success('Clocked in!');
      loadData();
    } catch (e) { toast.error(e.message); }
  };

  const clockOut = async () => {
    try {
      const now = new Date();
      const local_date = now.toLocaleDateString('en-CA');
      const local_time = now.toTimeString().split(' ')[0];

      const res = await fetch('/api/attendance/clock-out', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            work_log: workLog || 'No log provided',
            local_date,
            local_time
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Clock out failed');
      toast.success('Clocked out!');
      setWorkLog('');
      loadData();
      setShowClockOutModal(false);
    } catch (e) { toast.error(e.message); }
  };

  const applyLeave = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...leaveForm, duration_days: durationDays };
      const res = await fetch('/api/attendance/leave/apply', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Application failed');
      toast.success(data.message);
      setShowLeaveForm(false);
      loadData();
    } catch (e) { toast.error(e.message); }
  };

  const leaveAction = async (id, action) => {
    try {
      const fd = new FormData();
      fd.append('action', action);
      const res = await fetch(`/api/attendance/leave/action/${id}`, { method: 'POST', credentials: 'include', body: fd });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Action failed');
      }
      toast.success(action === 'Approved' ? "Clearance Granted" : "Application Rejected");
      loadData();
    } catch (e) { toast.error(e.message); }
  };

  const saveAttendanceEdit = async () => {
    try {
        const res = await fetch('/api/attendance/admin/edit', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(editForm)
        });
        if (!res.ok) throw new Error();
        toast.success("Matrix Synchronized");
        setEditingRecord(null);
        setEditForm({ employee_code: '', date: new Date().toISOString().split('T')[0], clock_in: '', clock_out: '', work_log: '' });
        loadData();
    } catch {
        toast.error("Synchronization Failed");
    }
  };

  const applyCorrection = async (e) => {
      e.preventDefault();
      try {
          const res = await fetch('/api/attendance/correction/apply', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(correctionForm)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Correction request failed');
          toast.success('Correction request submitted');
          setSubmittedCorrections(prev => new Set(prev).add(correctionForm.date));
          setShowCorrectionForm(false);
          loadData();
      } catch (e) { toast.error(e.message); }
  };

  const actionCorrection = async (id, action, reason = '') => {
      try {
          const res = await fetch(`/api/attendance/correction/action/${id}`, {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, rejection_reason: reason })
          });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.detail || 'Action failed');
          }
          toast.success(`Correction ${action}`);
          setSelectedCorrectionId(null);
          setRejectionReason('');
          loadData();
      } catch (e) { toast.error(e.message); }
  };

  const isWithinLast7Days = (dateStr) => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const d = new Date(dateStr);
      d.setHours(0,0,0,0);
      const diffTime = Math.abs(today - d);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 7;
  };

  const searchEmployeeRecords = async (code) => {
    if (!code) return;
    setIsSearching(true);
    try {
      const [h, l] = await Promise.all([
        fetch(`/api/attendance/admin/employee/${code}/history`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/attendance/admin/employee/${code}/leaves`, { credentials: 'include' }).then(r => r.json())
      ]);
      setSearchedEmployeeHistory(Array.isArray(h) ? h : []);
      setSearchedEmployeeLeaves(Array.isArray(l) ? l : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load employee records');
    } finally {
      setIsSearching(false);
    }
  };

  // Compute frontend matrix dashboard stats from existing data safely
  let totalPresent = 0;
  let totalLeave = 0;
  let totalHalfDay = 0;
  let totalAbsent = 0;

  const localTodayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
  
  attendanceSummary.forEach(emp => {
    if (emp && Array.isArray(emp.days)) {
      emp.days.forEach(d => {
        if (d.date === localTodayStr) {
          if (d.status === 'Present' || d.status === 'Active') totalPresent++;
          else if (d.status === 'Leave') totalLeave++;
          else if (d.status.startsWith('Half Day Leave')) totalLeave += 0.5;
          else if (d.status.startsWith('Half Day')) totalHalfDay++;
          else if (d.status === 'Absent') totalAbsent++;
        }
      });
    }
  });

  const isSingleDay = !leaveForm.end_date || leaveForm.start_date === leaveForm.end_date;
  let durationDays = 0;
  if (leaveForm.start_date && leaveForm.end_date) {
    const s = new Date(leaveForm.start_date);
    const e = new Date(leaveForm.end_date);
    if (e >= s) {
      let days = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24)) + 1;
      if (isSingleDay) {
         if (leaveForm.start_day_type === 'First Half' || leaveForm.start_day_type === 'Second Half') {
            days = 0.5;
         }
      } else {
         if (leaveForm.start_day_type === 'Second Half') days -= 0.5;
         if (leaveForm.end_day_type === 'First Half') days -= 0.5;
      }
      durationDays = days;
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Clock In/Out Widget */}
      {isEmployee && (
        <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] p-8 border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5">
             <Clock size={120} />
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8b5cf6] mb-3">Live Session // Matrix Sync</p>
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${status?.status === 'clocked_in' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-white/10'} ${status?.status === 'clocked_in' ? 'animate-pulse' : ''}`} />
                <p className="text-3xl font-display font-black text-black uppercase tracking-tighter italic">
                  {status?.status === 'clocked_in' ? 'Active Uplink' : status?.status === 'completed' ? 'Session Terminated' : 'Standby Mode'}
                </p>
              </div>
              {status?.data?.clock_in && (
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b7280] mt-3 flex items-center gap-2">
                  <LogIn size={12} className="text-emerald-400" />
                  Synchronized at <span className="text-black">{status.data.clock_in}</span>
                </p>
              )}
              {status?.data?.clock_out && (
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b7280] mt-1 flex items-center gap-2">
                  <LogOut size={12} className="text-red-400" />
                  Closed at <span className="text-black">{status.data.clock_out}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto">
              {status?.status === 'clocked_in' ? (
                <button onClick={() => setShowClockOutModal(true)}
                  className="flex items-center justify-center gap-3 px-8 py-4 bg-red-500 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-400 transition-all font-display italic">
                  <LogOut size={14} /> Terminate Session
                </button>
              ) : status?.status === 'not_started' ? (
                <button onClick={clockIn}
                  className="flex items-center justify-center gap-3 px-10 py-5 bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-transparent font-display italic">
                  <LogIn size={18} /> Initiate Uplink
                </button>
              ) : (
                  <div className="px-8 py-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3 opacity-50">
                      <CheckCircle size={16} className="text-emerald-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[#6b7280]">Quota Satisfied</span>
                  </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Leave Balance & Action */}
      {isEmployee && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                  { label: 'Available Protocol', value: (leaveBalance?.total_leaves || 15) - (leaveBalance?.used_leaves || 0), total: leaveBalance?.total_leaves || 15, color: '#10B981', icon: Shield, suffix: 'Days' },
                  { label: 'Extended Matrix', value: leaveBalance?.extended_leaves || 0, total: 100, color: '#F43F5E', icon: Activity, suffix: 'Days' },
              ].map((lb, i) => (
                  <div key={i} className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] p-6 border-white/5 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 text-black/5 group-hover:text-black/10 transition-colors">
                          <lb.icon size={48} />
                      </div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8b8ba3]">{lb.label}</span>
                          <span className="text-xl font-black font-display italic text-black">{Number(lb.value).toString()} {lb.suffix}</span>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-1.5 mb-2 relative z-10">
                          <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: lb.total > 0 ? `${(lb.value / lb.total) * 100}%` : '0%', background: lb.color }} />
                      </div>
                  </div>
              ))}
          </div>
          <button 
              onClick={() => setShowLeaveForm(true)}
              className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/10 hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-3 p-6 group"
          >
              <div className="w-12 h-12 rounded-2xl bg-[#f3e8ff] flex items-center justify-center text-[#8b5cf6] group-hover:bg-[#8b5cf6] group-hover:text-white transition-all">
                  <Calendar size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b7280] group-hover:text-black">Request Absence</span>
          </button>
        </div>
      )}

      {/* Admin Section */}
      {isAdmin && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex gap-2">
                {[
                { id: 'today', label: "Daily Log", icon: Users },
                { id: 'leaves', label: 'Absence Queue', icon: Clock },
                { id: 'corrections', label: 'Corrections Queue', icon: Edit },
                { id: 'heatmap', label: 'Team Matrix', icon: BarChart3 },
                { id: 'search', label: 'Personnel Search', icon: Search },
                ].map(t => (
                <button key={t.id} onClick={() => setAdminTab(t.id)}
                    className={`relative flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    adminTab === t.id ? 'bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white shadow-lg shadow-transparent' : 'bg-[#f5efff] border border-[#ebe4ff] rounded-[2rem] shadow-none border-[#ece2ff] text-[#6b7280] hover:text-black'
                    }`}>
                    <t.icon size={14} />
                    {t.label}
                    {t.id === 'corrections' && correctionQueue.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">{correctionQueue.length}</span>
                    )}
                </button>
                ))}
            </div>
            
            {adminTab === 'heatmap' && (
                <div className="flex gap-2">
                    <select 
                        value={selectedMonth} 
                        onChange={e => setSelectedMonth(Number(e.target.value))}
                        className="bg-[#faf7ff] border border-[#ebe4ff] text-black text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl focus:outline-none"
                    >
                        {Array.from({length: 12}, (_, i) => (
                            <option key={i+1} value={i+1}>{new Date(2000, i).toLocaleString('default', { month: 'long' })}</option>
                        ))}
                    </select>
                    <input 
                        type="number" 
                        value={selectedYear}
                        onChange={e => setSelectedYear(Number(e.target.value))}
                        className="w-24 bg-[#faf7ff] border border-[#ebe4ff] text-black text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl focus:outline-none"
                    />
                </div>
            )}
          </div>

          {adminTab === 'today' && (
            <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/5 overflow-hidden animate-fade-in-up">
              <table className="w-full text-left">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    {['Personnel', 'Clock In', 'Clock Out', 'Status', 'Mission Log', 'Control'].map(h => (
                      <th key={h} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#8b8ba3]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {dailyLog.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-16 text-center text-[10px] text-[#b6b6c7] uppercase font-black tracking-widest italic animate-pulse">Scanning matrix for records...</td></tr>
                  ) : dailyLog.map((r, i) => (
                    <tr key={i} className="hover:bg-white/[0.02]">
                      <td className="px-6 py-4">
                          <p className="text-xs font-bold text-black uppercase italic">{r.employee_name || r.employee_code}</p>
                          <p className="text-[9px] text-[#8b8ba3] font-mono tracking-tighter uppercase">{r.designation || 'Specialist'}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-emerald-400">{r.clock_in || '—'}</td>
                      <td className="px-6 py-4 text-xs font-mono text-red-500">{r.clock_out || '—'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase italic ${
                          r.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                        }`}>{r.status}</span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-[#6b7280] italic truncate max-w-[200px]">{r.work_log || 'No notes found'}</td>
                      <td className="px-6 py-4">
                        <button 
                            onClick={() => {
                                setEditingRecord(r);
                                setEditForm({ 
                                    employee_code: r.employee_code, 
                                    date: r.date, 
                                    clock_in: r.clock_in || '', 
                                    clock_out: r.clock_out || '', 
                                    work_log: r.work_log || '' 
                                });
                            }}
                            className="p-2 rounded-xl bg-[#faf7ff] text-[#6b7280] hover:bg-gradient-to-r hover:from-[#c084fc] hover:to-[#8b5cf6] hover:text-white transition-all"
                        >
                            <Edit size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === 'leaves' && (
            <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/5 overflow-hidden animate-fade-in-up">
              <table className="w-full text-left">
                <thead className="bg-[#f5efff] border-b border-[#ebe4ff]">
                  <tr>
                    {['Applicant', 'Protocol', 'Window', 'Rationale', 'Control'].map(h => (
                      <th key={h} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#8b8ba3]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece2ff]">
                  {allLeaves.length === 0 ? (
                    <tr><td colSpan={5} className="px-6 py-16 text-center text-[10px] text-[#b6b6c7] uppercase font-black tracking-widest italic animate-pulse">Absence Queue Clear</td></tr>
                  ) : allLeaves.map((l, i) => (
                    <tr key={i} className="hover:bg-[#faf7ff]">
                      <td className="px-6 py-4">
                          <p className="text-xs font-bold text-black uppercase italic">{l.employee_name || l.employee_code}</p>
                          <p className="text-[9px] text-[#8b8ba3] font-mono uppercase">Level {l.applicant_role || '4'}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#8b5cf6] font-black uppercase italic">{l.leave_type} {l.duration_days ? `(${l.duration_days} Day${l.duration_days !== 1 ? 's' : ''})` : ''}</td>
                      <td className="px-6 py-4 text-xs font-mono text-[#6b7280]">
                          <div className="flex flex-col">
                              <span>{l.start_date} {l.start_day_type && l.start_day_type !== 'Full Day' ? `(${l.start_day_type})` : ''}</span>
                              {l.start_date !== l.end_date ? <span>↓ {l.end_date} {l.end_day_type && l.end_day_type !== 'Full Day' ? `(${l.end_day_type})` : ''}</span> : null}
                          </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-[#6b7280] max-w-xs truncate">{l.reason}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => leaveAction(l.id, 'Approved')}
                            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-400 hover:text-black transition-all">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => leaveAction(l.id, 'Rejected')}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-black transition-all">
                            <XCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {adminTab === 'corrections' && (
            <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-none border-[#ece2ff] overflow-hidden animate-fade-in-up">
              <table className="w-full text-left">
                <thead className="bg-[#f5efff] border-b border-[#ece2ff]">
                  <tr>
                    {['Personnel', 'Time Vector (Date)', 'Correction Type', 'Requested Signals', 'Rationale', 'Control'].map(h => (
                      <th key={h} className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-[#8b8ba3]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ece2ff]">
                  {correctionQueue.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-16 text-center text-[10px] text-[#b6b6c7] uppercase font-black tracking-widest italic animate-pulse">Correction Queue Clear</td></tr>
                  ) : correctionQueue.map((c, i) => (
                    <tr key={i} className="hover:bg-[#faf7ff]">
                      <td className="px-6 py-4">
                          <p className="text-xs font-bold text-black uppercase italic">{c.employee_name || c.employee_code}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-[#6b7280]">{c.date}</td>
                      <td className="px-6 py-4 text-[10px] font-black uppercase text-[#8b5cf6]">
                          {c.correction_type ? c.correction_type.replace('_', ' ') : 'Correction'}
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-[#6b7280]">
                          <div className="flex flex-col">
                              <span>In: {c.clock_in || 'N/A'}</span>
                              <span>Out: {c.clock_out || 'N/A'}</span>
                          </div>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-[#6b7280] max-w-xs truncate">{c.reason}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => actionCorrection(c.id, 'Approved')}
                            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-400 hover:text-black transition-all">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => setSelectedCorrectionId(c.id)}
                            className="p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-black transition-all">
                            <XCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TEAM MATRIX HEATMAP TAB */}
          {adminTab === 'heatmap' && (
              <div className="space-y-4 animate-fade-in-up">
                  {/* Dashboard Statistics Above Heatmap - Updated Alignment to Matrix Colors */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                          { label: 'Present Today', count: totalPresent, bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
                          { label: 'On Leave', count: totalLeave, bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                          { label: 'Half Day', count: totalHalfDay, bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                          { label: 'Absent Today', count: totalAbsent, bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                      ].map((card) => (
                          <div key={card.label} className="bg-white border border-[#ebe4ff] rounded-2xl p-4 flex justify-between items-center shadow-sm">
                              <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-[#6b7280] flex items-center gap-1.5">
                                      {card.label}
                                  </p>
                                  <p className="text-2xl font-black text-black mt-1">{card.count}</p>
                              </div>
                              <span className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full ${card.bg} ${card.text} border ${card.border}`}>
                                  Total
                              </span>
                          </div>
                      ))}
                  </div>

                  {/* Heatmap Grid Layout */}
                  <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-none border-[#ece2ff] overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[1200px]">
                          <thead>
                              <tr className="bg-[#f8f5ff]">
                                  <th className="sticky left-0 bg-[#f8f5ff] px-6 py-3 text-[9px] font-black uppercase tracking-widest text-[#8b8ba3] border-r border-[#ece2ff] z-20">Personnel Matrix</th>
                                  {Array.from({length: new Date(selectedYear, selectedMonth, 0).getDate()}, (_, i) => (
                                      <th
                                          key={i + 1}
                                          className="h-[40px] min-w-[32px] text-[11px] font-semibold text-center text-[#6b7280] border-r border-[#ebe7f5]"
                                      >
                                          {i+1}
                                      </th>
                                  ))}
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-[#ece2ff]">
                              {attendanceSummary.map((emp, i) => (
                                  <tr key={i} className="hover:bg-[#faf7ff]">
                                      <td className="sticky left-0 bg-white px-6 py-2 border-r border-[#ece2ff] z-10 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                                          <p className="text-[11px] font-bold text-black uppercase italic truncate max-w-[180px]">{emp.name}</p>
                                          <p className="text-[9px] text-[#9ca3af] font-mono">{emp.code}</p>
                                      </td>
                                      {emp.days.map((d, di) => {
                                          let cellStyle = { backgroundColor: '#E5E7EB' };
                                          let extraClass = "";

                                          if (d.status === 'Present') {
                                              cellStyle = { backgroundColor: '#22C55E' };
                                          } else if (d.status === 'Active') {
                                              cellStyle = { 
                                                  backgroundColor: '#22C55E',
                                                  boxShadow: '0 0 12px rgba(34,197,94,0.6)'
                                              };
                                              extraClass = "animate-pulse";
                                          } else if (d.status.startsWith('Half Day Leave')) {
                                              cellStyle = { backgroundColor: '#8B5CF6' }; // Purple for clear UX contrast
                                          } else if (d.status.startsWith('Half Day')) {
                                              cellStyle = { backgroundColor: '#F59E0B' };
                                          } else if (d.status === 'Absent') {
                                              cellStyle = { backgroundColor: '#EF4444' };
                                          } else if (d.status === 'Leave') {
                                              cellStyle = { backgroundColor: '#3B82F6' };
                                          } else if (d.status === 'Weekend' || d.status === 'No Data') {
                                              cellStyle = { backgroundColor: '#E5E7EB' };
                                          }
                                                                            
                                          return (
                                              <td key={di} className="h-[40px] w-[32px] border-r border-[#ebe7f5] text-center align-middle">
                                                  <div className="flex items-center justify-center w-full h-full">
                                                      <div
                                                          title={`${d.date}: ${d.status}`}
                                                          className={`w-[24px] h-[24px] rounded-[6px] hover:scale-110 transition-all duration-200 cursor-pointer ${extraClass}`}
                                                          style={cellStyle}
                                                      />
                                                  </div>
                                              </td>
                                          );
                                      })}
                                  </tr>
                              ))}
                          </tbody>
                      </table>

                      {/* Legend with Chip Format */}
                      <div className="px-6 py-4 border-t border-[#ece2ff] flex flex-wrap gap-3 bg-[#faf9ff]">
                          {[
                              { label: 'Present', dotColor: '#22C55E', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
                              { label: 'Active', dotColor: '#22C55E', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', pulse: true },
                              { label: 'Half Day (Attendance)', dotColor: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
                              { label: 'Absent', dotColor: '#EF4444', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
                              { label: 'Leave', dotColor: '#3B82F6', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
                              { label: 'Half Day (Leave)', dotColor: '#8B5CF6', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
                              { label: 'Weekend / No Data', dotColor: '#E5E7EB', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
                          ].map(l => (
                              <div key={l.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${l.bg} ${l.text} border ${l.border}`}>
                                  <div 
                                      className={`w-2.5 h-2.5 rounded-full ${l.pulse ? 'animate-pulse' : ''}`} 
                                      style={{ 
                                          backgroundColor: l.dotColor,
                                          boxShadow: l.pulse ? '0 0 8px rgba(34,197,94,0.6)' : 'none'
                                      }} 
                                  />
                                  <span>{l.label}</span>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          )}

          {adminTab === 'search' && (
              <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-none border-[#ece2ff] overflow-hidden animate-fade-in-up p-8">
                  <div className="max-w-xl mx-auto space-y-6">
                      <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#8b8ba3]">
                              <Search size={16} />
                          </div>
                          <select 
                              value={selectedEmployee?.employee_code || ''}
                              onChange={(e) => {
                                  const emp = employees.find(emp => emp.employee_code === e.target.value);
                                  setSelectedEmployee(emp);
                                  searchEmployeeRecords(emp?.employee_code);
                              }}
                              className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-sm px-10 py-4 rounded-2xl focus:outline-none focus:border-[#c084fc] transition-all appearance-none"
                          >
                              <option value="">Select personnel to inspect...</option>
                              {employees.map(e => (
                                  <option key={e.employee_code} value={e.employee_code}>
                                      {e.name} ({e.employee_code})
                                  </option>
                              ))}
                          </select>
                      </div>

                      {isSearching ? (
                          <div className="flex justify-center p-10"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
                      ) : selectedEmployee ? (
                          <div className="grid grid-cols-1 gap-6 mt-8">
                              <div className="flex items-center gap-4 bg-[#f5efff] p-4 rounded-2xl border border-[#ece2ff]">
                                  <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-primary font-black text-xl">
                                      {selectedEmployee.name.charAt(0)}
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-black uppercase italic">{selectedEmployee.name}</h3>
                                      <p className="text-[10px] text-[#8b8ba3] font-mono">{selectedEmployee.employee_code}</p>
                                  </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div className="bg-white border border-[#ece2ff] rounded-2xl overflow-hidden flex flex-col h-80">
                                      <div className="px-5 py-4 border-b border-[#ece2ff] bg-[#faf7ff]">
                                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#6b7280]">Log History</h4>
                                      </div>
                                      <div className="overflow-y-auto divide-y divide-[#ece2ff] flex-1">
                                          {searchedEmployeeHistory.length === 0 ? <p className="p-6 text-center text-[10px] text-[#b6b6c7] font-black uppercase italic">No records</p> : searchedEmployeeHistory.map((h, i) => (
                                              <div key={i} className="px-5 py-3 hover:bg-[#faf7ff] transition-colors cursor-pointer" onClick={() => setSelectedLog(h)}>
                                                  <div className="flex justify-between items-center">
                                                      <div>
                                                          <p className="text-[11px] font-bold text-black">{new Date(h.date).toLocaleDateString()}</p>
                                                          <p className="text-[9px] text-[#8b8ba3] font-mono">{h.clock_in} - {h.clock_out || '??'}</p>
                                                      </div>
                                                      <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${h.status === 'Present' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>{h.status}</span>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                                  
                                  <div className="bg-white border border-[#ece2ff] rounded-2xl overflow-hidden flex flex-col h-80">
                                      <div className="px-5 py-4 border-b border-[#ece2ff] bg-[#faf7ff]">
                                          <h4 className="text-[10px] font-black uppercase tracking-widest text-[#6b7280]">Leave History</h4>
                                      </div>
                                      <div className="overflow-y-auto divide-y divide-[#ece2ff] flex-1">
                                          {searchedEmployeeLeaves.length === 0 ? <p className="p-6 text-center text-[10px] text-[#b6b6c7] font-black uppercase italic">No records</p> : searchedEmployeeLeaves.map((l, i) => (
                                              <div key={i} className="px-5 py-3 hover:bg-[#faf7ff] transition-colors cursor-pointer" onClick={() => setSelectedLog({ type: 'leave', ...l })}>
                                                  <div className="flex justify-between items-center">
                                                      <div>
                                                          <p className="text-[11px] font-bold text-black">{l.leave_type} {l.duration_days ? `(${l.duration_days} Day${l.duration_days !== 1 ? 's' : ''})` : ''}</p>
                                                          <p className="text-[9px] text-[#8b8ba3] font-mono">{l.start_date} {l.start_day_type && l.start_day_type !== 'Full Day' ? `(${l.start_day_type})` : ''} to {l.end_date} {l.end_day_type && l.end_day_type !== 'Full Day' ? `(${l.end_day_type})` : ''}</p>
                                                      </div>
                                                      <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${l.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-500' : l.status === 'Rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>{l.status || 'Pending'}</span>
                                                  </div>
                                              </div>
                                          ))}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center py-10 opacity-30">
                              <Search size={48} className="mx-auto mb-4 text-[#8b8ba3]" />
                              <p className="text-[10px] font-black uppercase tracking-widest text-[#6b7280]">Select personnel to view matrix</p>
                          </div>
                      )}
                  </div>
              </div>
          )}
        </div>
      )}


      {/* History Grids */}
      {!isAdmin && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Attendance History */}
        <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] shadow-none border-[#ece2ff] overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-[#ece2ff] bg-[#f5efff] flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b7280] flex items-center gap-2">
                    <BarChart3 size={14} className="text-[#8b5cf6]" /> Log History
                </h3>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[#ece2ff] scrollbar-hide">
                {history.length === 0 ? (
                    <p className="p-10 text-center text-[9px] uppercase font-black text-[#b6b6c7]">No logs decrypted</p>
                ) : history.map((h, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-[#faf7ff] transition-colors cursor-pointer" onClick={() => setSelectedLog(h)}>
                        <div>
                            <p className="text-xs font-black text-black italic">{new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            <p className="text-[9px] text-[#8b8ba3] font-mono uppercase">Session: {h.clock_in} - {h.clock_out || '??'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase italic ${
                                h.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>{h.status}</span>
                            {h.status === 'Absent' && isWithinLast7Days(h.date) && (
                                submittedCorrections.has(h.date) ? (
                                    <span className="px-3 py-1 rounded text-[8px] font-black uppercase bg-amber-500/10 text-amber-500">Correction Pending</span>
                                ) : (
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCorrectionForm({ ...correctionForm, date: h.date, clock_in: h.clock_in || '', clock_out: h.clock_out || '' });
                                            setShowCorrectionForm(true);
                                        }}
                                        className="px-3 py-1 rounded text-[8px] font-black uppercase bg-[#f5efff] text-[#8b5cf6] border border-[#ebe4ff] hover:bg-[#8b5cf6] hover:text-white transition-all"
                                    >
                                        Request Correction
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Absence History */}
        <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-none border-[#ece2ff] overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-[#ece2ff] bg-[#f5efff] flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#6b7280] flex items-center gap-2">
                <Calendar size={14} className="text-secondary" /> Request History
            </h3>
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-[#ece2ff] scrollbar-hide">
            {myLeaves.length === 0 ? (
                <p className="p-10 text-center text-[9px] uppercase font-black text-[#b6b6c7]">No requests filed</p>
            ) : myLeaves.map((l, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-[#faf7ff] transition-colors cursor-pointer" onClick={() => setSelectedLog({ type: 'leave', ...l })}>
                <div>
                  <p className="text-xs font-black text-black italic">{l.leave_type} Protocol {l.duration_days ? `(${l.duration_days} Day${l.duration_days !== 1 ? 's' : ''})` : ''}</p>
                  <p className="text-[9px] text-[#8b8ba3] font-mono uppercase">{l.start_date} {l.start_day_type && l.start_day_type !== 'Full Day' ? `(${l.start_day_type})` : ''} to {l.end_date} {l.end_day_type && l.end_day_type !== 'Full Day' ? `(${l.end_day_type})` : ''}</p>
                </div>
                <span className={`px-4 py-1 rounded-full text-[8px] font-black uppercase italic ${
                  l.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400' :
                  l.status === 'Rejected' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'
                }`}>{l.status || 'Pending'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Correction Request Modal */}
      {showCorrectionForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
          <form onSubmit={applyCorrection} className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-none border-[#ece2ff] p-10 w-full max-w-md space-y-6 relative overflow-hidden bg-[#faf7ff]">
            <div className="absolute top-0 right-0 p-8 opacity-5"><Edit size={100} /></div>
            
            <div className="relative z-10">
                <h3 className="text-xl font-display font-black text-black uppercase italic tracking-widest mb-1">Fix <span className="text-[#8b5cf6]">Matrix Record</span></h3>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#8b8ba3] mb-8">Correction Protocol</p>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Time Vector (Date)</label>
                        <input 
                            disabled
                            value={correctionForm.date}
                            className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black/40 text-xs px-4 py-4 rounded-xl focus:outline-none font-bold"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Correction Type</label>
                        <select
                            value={correctionForm.correction_type}
                            onChange={e => setCorrectionForm({...correctionForm, correction_type: e.target.value})}
                            className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all uppercase font-mono"
                        >
                            <option value="missed_clockin">Missed Clock In</option>
                            <option value="missed_clockout">Missed Clock Out</option>
                            <option value="both">Both</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Corrected Clock In</label>
                            <input 
                                type="time"
                                step="1"
                                required={correctionForm.correction_type === 'missed_clockin' || correctionForm.correction_type === 'both'}
                                disabled={correctionForm.correction_type === 'missed_clockout'}
                                value={correctionForm.clock_in}
                                onChange={e => setCorrectionForm({...correctionForm, clock_in: e.target.value})}
                                className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Corrected Clock Out</label>
                            <input 
                                type="time"
                                step="1"
                                required={correctionForm.correction_type === 'missed_clockout' || correctionForm.correction_type === 'both'}
                                disabled={correctionForm.correction_type === 'missed_clockin'}
                                value={correctionForm.clock_out}
                                onChange={e => setCorrectionForm({...correctionForm, clock_out: e.target.value})}
                                className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all font-mono"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Correction Rationale</label>
                        <textarea 
                            required
                            placeholder="Explain why correction is needed..."
                            value={correctionForm.reason}
                            onChange={e => setCorrectionForm({...correctionForm, reason: e.target.value})}
                            rows={3}
                            className="w-full bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/10 text-black text-xs bg-white/5 px-4 py-4 rounded-xl focus:outline-none focus:border-primary/50 transition-all resize-none placeholder:text-black/10"
                        />
                    </div>
                </div>

                <div className="flex gap-4 mt-10">
                    <button 
                        type="button"
                        onClick={() => setShowCorrectionForm(false)}
                        className="flex-1 py-4 rounded-2xl border border-[#ebe4ff] text-black/40 text-[10px] font-black uppercase tracking-widest hover:text-black hover:bg-white/5 transition-all"
                    >
                        Abort
                    </button>
                    <button 
                        type="submit"
                        className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/10 font-display italic"
                    >
                        Submit Correction
                    </button>
                </div>
            </div>
          </form>
        </div>
      )}

      {/* Absence Request Modal */}
      {showLeaveForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
          <form onSubmit={applyLeave} className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-none border-[#ece2ff] p-10 w-full max-w-md space-y-6 relative overflow-hidden bg-[#faf7ff]">
            <div className="absolute top-0 right-0 p-8 opacity-5"><Calendar size={100} /></div>
            
            <div className="relative z-10">
                <h3 className="text-xl font-display font-black text-black uppercase italic tracking-widest mb-1">Request <span className="text-[#8b5cf6]">Absence</span></h3>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#8b8ba3] mb-8">Authorization Protocol 77-A</p>
                
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Protocol Type</label>
                        <input 
                            disabled
                            value="Standard Leave"
                            className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black/40 text-xs px-4 py-4 rounded-xl focus:outline-none uppercase font-bold"
                        />
                    </div>

                    <div className="space-y-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Commencement</label>
                                <input 
                                    type="date"
                                    required
                                    min={new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                                    value={leaveForm.start_date}
                                    onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})}
                                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all uppercase font-mono"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Termination</label>
                                <input 
                                    type="date"
                                    required
                                    min={new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                                    value={leaveForm.end_date}
                                    onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})}
                                    className="w-full bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/10 text-black text-xs bg-white/5 px-4 py-4 rounded-xl focus:outline-none focus:border-primary/50 transition-all uppercase font-mono"
                                />
                            </div>
                        </div>
                        <p className="text-[8px] font-bold text-[#8b8ba3] px-2">* You can apply for leaves up to 15 days in the past.</p>
                        {leaveForm.start_date && new Date(leaveForm.start_date) < new Date(new Date().setHours(0,0,0,0)) && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 text-amber-600 border border-amber-200">
                                <AlertCircle size={10} />
                                <span className="text-[8px] font-black uppercase tracking-widest">This will be marked as a retroactive leave</span>
                            </div>
                        )}
                    </div>

                    {leaveForm.start_date && leaveForm.end_date && isSingleDay && (
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Duration Type</label>
                            <select
                                value={leaveForm.start_day_type}
                                onChange={e => setLeaveForm({...leaveForm, start_day_type: e.target.value, end_day_type: e.target.value})}
                                className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all uppercase font-mono"
                            >
                                <option value="Full Day">Full Day</option>
                                <option value="First Half">First Half</option>
                                <option value="Second Half">Second Half</option>
                            </select>
                        </div>
                    )}
                    
                    {leaveForm.start_date && leaveForm.end_date && !isSingleDay && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Start Day Type</label>
                                <select
                                    value={leaveForm.start_day_type}
                                    onChange={e => setLeaveForm({...leaveForm, start_day_type: e.target.value})}
                                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all uppercase font-mono"
                                >
                                    <option value="Full Day">Full Day</option>
                                    <option value="Second Half">Second Half</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">End Day Type</label>
                                <select
                                    value={leaveForm.end_day_type}
                                    onChange={e => setLeaveForm({...leaveForm, end_day_type: e.target.value})}
                                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all uppercase font-mono"
                                >
                                    <option value="Full Day">Full Day</option>
                                    <option value="First Half">First Half</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {leaveForm.start_date && leaveForm.end_date && durationDays > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Deduction:</span>
                            <span className="text-sm font-black text-emerald-700">{durationDays} Day{durationDays !== 1 && 's'}</span>
                        </div>
                    )}

                    {leaveForm.start_date && leaveForm.end_date && isSingleDay && (
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Duration Type</label>
                            <select
                                value={leaveForm.start_day_type}
                                onChange={e => setLeaveForm({...leaveForm, start_day_type: e.target.value, end_day_type: e.target.value})}
                                className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all uppercase font-mono"
                            >
                                <option value="Full Day">Full Day</option>
                                <option value="First Half">First Half</option>
                                <option value="Second Half">Second Half</option>
                            </select>
                        </div>
                    )}
                    
                    {leaveForm.start_date && leaveForm.end_date && !isSingleDay && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Start Day Type</label>
                                <select
                                    value={leaveForm.start_day_type}
                                    onChange={e => setLeaveForm({...leaveForm, start_day_type: e.target.value})}
                                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all uppercase font-mono"
                                >
                                    <option value="Full Day">Full Day</option>
                                    <option value="Second Half">Second Half</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">End Day Type</label>
                                <select
                                    value={leaveForm.end_day_type}
                                    onChange={e => setLeaveForm({...leaveForm, end_day_type: e.target.value})}
                                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none focus:border-[#d4b5fd] transition-all uppercase font-mono"
                                >
                                    <option value="Full Day">Full Day</option>
                                    <option value="First Half">First Half</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {leaveForm.start_date && leaveForm.end_date && durationDays > 0 && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Total Deduction:</span>
                            <span className="text-sm font-black text-emerald-700">{durationDays} Day{durationDays !== 1 && 's'}</span>
                        </div>
                    )}

                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Protocol Rationale</label>
                        <textarea 
                            required
                            placeholder="State mission-critical reasons for absence..."
                            value={leaveForm.reason}
                            onChange={e => setLeaveForm({...leaveForm, reason: e.target.value})}
                            rows={3}
                            className="w-full bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/10 text-black text-xs bg-white/5 px-4 py-4 rounded-xl focus:outline-none focus:border-primary/50 transition-all resize-none placeholder:text-black/10"
                        />
                    </div>
                </div>

                <div className="flex gap-4 mt-10">
                    <button 
                        type="button"
                        onClick={() => setShowLeaveForm(false)}
                        className="flex-1 py-4 rounded-2xl border border-white/10 text-black/40 text-[10px] font-black uppercase tracking-widest hover:text-black hover:bg-white/5 transition-all"
                    >
                        Abort
                    </button>
                    <button 
                        type="submit"
                        className="flex-1 py-4 rounded-2xl bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-primary/10 font-display italic"
                    >
                        File Request
                    </button>
                </div>
            </div>
          </form>
        </div>
      )}
      {/* Clock Out Modal */}
      {showClockOutModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-fade-in p-4">
          <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/10 p-10 w-full max-w-md space-y-8 relative overflow-hidden bg-[#0B1326]">
             <div className="absolute top-0 right-0 p-8 opacity-5 text-red-500"><LogOut size={120} /></div>
             
             <div className="relative z-10 text-center">
                    <h3 className="text-2xl font-display font-black text-black uppercase italic tracking-widest mb-2">Finalize <span className="text-red-500">Session</span></h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/30 mb-8">Debrief Protocol Required</p>
                 
                 <div className="space-y-6 text-left">
                    <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-red-400/60 mb-3 block ml-1">Work Rationale / Summary</label>
                        <textarea 
                            required
                            placeholder="State your accomplishments for the session..."
                            value={workLog}
                            onChange={e => setWorkLog(e.target.value)}
                            rows={4}
                            className="w-full bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/10 text-black text-sm bg-white/5 px-5 py-5 rounded-2xl focus:outline-none focus:border-red-500/50 transition-all resize-none placeholder:text-black/10"
                        />
                    </div>
                    
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setShowClockOutModal(false)}
                            className="flex-1 px-8 py-5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-black/40 hover:bg-white/5 transition-all"
                        >
                            Abort
                        </button>
                        <button 
                            onClick={clockOut}
                            className="flex-[2] px-10 py-5 bg-red-50 text-black text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-red-400 transition-all shadow-xl shadow-red-500/20 font-display italic flex items-center justify-center gap-3"
                        >
                            Sync & Terminate <CheckCircle size={16} />
                        </button>
                    </div>
                 </div>
             </div>
          </div>
        </div>
      )}

      {/* Reject Correction Modal */}
      {selectedCorrectionId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-[#060b19]/80 backdrop-blur-sm" onClick={() => setSelectedCorrectionId(null)} />
              <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] w-full max-w-md relative z-10 animate-fade-in-up overflow-hidden">
                  <div className="p-6 border-b border-[#ece2ff] bg-[#faf7ff] flex justify-between items-center relative">
                      <div className="relative z-10">
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-black italic">Reject Correction</h3>
                      </div>
                      <button onClick={() => setSelectedCorrectionId(null)} className="p-2 text-[#8b8ba3] hover:text-black transition-colors relative z-10">
                          <XCircle size={20} />
                      </button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-red-500 mb-2 block ml-1">Rejection Rationale (Optional)</label>
                        <textarea 
                            value={rejectionReason}
                            onChange={e => setRejectionReason(e.target.value)}
                            className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none h-24 resize-none"
                            placeholder="State reason for rejection..."
                        />
                      </div>
                      <button 
                        onClick={() => actionCorrection(selectedCorrectionId, 'Rejected', rejectionReason)}
                        className="w-full py-4 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-600 transition-all shadow-xl shadow-transparent"
                      >
                        Confirm Rejection
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Edit Attendance Modal */}
      {editingRecord && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-[#060b19]/80 backdrop-blur-sm" onClick={() => setEditingRecord(null)} />
              <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] border-white/10 w-full max-w-lg relative z-10 animate-fade-in-up overflow-hidden">
                  <div className="p-6 border-b border-[#ece2ff] bg-[#faf7ff] flex justify-between items-center">
                      <div>
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-black italic">Matrix Synchronization</h3>
                          <p className="text-[9px] text-[#8b8ba3] uppercase font-bold mt-1">Personnel Record Adjustment Protocol</p>
                      </div>
                      <button onClick={() => setEditingRecord(null)} className="p-2 text-[#8b8ba3] hover:text-black transition-colors">
                          <XCircle size={20} />
                      </button>
                  </div>
                  <div className="p-8 space-y-6">
                      <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Personnel Node</label>
                            {editingRecord.isNew ? (
                                <select 
                                    value={editForm.employee_code}
                                    onChange={e => setEditForm({...editForm, employee_code: e.target.value})}
                                    className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none"
                                >
                                    <option value="" className="bg-white">Select Node...</option>
                                    {employees.map(e => (
                                        <option key={e.employee_code} value={e.employee_code} className="text-black">{e.name} ({e.employee_code})</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-[#8b8ba3] text-xs px-4 py-4 rounded-xl font-bold uppercase italic">
                                    {editingRecord.employee_name || editingRecord.employee_code}
                                </div>
                            )}
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Time Vector (Date)</label>
                            <input 
                                type="date"
                                disabled={!editingRecord.isNew}
                                value={editForm.date}
                                onChange={e => setEditForm({...editForm, date: e.target.value})}
                                className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none disabled:opacity-50"
                            />
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Signal Start (Clock In)</label>
                            <input 
                                type="time"
                                step="1"
                                value={editForm.clock_in}
                                onChange={e => setEditForm({...editForm, clock_in: e.target.value})}
                                className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Signal End (Clock Out)</label>
                            <input 
                                type="time"
                                step="1"
                                value={editForm.clock_out}
                                onChange={e => setEditForm({...editForm, clock_out: e.target.value})}
                                className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none"
                            />
                          </div>
                      </div>

                      <div>
                        <label className="text-[9px] font-black uppercase tracking-widest text-[#8b5cf6] mb-2 block ml-1">Mission Rationale (Work Log)</label>
                        <textarea 
                            value={editForm.work_log}
                            onChange={e => setEditForm({...editForm, work_log: e.target.value})}
                            className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs px-4 py-4 rounded-xl focus:outline-none h-24 resize-none"
                            placeholder="Detail the activities conducted during this shift..."
                        />
                      </div>

                      <button 
                        onClick={saveAttendanceEdit}
                        disabled={!editForm.employee_code || !editForm.date}
                        className="w-full py-4 bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-transparent disabled:opacity-50"
                      >
                        Synchronize Matrix Record
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* View Log Modal */}
      {selectedLog && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-[#060b19]/80 backdrop-blur-sm" onClick={() => setSelectedLog(null)} />
              <div className="bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_10px_40px_rgba(180,140,255,0.08)] w-full max-w-md relative z-10 animate-fade-in-up overflow-hidden">
                  <div className="p-6 border-b border-[#ece2ff] bg-[#faf7ff] flex justify-between items-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5"><Activity size={60} /></div>
                      <div className="relative z-10">
                          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-black italic">
                              {selectedLog.type === 'leave' ? 'Absence Rationale' : 'Session Debrief'}
                          </h3>
                          <p className="text-[9px] text-[#8b8ba3] uppercase font-bold mt-1">
                              {selectedLog.type === 'leave' ? `${selectedLog.start_date} to ${selectedLog.end_date}` : `${selectedLog.date} (${selectedLog.clock_in} - ${selectedLog.clock_out || 'Active'})`}
                          </p>
                      </div>
                      <button onClick={() => setSelectedLog(null)} className="p-2 text-[#8b8ba3] hover:text-black transition-colors relative z-10">
                          <XCircle size={20} />
                      </button>
                  </div>
                  <div className="p-8">
                      <div className="bg-[#faf7ff] border border-[#ece2ff] rounded-2xl p-6 relative">
                          <div className="absolute -top-3 -left-3 bg-white p-1 rounded-full border border-[#ece2ff] text-primary">
                              <Zap size={16} />
                          </div>
                          <p className="text-sm text-black whitespace-pre-wrap font-medium">
                              {selectedLog.type === 'leave' 
                                  ? selectedLog.reason || <span className="text-[#8b8ba3] italic">No rationale provided.</span>
                                  : selectedLog.work_log || <span className="text-[#8b8ba3] italic">No work log recorded for this session.</span>
                              }
                          </p>
                      </div>
                      {selectedLog.type === 'leave' && selectedLog.rejection_reason && (
                          <div className="mt-4 bg-[#fff1f2] border border-[#ffe4e6] rounded-2xl p-6 relative">
                              <div className="absolute -top-3 -left-3 bg-white p-1 rounded-full border border-[#ffe4e6] text-red-500">
                                  <Shield size={16} />
                              </div>
                              <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-2">Rejection Feedback</p>
                              <p className="text-sm text-red-900 whitespace-pre-wrap font-medium">
                                  {selectedLog.rejection_reason}
                              </p>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}