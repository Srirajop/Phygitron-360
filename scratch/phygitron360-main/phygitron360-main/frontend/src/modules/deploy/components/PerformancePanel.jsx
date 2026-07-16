import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';
import { Activity, Download, Save, Send, CheckCircle, Plus, AlertCircle, BarChart3, TrendingUp } from 'lucide-react';
import {
  isValidEmail,
  isValidPhone,
  isValidPAN,
  isValidBankAccount,
  isValidPincode,
  isValidURL
} from '../../../core/utils/validators';

const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4'];
const HALF_YEARS = ['H1', 'H2'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const KRA_TEMPLATE = [
  { category: 'Performance', subcategory: 'Adherence to schedules', options: { 10: "Delivery before target 80%-100% of the time", 5: "100% target dates met", 1: "<100% target dates met" } },
  { category: 'Performance', subcategory: 'Quality of deliverables', options: { 10: "Zero defects, meets/exceeds CTQs", 5: "Minor defects, meets most CTQs", 1: "High defects, fails to meet key CTQs" } },
  { category: 'Performance', subcategory: 'Stakeholder feedback', options: { 10: "Consistently excellent feedback", 5: "Neutral feedback", 1: "Negative or critical feedback" } },
  { category: 'Performance', subcategory: 'Team contribution', options: { 10: "Actively leads and supports team success", 5: "Participates regularly, meets expectations", 1: "Limited or no contribution to the team" } },
  { category: 'Potential', subcategory: 'Communication and influence', options: { 10: "Clear, persuasive, highly impactful", 5: "Communicates effectively", 1: "Poor communication, lacks clarity" } },
  { category: 'Potential', subcategory: 'Problem-solving', options: { 10: "Innovates and solves complex problems", 5: "Solves problems as expected", 1: "Struggles to address key problems" } },
  { category: 'Potential', subcategory: 'Adaptability', options: { 10: "Adapts quickly to new tasks/tools", 5: "Adapts with minimal guidance", 1: "Resists or struggles with change" } },
  { category: 'Values', subcategory: 'Integrity and accountability', options: { 10: "Takes full ownership, demonstrates honesty", 5: "Generally reliable and ethical", 1: "Fails to take accountability, lacks ethics" } },
  { category: 'Values', subcategory: 'Teamwork and collaboration', options: { 10: "Frequently collaborates and builds trust", 5: "Works well with others", 1: "Difficult to work with, creates conflict" } },
  { category: 'Values', subcategory: 'Initiative and proactivity', options: { 10: "Consistently self-driven, exceeds scope", 5: "Meets expectations with minimal prompting", 1: "Reluctant or reactive, lacks initiative" } },
  { category: 'Growth and Development', subcategory: 'Learning and upskilling', options: { 10: "Frequently completes certifications, learns", 5: "Occasionally improves skills", 1: "Little or no effort toward upskilling" } },
  { category: 'Growth and Development', subcategory: 'Team development contribution', options: { 10: "Regularly mentors, shares knowledge", 5: "Occasionally mentors others", 1: "Does not assist in team development" } },
  { category: 'Impact', subcategory: 'Creativity and originality', options: { 10: "Introduces innovative, unique solutions", 5: "Occasionally suggests creative ideas", 1: "Lacks originality, repeats existing ideas" } },
  { category: 'Impact', subcategory: 'Business goal contributions', options: { 10: "Directly and significantly impacts goals", 5: "Meets expectations, some measurable impact", 1: "No measurable contribution to business goals" } },
];

const DEFAULT_ENTRIES = KRA_TEMPLATE.map(k => ({
  ...k, self_score: 5, manager_score: 5, score: 5, employee_comment: '', manager_comment: ''
}));

const STATUS_CONFIG = {
  'Draft':     { bg: 'bg-white/10',            text: 'text-white/50' },
  'Requested': { bg: 'bg-amber-500/10',        text: 'text-amber-400 animate-pulse' },
  'Submitted': { bg: 'bg-primary/10',           text: 'text-primary' },
  'Reviewed':  { bg: 'bg-emerald-500/10',       text: 'text-emerald-400' },
  'Finalized': { bg: 'bg-emerald-500/10',       text: 'text-emerald-400' },
};

export default function PerformancePanel({ isAdmin, user: propUser }) {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(user?.employee_code || '');
  const [year, setYear] = useState(new Date().getFullYear());
  const [assessments, setAssessments] = useState([]);
  const [periodType, setPeriodType] = useState('Quarterly'); // 'Quarterly', 'Half Yearly', or 'Monthly'
  const [activePeriod, setActivePeriod] = useState(periodType === 'Quarterly' ? 'Q1' : periodType === 'Half Yearly' ? 'H1' : 'Jan');
  const [localData, setLocalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const PERIODS = periodType === 'Quarterly' ? QUARTERS : periodType === 'Half Yearly' ? HALF_YEARS : MONTHS;

  // Load employee list for admin
  useEffect(() => {
    if (!isAdmin) {
      setSelectedEmp(user?.employee_code || '');
      return;
    }
    fetch('/api/employees', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        setEmployees(arr);
        if (!selectedEmp && arr.length > 0) setSelectedEmp(arr[0].employee_code);
      }).catch(() => {});
  }, [isAdmin, user?.employee_code]);

  const loadAssessments = useCallback(async () => {
    if (!selectedEmp) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assessments/${selectedEmp}/${year}?type=${periodType}`, { credentials: 'include' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Failed to load assessments');
      }
      const data = await res.json();
      const list = (Array.isArray(data) ? data : []).map(a => ({
        ...a,
        entries: (Array.isArray(a.entries) ? a.entries : []).map(e => {
            const template = KRA_TEMPLATE.find(t => t.subcategory === e.subcategory);
            return { ...e, options: template?.options || {} };
        })
      }));
      setAssessments(list);
      const active = list.find(d => d.period_value === activePeriod);
      setLocalData(active || null);
      setErrors({});
    } catch (e) {
      toast.error(e.message || 'Failed to load assessments');
      setAssessments([]);
      setLocalData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedEmp, year, activePeriod, periodType]);

  useEffect(() => { loadAssessments(); }, [selectedEmp, year, periodType, isAdmin]);

  const handleTabChange = (p) => {
    setActivePeriod(p);
    const active = assessments.find(d => d.period_value === p);
    setLocalData(active || null);
    setErrors({});
  };

  const createNewAssessment = () => {
    setLocalData({
      period_type: periodType,
      period_value: activePeriod,
      status: 'Draft',
      total_self_score: 0,
      total_manager_score: 0,
      self_percentage: 0,
      manager_percentage: 0,
      percentage: 0,
      entries: DEFAULT_ENTRIES.map(e => ({ ...e })),
    });
    setErrors({});
  };

  const handleRequestReview = async () => {
    if (!isAdmin || !selectedEmp) return;
    try {
        const res = await fetch('/api/assessments/request', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_code: selectedEmp,
                year: year,
                period_type: periodType,
                period_value: activePeriod
            })
        });
        if (!res.ok) {
            const d = await res.json();
            throw new Error(d.detail || "Request failed");
        }
        toast.success(`Review requested for ${selectedEmp}`);
        loadAssessments();
    } catch (e) { toast.error(e.message || "Request failed"); }
  };

  const isSelf = !!user?.employee_code && user.employee_code === selectedEmp;

  const handleEntryChange = (idx, field, value) => {
    if (!localData) return;
    
    if (isAdmin && (field === 'self_score' || field === 'employee_comment')) return;
    if (!isAdmin && (field === 'manager_score' || field === 'manager_comment')) return;

    const updated = { ...localData, entries: localData.entries.map((e, i) => {
      if (i !== idx) return e;
      const val = (field.includes('score') && value !== 'N/A' ? Number(value) : (value === 'N/A' ? null : value));
      const updated_entry = { ...e, [field]: val };
      
      return updated_entry;
    })};

    let selfSum = 0, selfCount = 0;
    let mgrSum = 0, mgrCount = 0;
    
    updated.entries.forEach(e => {
        if (e.self_score !== null && e.self_score !== undefined) {
            selfSum += e.self_score;
            selfCount++;
        }
        if (e.manager_score !== null && e.manager_score !== undefined) {
            mgrSum += e.manager_score;
            mgrCount++;
        }
    });

    updated.total_self_score = selfSum;
    updated.total_manager_score = mgrSum;
    updated.self_percentage = selfCount ? Math.round((selfSum / (selfCount * 10)) * 100) : 0;
    updated.manager_percentage = mgrCount ? Math.round((mgrSum / (mgrCount * 10)) * 100) : 0;
    updated.percentage = updated.manager_percentage || updated.self_percentage || 0;
    setLocalData(updated);
  };

  const saveAssessment = async (statusOverride) => {
    if (!localData) return;
    setSaving(true);
    const reqData = {
      employee_code: selectedEmp,
      year: parseInt(year),
      period_type: periodType,
      period_value: activePeriod,
      status: statusOverride || localData.status || 'Draft',
      entries: localData.entries
    };
    try {
      const res = await fetch('/api/assessments/save', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Save failed');
      }
      toast.success(statusOverride === 'Submitted' ? 'Assessment submitted for review' : statusOverride === 'Reviewed' ? 'Assessment finalized' : 'Draft saved');
      await loadAssessments();
      setErrors({});
    } catch (e) {
      toast.error(e.message || 'Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  const exportXLSX = async () => {
    if (!localData) return;
    try {
      const XLSX = await import('xlsx');
      const wsData = [
        ['Category', 'Subcategory', 'Self Score', 'Manager Score', 'Employee Comment', 'Manager Comment'],
        ...localData.entries.map(e => [e.category, e.subcategory, e.self_score !== null ? e.self_score : 'N/A', e.manager_score !== null ? e.manager_score : 'N/A', e.employee_comment, e.manager_comment]),
        [],
        ['Self Score', localData.total_self_score, 'Self %', `${localData.self_percentage}%`, 'Manager Score', localData.total_manager_score, 'Mgr %', `${localData.manager_percentage}%`]
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `${activePeriod} Assessment`);
      XLSX.writeFile(wb, `${selectedEmp}_${year}_${activePeriod}_Assessment.xlsx`);
      toast.success('XLSX exported!');
    } catch {
      toast.error('Export failed — xlsx library may need install');
    }
  };

  const empName = isAdmin ? (employees.find(e => e.employee_code === selectedEmp)?.name || selectedEmp) : user?.name;
  const periodStatus = (p) => assessments.find(a => a.period_value === p);

  const canEmployeeEdit = !isAdmin && (localData?.status === 'Draft' || localData?.status === 'Requested');
  const canManagerEdit = isAdmin && localData?.status !== 'Finalized';
  const statusCfg = STATUS_CONFIG[localData?.status] || STATUS_CONFIG['Draft'];

  const isLightMode = window.location.pathname.startsWith('/deploy');

  // Theme-aware styles
  const styles = {
    mainCard: isLightMode 
      ? "bg-white border border-[#ebe7ff] rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(180,140,255,0.04)]" 
      : "glass-panel p-6 border-white/5",
    
    heroCard: isLightMode
      ? "rounded-[2rem] border border-[#ebe7ff] bg-[#f7f3ff] p-6"
      : "glass-panel p-6 border-white/5",
    
    statCard: (isActive) => isLightMode
      ? `bg-white border border-[#ebe7ff] p-4 text-center cursor-pointer transition-all hover:border-[#7c3aed]/20 hover:scale-[1.02] ${isActive ? '!border-[#7c3aed]/30 !bg-[#7c3aed]/5' : ''}`
      : `glass-panel p-4 border-white/5 text-center cursor-pointer transition-all hover:border-primary/20 hover:scale-[1.02] ${isActive ? 'border-primary/30 bg-primary/5' : ''}`,

    emptyCard: isLightMode
      ? "bg-white border border-[#ebe7ff] rounded-[2rem] p-16 flex flex-col items-center justify-center gap-6"
      : "glass-panel border-white/5 p-16 flex flex-col items-center justify-center gap-6",

    tabButton: (isActive) => isLightMode
      ? `flex items-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
          isActive ? 'bg-[#7c3aed] text-white shadow-lg shadow-purple-200' : 'border border-[#ece6ff] bg-white text-black/50 hover:bg-[#faf7ff]'
        }`
      : `flex items-center gap-2 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
          isActive ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'glass-panel border-white/5 text-white/40 hover:text-white hover:border-white/10'
        }`,

    periodSelectContainer: isLightMode ? "flex bg-[#f3f0ff] p-1 rounded-xl border border-[#ebe4ff]" : "flex bg-white/5 rounded-xl p-1",
    
    periodSelectBtn: (isActive) => isLightMode
      ? `px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${isActive ? '!bg-black !text-white' : 'text-black/60 hover:bg-white'}`
      : `px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${isActive ? 'bg-primary text-black' : 'text-white/40 hover:text-white'}`,

    select: isLightMode
      ? "border border-[#ece6ff] bg-white text-black text-xs px-4 py-2.5 rounded-xl outline-none focus:border-[#8b5cf6]"
      : "glass-panel border-white/5 text-white text-xs bg-transparent px-4 py-2.5 rounded-xl focus:outline-none focus:border-primary/30",

    textInput: isLightMode
      ? "w-full border border-[#ece6ff] bg-white text-black text-[10px] px-3 py-2 rounded-lg focus:outline-none focus:border-[#8b5cf6] placeholder-black/20"
      : "w-full glass-panel border-white/10 text-white text-[10px] bg-transparent px-3 py-2 rounded-lg focus:outline-none disabled:opacity-30 placeholder-white/10",

    managerTextInput: isLightMode
      ? "w-full mt-2 border border-[#d8fbe0] bg-white text-emerald-600 text-[10px] px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/30 placeholder-emerald-600/20"
      : "w-full mt-2 glass-panel border-white/10 text-emerald-400 text-[10px] bg-transparent px-3 py-2 rounded-lg focus:outline-none focus:border-emerald-500/30 placeholder-white/10",

    titleText: isLightMode ? "text-black" : "text-white",
    subtitleText: isLightMode ? "text-[#7c3aed]" : "text-white/30",
    bodyText: isLightMode ? "text-black/80" : "text-white/60",
    mutedText: isLightMode ? "text-black/40" : "text-white/20",
    periodTabText: (isActive) => isLightMode
      ? `text-[8px] font-black uppercase tracking-widest mb-1 ${isActive ? 'text-[#7c3aed]' : 'text-black/30'}`
      : `text-[8px] font-black uppercase tracking-widest mb-1 ${isActive ? 'text-primary' : 'text-white/20'}`,
    percentageText: isLightMode ? "text-black/80" : "text-white",

    thead: isLightMode ? "border-b border-[#ebe7ff] bg-[#f7f3ff]" : "border-b border-white/5 bg-white/[0.01]",
    th: (isColor) => isLightMode
      ? `px-4 py-4 text-[9px] font-black uppercase tracking-widest ${isColor === 'primary' ? 'text-[#7c3aed]' : isColor === 'emerald' ? 'text-emerald-600' : 'text-black/50'}`
      : `px-4 py-4 text-[9px] font-black uppercase tracking-widest ${isColor === 'primary' ? 'text-primary' : isColor === 'emerald' ? 'text-emerald-400' : 'text-white/30'}`,
    tbody: isLightMode ? "divide-y divide-[#f1ecff]" : "divide-y divide-white/[0.04]",
    tr: isLightMode ? "hover:bg-[#faf7ff] transition-colors group" : "hover:bg-white/[0.02] transition-colors group",
    categoryTd: isLightMode ? "px-8 py-4 text-xs font-black text-[#7c3aed] uppercase tracking-widest" : "px-8 py-4 text-xs font-black text-primary/70 uppercase tracking-widest",
    subcategoryText: isLightMode ? "text-xs font-black text-black mb-1 uppercase tracking-tight" : "text-xs font-bold text-white mb-1 uppercase tracking-tight",
    definitionBox: isLightMode
      ? "text-[10px] text-[#7c3aed] leading-tight bg-[#f7f3ff] p-2 rounded-lg border border-[#e9ddff] italic"
      : "text-[10px] text-primary/40 leading-tight bg-primary/5 p-2 rounded-lg border border-primary/10 italic",

    entryScoreBtn: (isActive, isManager) => {
      if (isActive) {
        return isManager 
          ? 'px-2 py-1 h-8 rounded-lg text-[10px] font-black bg-emerald-500 text-white shadow-lg shadow-emerald-200'
          : 'px-2 py-1 h-8 rounded-lg text-[10px] font-black bg-[#7c3aed] text-white shadow-lg shadow-purple-200';
      }
      return isLightMode
        ? 'px-2 py-1 h-8 rounded-lg text-[10px] font-black border border-[#ece6ff] bg-white text-black/40 hover:bg-[#faf7ff]'
        : 'px-2 py-1 h-8 rounded-lg text-[10px] font-black glass-panel border-white/5 text-white/20 hover:text-white/40';
    },

    footer: isLightMode ? "px-8 py-5 border-t border-[#ebe7ff] bg-[#faf7ff] flex gap-3 justify-end items-center flex-wrap" : "px-8 py-5 border-t border-white/5 bg-white/[0.01] flex gap-3 justify-end items-center flex-wrap",
    btnSaveDraft: isLightMode
      ? "flex items-center gap-2 px-6 py-2.5 border border-[#ece6ff] bg-white hover:bg-[#faf7ff] text-[#7c3aed] text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
      : "flex items-center gap-2 px-6 py-2.5 glass-panel border-white/10 hover:border-white/20 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
    btnCommit: isLightMode
      ? "flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-[#8b5cf6] to-[#c084fc] text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-purple-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
      : "flex items-center gap-2 px-8 py-2.5 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all",

    btnExport: isLightMode
      ? "flex items-center gap-2 px-5 py-2.5 border border-[#ece6ff] bg-white text-black/50 hover:text-black hover:border-black/20 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-30"
      : "flex items-center gap-2 px-5 py-2.5 glass-panel border-white/10 hover:border-primary/30 text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all disabled:opacity-30",

    iconBadge: isLightMode 
      ? "w-10 h-10 rounded-2xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center text-[#7c3aed]" 
      : "w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary",

    optionClass: isLightMode ? "bg-white text-black" : "bg-[#080f1f]",
    emptyDot: isLightMode ? "w-1 h-1 rounded-full bg-black/10" : "w-1 h-1 rounded-full bg-white/5",
    assessmentGrid: isLightMode 
      ? "bg-white border border-[#ebe7ff] rounded-[2rem] overflow-hidden shadow-[0_10px_40px_rgba(180,140,255,0.04)] animate-fade-in-up" 
      : "glass-panel border-white/5 overflow-hidden animate-fade-in-up",
    
    emptyIconBg: isLightMode 
      ? "w-20 h-20 bg-[#f7f3ff] rounded-3xl flex items-center justify-center border border-[#e9ddff]" 
      : "w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center border border-white/5",
    
    emptyIconColor: isLightMode ? "text-[#7c3aed]/30" : "text-white/10",
    btnInitiateEmp: isLightMode 
      ? "flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-[#8b5cf6] to-[#c084fc] text-white font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-lg shadow-purple-100 hover:scale-[1.02] active:scale-[0.98] transition-all" 
      : "flex items-center gap-3 px-10 py-4 bg-primary text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all",
    
    btnInitiateAdmin: isLightMode 
      ? "flex items-center gap-3 px-10 py-4 border border-[#ece6ff] bg-white text-[#7c3aed] font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-[#f7f3ff] transition-all" 
      : "flex items-center gap-3 px-10 py-4 glass-panel border-white/10 text-white/60 hover:text-white font-black text-[11px] uppercase tracking-widest rounded-2xl transition-all"
  };

  return (
  <div className="space-y-6">

    {/* Header Toolbar */}
    <div className={`${styles.heroCard} flex flex-wrap gap-6 items-center justify-between`}>

      <div className="flex gap-4 items-center flex-wrap">

        <div className={styles.iconBadge}>
          <Activity size={20} />
        </div>

        <div>
          <p className={`text-[9px] font-black uppercase tracking-[0.22em] ${styles.subtitleText}`}>
            Performance Intelligence Node
          </p>

          <h1
            className={`
              text-[42px]
              leading-none
              font-display
              font-black
              uppercase
              tracking-[-0.04em]
              italic
              ${styles.titleText}
            `}
          >
            {isAdmin
              ? 'Performance Intelligence Panel'
              : 'My Success Matrix'}
          </h1>
        </div>

      </div>

      <div className="flex items-center gap-4 flex-wrap">

        {isAdmin && !localData && (
          <button
            onClick={handleRequestReview}
            className="
              px-6
              h-[46px]
              bg-amber-500
              text-black
              text-[10px]
              font-black
              uppercase
              tracking-[0.16em]
              rounded-2xl
              hover:bg-amber-400
              transition-all
              flex
              items-center
              gap-2
              shrink-0
            "
          >
            <Send size={14} />
            Request Submission
          </button>
        )}

        {/* PERIOD TYPE SWITCH */}
        <div
          className="
            flex
            items-center
            bg-[#f5efff]
            border
            border-[#ece2ff]
            rounded-2xl
            p-1.5
            w-[370px]
            shrink-0
          "
        >

          {['Quarterly', 'Half Yearly', 'Monthly'].map((t) => (

            <button
              key={t}
              onClick={() => {
                setPeriodType(t);
                setActivePeriod(
                  t === 'Quarterly'
                    ? 'Q1'
                    : t === 'Half Yearly'
                    ? 'H1'
                    : 'Jan'
                );
              }}
              className={`
                flex-1
                h-[42px]
                rounded-xl
                text-[10px]
                font-black
                uppercase
                tracking-[0.14em]
                transition-all
                whitespace-nowrap

                ${
                  periodType === t
                    ? 'bg-black text-white shadow-sm'
                    : 'text-[#6b7280] hover:text-black'
                }
              `}
            >
              {t}
            </button>

          ))}

        </div>

      </div>

    </div>

    {/* FILTER BAR */}
    <div className={`${styles.mainCard} !p-4 flex gap-3 items-center flex-wrap`}>

      {isAdmin && employees.length > 0 && (
        <select
          value={selectedEmp}
          onChange={(e) => setSelectedEmp(e.target.value)}
          className={styles.select}
        >
          {employees.map((e) => (
            <option
              key={e.employee_code}
              value={e.employee_code}
              className={styles.optionClass}
            >
              {e.name} ({e.employee_code})
            </option>
          ))}
        </select>
      )}

      <select
        value={year}
        onChange={(e) => {
          setYear(Number(e.target.value));
        }}
        className={styles.select}
      >
        {[2024, 2025, 2026, 2027].map((y) => (
          <option
            key={y}
            value={y}
            className={styles.optionClass}
          >
            {y}
          </option>
        ))}
      </select>

      <button
        onClick={exportXLSX}
        disabled={!localData}
        className={styles.btnExport}
      >
        <Download size={14} />
        Export XLSX
      </button>

    </div>

      {/* Period Overview Stats */}
      <div className={`grid gap-4 ${periodType === 'Quarterly' ? 'grid-cols-4' : 'grid-cols-6 md:grid-cols-12'}`}>
        {PERIODS.map(p => {
          const ast = periodStatus(p);
          return (
            <div
              key={p}
              onClick={() => handleTabChange(p)}
              className={styles.statCard(activePeriod === p)}
            >
              <p className={styles.periodTabText(activePeriod === p)}>{p}</p>
              {ast ? (
                <div className="space-y-1">
                  <p className={`text-sm font-display font-black ${styles.percentageText}`}>{ast.percentage ?? 0}%</p>
                  <div className={`w-1.5 h-1.5 rounded-full mx-auto ${
                    isLightMode 
                      ? (ast.status === 'Draft' ? 'bg-black/20' :
                         ast.status === 'Requested' ? 'bg-amber-500' :
                         ast.status === 'Submitted' ? 'bg-[#7c3aed]' :
                         'bg-emerald-500')
                      : (STATUS_CONFIG[ast.status]?.text.replace('text-', 'bg-') || 'bg-white/10')
                  }`} />
                </div>
              ) : (
                <div className="h-4 flex items-center justify-center">
                    <div className={styles.emptyDot} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Period Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        {PERIODS.map(p => {
          const ast = periodStatus(p);
          return (
            <button
              key={p}
              onClick={() => handleTabChange(p)}
              className={styles.tabButton(activePeriod === p)}
            >
              {p}
              {ast?.status === 'Submitted' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
              {(ast?.status === 'Reviewed' || ast?.status === 'Finalized') && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !localData ? (
        /* Empty State */
        <div className={`${styles.emptyCard} animate-fade-in-up`}>
          <div className={styles.emptyIconBg}>
            <BarChart3 size={40} className={styles.emptyIconColor} />
          </div>
          <div className="text-center">
            <p className={`font-bold text-lg mb-2 ${styles.bodyText}`}>No {activePeriod} Assessment</p>
            <p className={`text-[10px] font-black uppercase tracking-widest ${styles.mutedText}`}>
              {isAdmin ? `No assessment started for ${empName} - ${activePeriod} ${year}` : `Your ${activePeriod} self-assessment hasn't been initialized yet`}
            </p>
          </div>
          {!isAdmin && (
            <button
              onClick={createNewAssessment}
              className={styles.btnInitiateEmp}
            >
              <Plus size={18} /> Initiate {activePeriod} Self-Assessment
            </button>
          )}
          {isAdmin && (
            <button
              onClick={createNewAssessment}
              className={styles.btnInitiateAdmin}
            >
              <Plus size={18} /> Create Assessment for {empName}
            </button>
          )}
        </div>
      ) : (
        /* Assessment Grid */
        <div className={styles.assessmentGrid}>
          {/* Assessment Header */}
          <div className={`px-8 py-6 border-b flex justify-between items-center ${isLightMode ? 'border-[#ebe7ff] bg-[#f7f3ff]/50' : 'border-white/10 bg-white/[0.02]'}`}>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${styles.subtitleText}`}>{empName} // {year}</p>
              <h3 className={`text-lg font-black uppercase tracking-tighter ${styles.titleText}`}>{activePeriod} Performance Assessment</h3>
              <span className={`px-3 py-1 mt-2 inline-block rounded-full text-[9px] font-black uppercase tracking-widest ${
                isLightMode 
                  ? (localData.status === 'Draft' ? 'bg-black/5 text-black/50 border border-black/10' :
                     localData.status === 'Requested' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                     localData.status === 'Submitted' ? 'bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20' :
                     'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20')
                  : `${statusCfg.bg} ${statusCfg.text}`
              }`}>
                {localData.status || 'Draft'}
              </span>
            </div>
            <div className="text-right flex gap-6">
              <div>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${styles.subtitleText}`}>Self Matrix</p>
                <p className="text-4xl font-display font-black" style={{ color: (localData.self_percentage || 0) >= 80 ? '#10B981' : (localData.self_percentage || 0) >= 60 ? '#F59E0B' : '#F43F5E' }}>
                  {localData.self_percentage ?? 0}%
                </p>
                <p className={`text-[10px] uppercase tracking-widest font-black ${styles.mutedText}`}>
                  {localData.total_self_score ?? 0} pts
                </p>
              </div>
              <div className="w-px bg-black/10" />
              <div>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${styles.subtitleText}`}>Manager Matrix</p>
                <p className="text-4xl font-display font-black" style={{ color: (localData.manager_percentage || 0) >= 80 ? '#10B981' : (localData.manager_percentage || 0) >= 60 ? '#F59E0B' : '#F43F5E' }}>
                  {localData.manager_percentage ?? 0}%
                </p>
                <p className={`text-[10px] uppercase tracking-widest font-black ${styles.mutedText}`}>
                  {localData.total_manager_score ?? 0} pts
                </p>
              </div>
            </div>
          </div>

          {/* Assessment Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className={styles.thead}>
                <tr>
                  <th className={styles.th()}>Category</th>
                  <th className={styles.th()}>KRA & Criteria</th>
                  <th className={styles.th('primary')}>Self Rating</th>
                  <th className={styles.th('emerald')}>Mgr Rating</th>
                  <th className={styles.th()}>Notes</th>
                </tr>
              </thead>
              <tbody className={styles.tbody}>
                {(localData.entries || []).map((entry, idx) => (
                  <tr key={idx} className={styles.tr}>
                    <td className={styles.categoryTd}>{entry.category}</td>
                    <td className="px-4 py-4 min-w-[280px]">
                      <div className={styles.subcategoryText}>{entry.subcategory}</div>
                      <div className={styles.definitionBox}>
                        {entry.options?.[entry.manager_score || entry.self_score] || "Metric definition will appear upon selection"}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1 flex-wrap">
                        {[1, 5, 10, 'N/A'].map(s => (
                          <button
                            key={s}
                            onClick={() => handleEntryChange(idx, 'self_score', s)}
                            disabled={isAdmin || !canEmployeeEdit}
                            className={styles.entryScoreBtn(
                                (s === 'N/A' && (entry.self_score === null || entry.self_score === undefined)) || entry.self_score === s, 
                                false
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                       <div className="flex gap-1 flex-wrap">
                        {[1, 5, 10, 'N/A'].map(s => (
                          <button
                            key={s}
                            onClick={() => handleEntryChange(idx, 'manager_score', s)}
                            disabled={!canManagerEdit}
                            className={styles.entryScoreBtn(
                                (s === 'N/A' && (entry.manager_score === null || entry.manager_score === undefined)) || entry.manager_score === s, 
                                true
                            )}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 sm:min-w-[200px]">
                      <input
                        type="text"
                        value={entry.employee_comment || ''}
                        onChange={e => handleEntryChange(idx, 'employee_comment', e.target.value)}
                        disabled={!canEmployeeEdit}
                        placeholder={isAdmin ? "Employee notes locked" : "Add self-observation..."}
                        className={styles.textInput}
                      />
                      {isAdmin && (
                        <input
                          type="text"
                          value={entry.manager_comment || ''}
                          onChange={e => handleEntryChange(idx, 'manager_comment', e.target.value)}
                          placeholder="Manager feedback..."
                          className={styles.managerTextInput}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action Footer */}
          <div className={styles.footer}>
            {saving && (
              <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${styles.mutedText}`}>
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                Syncing Matrix...
              </div>
            )}

            {/* Employee Actions (Personal View) */}
            {!isAdmin && !saving && (
              <>
                {canEmployeeEdit && (
                  <>
                    <button
                      onClick={() => saveAssessment('Draft')}
                      className={styles.btnSaveDraft}
                    >
                      <Save size={14} /> Save Draft
                    </button>
                    <button
                      onClick={() => saveAssessment('Submitted')}
                      className={styles.btnCommit}
                    >
                      <Send size={14} /> Commit Submission
                    </button>
                  </>
                )}
                {localData.status === 'Submitted' && (
                  <div className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'bg-amber-500/10 border border-amber-500/20 text-amber-600' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'}`}>
                    <AlertCircle size={14} /> Awaiting Managerial Review
                  </div>
                )}
                {(localData.status === 'Reviewed' || localData.status === 'Finalized') && (
                  <div className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'}`}>
                    <CheckCircle size={14} /> Protocol Finalized
                  </div>
                )}
              </>
            )}

            {/* Admin Actions (Manager View) */}
            {isAdmin && !saving && (
              <>
                <button
                  onClick={() => saveAssessment(localData.status || 'Draft')}
                  className={styles.btnSaveDraft}
                >
                  <Save size={14} /> Save Changes
                </button>
                <button
                  onClick={() => saveAssessment('Reviewed')}
                  className={isLightMode ? "flex items-center gap-2 px-8 py-2.5 bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-100" : "flex items-center gap-2 px-8 py-2.5 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20"}
                >
                  <CheckCircle size={14} /> Finalize Protocol
                </button>
              </>
            )}
            
            <button
               onClick={exportXLSX}
               className={styles.btnExport}
            >
              <Download size={14} /> Export Node
            </button>
          </div>
        </div>
      )}
    </div>
  );
}