import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Calendar, TrendingUp, Award, RefreshCw,
  AlertCircle, BookOpen, Clock, ArrowUpRight, CheckCircle,
  XCircle, ChevronRight, User, ShieldAlert
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  AreaChart, Area, RadialBarChart, RadialBar, Legend, LineChart, Line
} from 'recharts';

const PALETTE = [
  '#7C3AED', '#10B981', '#F59E0B', '#EF4444',
  '#06B6D4', '#3B82F6', '#EC4899', '#6366F1'
];

// Reusable custom glassmorphic Tooltip for Recharts
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-md border border-[#ebe4ff] rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(124,58,237,0.1)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#7C3AED] mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2.5 text-xs font-bold" style={{ color: p.color || p.fill }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-black/60 font-semibold">{p.name}:</span>
          <span className="text-black font-extrabold">{p.value}%</span>
        </div>
      ))}
    </div>
  );
};

// Tooltip for raw counts (e.g. days or tasks)
const CountTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-md border border-[#ebe4ff] rounded-2xl px-4 py-3 shadow-[0_10px_30px_rgba(124,58,237,0.1)]">
      <p className="text-[10px] font-black uppercase tracking-widest text-[#7C3AED] mb-1.5">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2.5 text-xs font-bold" style={{ color: p.color || p.fill }}>
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: p.color || p.fill }} />
          <span className="text-black/60 font-semibold">{p.name}:</span>
          <span className="text-black font-extrabold">{p.value} {p.value === 1 ? 'day' : 'days'}</span>
        </div>
      ))}
    </div>
  );
};

// Premium Stat Card with card hover lift and soft glow
const StatCard = ({ label, value, color, icon: Icon, sub, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white border border-[#ebe4ff] rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(180,140,255,0.04)] relative overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_50px_rgba(124,58,237,0.08)] ${onClick ? 'cursor-pointer' : ''}`}
  >
    {/* Ambient light glow inside the card */}
    <div 
      className="absolute -top-12 -right-12 w-28 h-28 rounded-full blur-[40px] opacity-20 pointer-events-none"
      style={{ background: color }}
    />
    <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 hover:scale-105"
      style={{ background: `${color}15`, border: `1px solid ${color}25` }}>
      <Icon size={20} style={{ color }} />
    </div>
    <h3 className="text-5xl font-black leading-none mb-3 tracking-tight" style={{ color }}>{value}</h3>
    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/50">{label}</p>
    {sub && <p className="text-[9px] text-black/35 mt-2.5 uppercase tracking-wider font-bold">{sub}</p>}
  </div>
);

// Chart container card with heading
const ChartCard = ({ title, children, className = '', action }) => (
  <div className={`bg-white border border-[#ebe4ff] rounded-[2rem] p-8 shadow-[0_10px_40px_rgba(180,140,255,0.04)] flex flex-col gap-6 relative transition-all duration-300 hover:shadow-[0_15px_45px_rgba(124,58,237,0.06)] ${className}`}>
    <div className="flex justify-between items-center">
      <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7C3AED]">{title}</h3>
      {action && <div>{action}</div>}
    </div>
    <div className="w-full h-[280px]">{children}</div>
  </div>
);

// Default fallbacks for empty databases
const MOCK_TRAINING = [
  { training_name: 'Cybersecurity Principles', training_status: 'Completed', training_date: '2026-04-10', training_duration: '2h' },
  { training_name: 'Phygitron Platform Essentials', training_status: 'Completed', training_date: '2026-04-15', training_duration: '1.5h' },
  { training_name: 'GDPR Compliance 2026', training_status: 'In Progress', training_date: '2026-05-02', training_duration: '3h' },
  { training_name: 'Professional Integrity & DEI', training_status: 'Assigned', training_date: '2026-05-18', training_duration: '1h' }
];

const MOCK_PERF_TREND = [
  { name: 'Jan', Score: 72 },
  { name: 'Feb', Score: 78 },
  { name: 'Mar', Score: 81 },
  { name: 'Apr', Score: 85 },
  { name: 'May', Score: 89 }
];

export default function EmployeeDashboard({ mode = 'employee', user }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [period, setPeriod] = useState('month'); // 'month' | 'quarter' | 'year'
  const [selectedPerfType, setSelectedPerfType] = useState('Quarterly');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard/employee-stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load dashboard statistics');
      const data = await res.json();
      setProfile(data);
      setLastRefresh(new Date());
    } catch (e) {
      toast.error(e.message || 'Failed to load employee metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Dynamically set default selected performance review type to the most populated one
  useEffect(() => {
    const history = profile?.performance_history || [];
    if (history.length > 0) {
      const counts = {};
      let maxType = 'Quarterly';
      let maxCount = 0;
      history.forEach(p => {
        counts[p.period_type] = (counts[p.period_type] || 0) + 1;
        if (counts[p.period_type] > maxCount) {
          maxCount = counts[p.period_type];
          maxType = p.period_type;
        }
      });
      setSelectedPerfType(maxType);
    }
  }, [profile]);

  // Client-side analytics parsing and period aggregation
  const analytics = useMemo(() => {
    if (!profile) return null;

    const history = profile.attendance?.history || [];
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // 1. Process Attendance data based on selected period
    let present = 0;
    let halfDay = 0;
    let absent = 0;
    let summaryText = '';
    let chartData = [];
    let chartType = 'pie';

    // Map existing attendance for O(1) lookups
    const attendanceMap = {};
    history.forEach(item => {
      attendanceMap[item.date] = item.status;
    });

    if (period === 'month') {
      const currentDayLimit = today.getDate();
      for (let day = 1; day <= currentDayLimit; day++) {
        const d = new Date(currentYear, currentMonth, day);
        if (d.getDay() !== 0 && d.getDay() !== 6) { // Weekdays only
          const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const status = attendanceMap[dateStr];
          if (status) {
            const lowerStatus = status.toLowerCase();
            if (lowerStatus.includes('half') || lowerStatus.includes('hd')) {
              halfDay++;
            } else if (lowerStatus.includes('absent')) {
              absent++;
            } else {
              present++;
            }
          } else {
            absent++; // weekday with no log counts as absent
          }
        }
      }
      const totalDays = present + halfDay + absent;
      const rate = totalDays > 0 ? Math.round(((present + halfDay * 0.5) / totalDays) * 100) : 100;

      chartData = [
        { name: 'Present', value: present, fill: '#10B981' },
        { name: 'Half Day', value: halfDay, fill: '#F59E0B' },
        { name: 'Absent', value: absent, fill: '#EF4444' }
      ].filter(item => item.value > 0);

      summaryText = `${present}P · ${halfDay}HD · ${absent}A this month`;
      chartType = 'pie';

      return {
        attendanceRate: rate,
        attendanceSummary: summaryText,
        attendanceChartData: chartData,
        attendanceChartType: chartType
      };
    } else if (period === 'quarter') {
      // Comparison of last 3 months
      const monthsList = [];
      for (let i = 2; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const mYear = d.getFullYear();
        const mMonth = d.getMonth();
        const monthName = d.toLocaleString('default', { month: 'short' });

        const isCurrentMonth = mYear === currentYear && mMonth === currentMonth;
        const lastDay = isCurrentMonth ? today.getDate() : new Date(mYear, mMonth + 1, 0).getDate();

        let mPresent = 0;
        let mHalfDay = 0;
        let mAbsent = 0;

        for (let day = 1; day <= lastDay; day++) {
          const curDate = new Date(mYear, mMonth, day);
          if (curDate.getDay() !== 0 && curDate.getDay() !== 6) {
            const dateStr = `${mYear}-${String(mMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const status = attendanceMap[dateStr];
            if (status) {
              const lowerStatus = status.toLowerCase();
              if (lowerStatus.includes('half') || lowerStatus.includes('hd')) {
                mHalfDay++;
              } else if (lowerStatus.includes('absent')) {
                mAbsent++;
              } else {
                mPresent++;
              }
            } else {
              mAbsent++;
            }
          }
        }

        const totalDays = mPresent + mHalfDay + mAbsent;
        const rate = totalDays > 0 ? Math.round(((mPresent + mHalfDay * 0.5) / totalDays) * 100) : 100;
        monthsList.push({ name: monthName, Rate: rate, Present: mPresent, Absent: mAbsent });
      }

      const avgRate = Math.round(monthsList.reduce((acc, m) => acc + m.Rate, 0) / monthsList.length);
      summaryText = `Avg ${avgRate}% over past 3 months`;

      return {
        attendanceRate: avgRate,
        attendanceSummary: summaryText,
        attendanceChartData: monthsList,
        attendanceChartType: 'bar'
      };
    } else {
      // Year to Date trend
      const monthsList = [];
      const upToMonth = today.getMonth();

      for (let m = 0; m <= upToMonth; m++) {
        const d = new Date(currentYear, m, 1);
        const monthName = d.toLocaleString('default', { month: 'short' });

        const isCurrentMonth = m === currentMonth;
        const lastDay = isCurrentMonth ? today.getDate() : new Date(currentYear, m + 1, 0).getDate();

        let mPresent = 0;
        let mHalfDay = 0;
        let mAbsent = 0;

        for (let day = 1; day <= lastDay; day++) {
          const curDate = new Date(currentYear, m, day);
          if (curDate.getDay() !== 0 && curDate.getDay() !== 6) {
            const dateStr = `${currentYear}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const status = attendanceMap[dateStr];
            if (status) {
              const lowerStatus = status.toLowerCase();
              if (lowerStatus.includes('half') || lowerStatus.includes('hd')) {
                mHalfDay++;
              } else if (lowerStatus.includes('absent')) {
                mAbsent++;
              } else {
                mPresent++;
              }
            } else {
              mAbsent++;
            }
          }
        }

        const totalDays = mPresent + mHalfDay + mAbsent;
        const rate = totalDays > 0 ? Math.round(((mPresent + mHalfDay * 0.5) / totalDays) * 100) : 100;
        monthsList.push({ name: monthName, Rate: rate });
      }

      const avgRate = Math.round(monthsList.reduce((acc, m) => acc + m.Rate, 0) / monthsList.length);
      summaryText = `YTD Average: ${avgRate}%`;

      return {
        attendanceRate: avgRate,
        attendanceSummary: summaryText,
        attendanceChartData: monthsList,
        attendanceChartType: 'area'
      };
    }
  }, [profile, period]);

  // Safely extract raw performance history for hooks before early returns
  const perfHistory = useMemo(() => profile?.performance_history || [], [profile]);

  // Get available performance review period types in history
  const availablePerfTypes = useMemo(() => {
    if (perfHistory.length === 0) return [];
    // Ensure consistent ordering of types
    const order = ['Monthly', 'Quarterly', 'Half-Yearly'];
    const types = [...new Set(perfHistory.map(p => p.period_type))];
    return order.filter(t => types.includes(t));
  }, [perfHistory]);

  // Parse performance assessments filtered by selected review period type
  const parsedPerfHistory = useMemo(() => {
    const filtered = perfHistory.filter(p => p.period_type === selectedPerfType);
    if (filtered.length > 0) {
      return filtered.map(p => ({
        name: `${p.period_value} '${String(p.year).slice(2)}`,
        Score: p.percentage || 0
      }));
    }
    return MOCK_PERF_TREND;
  }, [perfHistory, selectedPerfType]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4 animate-pulse">
      <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7C3AED]">Loading Dashboard</p>
    </div>
  );

  if (!profile) return (
    <div className="flex flex-col items-center justify-center h-96 gap-4">
      <AlertCircle size={44} className="text-[#EF4444]" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40">Dashboard data offline</p>
    </div>
  );

  const emp        = profile.employee || {};
  const leaves     = profile.leaves || {};
  const kras       = profile.kras || { total: 0, completed: 0 };
  const training    = profile.training || { total: 0, completed: 0 };
  const recentLeaves = profile.recent_leaves || [];
  const latestPerf   = profile.latest_performance;
  const trainingList = profile.training_list?.length > 0 ? profile.training_list : MOCK_TRAINING;

  // Compute stats
  const leaveBalance = (leaves.casual_total || 15) - (leaves.casual_used || 0);
  const krasPercent  = kras.total ? Math.round((kras.completed / kras.total) * 100) : 0;
  
  // Safe calculations for training percentages
  const activeTrainingTotal = trainingList.length;
  const activeTrainingDone = trainingList.filter(t => t.training_status === 'Completed').length;
  const trainingPct = activeTrainingTotal ? Math.round((activeTrainingDone / activeTrainingTotal) * 100) : 0;

  // Tenure string
  const tenureStr = (() => {
    if (!emp.doj) return null;
    try {
      const ms = Date.now() - new Date(emp.doj).getTime();
      const yrs = Math.floor(ms / (365.25 * 24 * 3600 * 1000));
      const mos = Math.floor((ms % (365.25 * 24 * 3600 * 1000)) / (30.44 * 24 * 3600 * 1000));
      return yrs > 0 ? `${yrs}y ${mos}m tenure` : `${mos}m tenure`;
    } catch { return null; }
  })();

  // Parse training list for horizontal bars
  const trainingBarData = trainingList.map(t => ({
    name: (t.training_name || 'Training').length > 18 ? (t.training_name || 'Training').substring(0, 16) + '...' : t.training_name,
    value: t.training_status === 'Completed' ? 100 : t.training_status === 'In Progress' ? 50 : 10,
    status: t.training_status || 'Assigned'
  }));

  // Parse leaves list for bar chart
  const leaveBarData = recentLeaves.map((l, i) => {
    let days = 1;
    try {
      const diff = (new Date(l.end_date) - new Date(l.start_date)) / (1000 * 60 * 60 * 24) + 1;
      days = isNaN(diff) ? 1 : diff;
    } catch { days = 1; }
    return {
      name: `${l.leave_type || 'Leave'}`,
      days: days,
      status: l.status,
      range: `${l.start_date} → ${l.end_date}`
    };
  });

  return (
    <div className="space-y-8 animate-fade-in-up pb-16">
      
      {/* SVG gradients loaded globally for Recharts styling */}
      <svg width={0} height={0} className="absolute">
        <defs>
          <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#A78BFA" stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#34D399" stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="amberGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#FBBF24" stopOpacity={0.2} />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.2} />
          </linearGradient>
        </defs>
      </svg>

      {/* ─── HERO HEADER ─── */}
      <div className="bg-[#faf8ff] border border-[#ebe4ff] rounded-[2.5rem] p-8 md:p-10 relative overflow-hidden">
        {/* Subtle decorative vector backdrop */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#7c3aed]/5 to-transparent pointer-events-none rounded-[2.5rem]" />
        
        <div className="flex justify-between items-center flex-wrap gap-8 relative z-10">
          <div className="flex items-center gap-6">
            <div className="relative">
              {emp.photo_path ? (
                <img 
                  src={emp.photo_path.startsWith('http') ? emp.photo_path : `/${emp.photo_path.replace(/^\//, '')}`} 
                  alt={emp.name} 
                  className="w-20 h-20 rounded-[1.8rem] object-cover border-2 border-white shadow-lg shadow-[#7c3aed]/10" 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div className={`w-20 h-20 rounded-[1.8rem] bg-gradient-to-br from-[#7C3AED] to-[#A78BFA] text-white text-3xl font-black items-center justify-center shadow-lg shadow-[#7c3aed]/20 ${emp.photo_path ? 'hidden' : 'flex'}`}>
                {emp.name ? emp.name.charAt(0).toUpperCase() : user?.name?.charAt(0).toUpperCase() || 'E'}
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            </div>
            
            <div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#7c3aed] bg-[#ede9fe] px-2.5 py-0.5 rounded-full">
                  Personal Analytics
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-black/40">
                  {emp.employee_code || 'EMP0000'}
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-black tracking-tight mt-2.5 leading-none italic">
                Hello, {emp.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'Member'}
              </h1>
              <div className="flex flex-wrap items-center gap-2.5 mt-4">
                {emp.designation && (
                  <span className="bg-white text-black/60 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ebe4ff]">
                    {emp.designation}
                  </span>
                )}
                {emp.team && (
                  <span className="bg-white text-black/60 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ebe4ff]">
                    👥 {emp.team}
                  </span>
                )}
                {emp.location && (
                  <span className="bg-white text-black/60 text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ebe4ff]">
                    📍 {emp.location}
                  </span>
                )}
                {tenureStr && (
                  <span className="bg-[#fcfaff] text-[#7C3AED] text-[10px] font-black uppercase tracking-wider px-3.5 py-1.5 rounded-2xl border border-[#ebe4ff]">
                    ⏱ {tenureStr}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {lastRefresh && (
              <span className="text-[9px] font-black uppercase tracking-widest text-black/30">
                Synced {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={fetchData}
              className="p-4 rounded-2xl bg-black text-white text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2.5 hover:bg-black/90 active:scale-95 transition-all shadow-md"
            >
              <RefreshCw size={12} className="animate-spin-slow" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ─── STAT CARDS (3 KPIs) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Leave Balance"
          value={leaveBalance}
          color="#7C3AED"
          icon={Calendar}
          sub={`${leaves.casual_used || 0} days used of ${leaves.casual_total || 15} total`}
          onClick={() => navigate('/deploy?tab=attendance')}
        />
        <StatCard
          label="Attendance Rate"
          value={`${analytics?.attendanceRate}%`}
          color="#10B981"
          icon={Activity}
          sub={analytics?.attendanceSummary}
          onClick={() => navigate('/deploy?tab=attendance')}
        />
        <StatCard
          label="Performance Score"
          value={latestPerf ? `${latestPerf.percentage}%` : 'N/A'}
          color="#F59E0B"
          icon={Award}
          sub={latestPerf ? `${latestPerf.period_value} ${latestPerf.year} · ${latestPerf.status}` : 'Assessments pending'}
          onClick={() => navigate('/deploy?tab=performance')}
        />
      </div>

      {/* ─── SECTION 1: ATTENDANCE TREND & PERFORMANCE GRAPH ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Attendance widget supporting Month Donut / Quarter Bar / YTD Area Chart */}
        <ChartCard 
          title="Attendance Statistics" 
          action={
            <div className="flex bg-[#f5f0ff] p-1 rounded-xl border border-[#ebe4ff] text-[9px] font-black uppercase tracking-wider">
              <button 
                onClick={() => setPeriod('month')}
                className={`px-3 py-1.5 rounded-lg transition-all ${period === 'month' ? 'bg-white text-[#7C3AED] shadow-sm' : 'text-black/55 hover:text-black'}`}
              >
                Month
              </button>
              <button 
                onClick={() => setPeriod('quarter')}
                className={`px-3 py-1.5 rounded-lg transition-all ${period === 'quarter' ? 'bg-white text-[#7C3AED] shadow-sm' : 'text-black/55 hover:text-black'}`}
              >
                Quarter
              </button>
              <button 
                onClick={() => setPeriod('year')}
                className={`px-3 py-1.5 rounded-lg transition-all ${period === 'year' ? 'bg-white text-[#7C3AED] shadow-sm' : 'text-black/55 hover:text-black'}`}
              >
                YTD
              </button>
            </div>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            {analytics?.attendanceChartType === 'pie' ? (
              <PieChart>
                <Pie
                  data={analytics.attendanceChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={5}
                >
                  {analytics.attendanceChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} className="outline-none" />
                  ))}
                </Pie>
                <Tooltip content={<CountTooltip />} />
                <Legend 
                  wrapperStyle={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em' }}
                  iconSize={8}
                />
              </PieChart>
            ) : analytics?.attendanceChartType === 'bar' ? (
              <BarChart data={analytics.attendanceChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.06)" />
                <XAxis dataKey="name" stroke="rgba(0,0,0,0.3)" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="rgba(0,0,0,0.3)" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Rate" name="Attendance Rate" radius={[6, 6, 0, 0]} fill="url(#greenGrad)" />
              </BarChart>
            ) : (
              <AreaChart data={analytics.attendanceChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.06)" />
                <XAxis dataKey="name" stroke="rgba(0,0,0,0.3)" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} stroke="rgba(0,0,0,0.3)" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Rate" name="Attendance Rate" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#areaGreen)" />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </ChartCard>
 
        {/* Performance Evolution line chart over time */}
        <ChartCard 
          title="Performance Evolution" 
          className="xl:col-span-2"
          action={
            availablePerfTypes.length > 1 ? (
              <div className="flex bg-[#fffcf5] p-1 rounded-xl border border-[#ffeed5] text-[9px] font-black uppercase tracking-wider">
                {availablePerfTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedPerfType(type)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${selectedPerfType === type ? 'bg-[#F59E0B] text-white shadow-sm' : 'text-black/55 hover:text-black'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-[8px] font-black uppercase bg-[#fff7ed] text-[#F59E0B] border border-[#ffedd5] px-2.5 py-1 rounded-full">
                {perfHistory.length > 0 ? `${selectedPerfType} Reviews` : 'Projected baseline'}
              </span>
            )
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={parsedPerfHistory} margin={{ top: 15, right: 15, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.35}/>
                  <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.06)" />
              <XAxis dataKey="name" stroke="rgba(0,0,0,0.3)" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="rgba(0,0,0,0.3)" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="Score" stroke="#F59E0B" strokeWidth={3} fillOpacity={1} fill="url(#perfGrad)" />
              <Line type="monotone" dataKey="Score" stroke="#F59E0B" strokeWidth={0} dot={{ r: 4, stroke: '#F59E0B', strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
 
      </div>

      {/* ─── SECTION 3: RECENT LEAVES LIST & TIMELINE ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Leaves days chart */}
        <ChartCard title="Leave Calendar Metrics" className="xl:col-span-1">
          <ResponsiveContainer width="100%" height="100%">
            {leaveBarData.length > 0 ? (
              <BarChart data={leaveBarData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(124,58,237,0.06)" />
                <XAxis dataKey="name" stroke="rgba(0,0,0,0.3)" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(0,0,0,0.3)" fontSize={9} fontWeight={900} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="days" name="Duration" radius={[6, 6, 0, 0]} barSize={35}>
                  {leaveBarData.map((entry, idx) => {
                    let barColor = '#F59E0B'; // Pending
                    if (entry.status === 'Approved') barColor = '#10B981';
                    if (entry.status === 'Rejected') barColor = '#EF4444';
                    return <Cell key={idx} fill={barColor} />;
                  })}
                </Bar>
              </BarChart>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <ShieldAlert size={28} className="text-black/25 mb-2.5" />
                <p className="text-[10px] font-black uppercase tracking-wider text-black/30">No leave requests logged</p>
              </div>
            )}
          </ResponsiveContainer>
        </ChartCard>

        {/* Leave Requests Log Feed */}
        <div className="xl:col-span-2 bg-white border border-[#ebe4ff] rounded-[2rem] p-8 shadow-[0_10px_40px_rgba(180,140,255,0.04)] flex flex-col gap-6 relative">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7C3AED]">Leave Log Feed</h3>
            <button
              onClick={() => navigate('/deploy?tab=attendance')}
              className="text-[9px] font-black uppercase tracking-widest text-[#7C3AED] flex items-center gap-1 hover:opacity-75 transition-opacity"
            >
              Request Leave <ArrowUpRight size={12} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 max-h-[250px] pr-2">
            {recentLeaves.length > 0 ? (
              recentLeaves.map((leave, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center justify-between p-4 border border-[#f5f1ff] bg-[#faf8ff]/50 rounded-2xl hover:border-[#ebe4ff] hover:bg-[#faf8ff] transition-all duration-300"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${
                      leave.status === 'Approved' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 
                      leave.status === 'Rejected' ? 'bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 
                      'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    }`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-black">{leave.leave_type} Leave</span>
                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                          leave.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' :
                          leave.status === 'Rejected' ? 'bg-rose-500/10 text-rose-600' :
                          'bg-amber-500/10 text-amber-600'
                        }`}>
                          {leave.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-black/45 font-bold mt-1">
                        {leave.start_date} to {leave.end_date}
                      </p>
                    </div>
                  </div>
                  
                  {leave.reason && (
                    <span className="text-[10px] text-black/35 italic max-w-[200px] truncate hidden md:block">
                      "{leave.reason}"
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Calendar size={32} className="text-black/15 mb-3" />
                <p className="text-[10px] font-black uppercase tracking-widest text-black/30">Your leave log is currently empty</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
