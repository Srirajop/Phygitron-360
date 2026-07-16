import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Download, Calendar, ChevronDown, DollarSign, TrendingDown, TrendingUp, FileText, X, PieChart as PieChartIcon } from 'lucide-react';

const MONTH_NAMES = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December'
};

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function MyPayrollPanel() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // Filters
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  useEffect(() => {
    loadPayslips();
  }, []);

  const loadPayslips = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/payroll/my', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load payslips');
      const data = await res.json();
      setPayslips(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e.message || 'Failed to load payslips');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (ps) => {
    const key = `${ps.pay_year}-${ps.pay_month}`;
    setDownloadingId(key);
    try {
      const res = await fetch(`/api/payroll/download/${ps.pay_year}/${ps.pay_month}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip_${MONTH_NAMES[ps.pay_month]}_${ps.pay_year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Payslip downloaded!');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloadingId(null);
    }
  };

  // Derived: filtered list
  const filtered = payslips.filter(ps => {
    if (filterMonth && ps.pay_month !== Number(filterMonth)) return false;
    if (filterYear && ps.pay_year !== Number(filterYear)) return false;
    return true;
  });

  // Helper to calculate monthly earnings from components since gross_ctc stores Annual CTC
  const getMonthlyEarnings = (ps) => {
    if (!ps) return 0;
    return (parseFloat(ps.basic_salary) || 0) + 
           (parseFloat(ps.hra) || 0) + 
           (parseFloat(ps.special_allowance) || 0) + 
           (parseFloat(ps.medical_insurance) || 0) + 
           (parseFloat(ps.pf_employer_contribution) || 0) + 
           (parseFloat(ps.travelling_reimbursement) || 0);
  };

  // YTD stats (current year)
  const currentYear = new Date().getFullYear();
  const ytdPayslips = payslips.filter(ps => ps.pay_year === currentYear);
  const ytdEarnings = ytdPayslips.reduce((s, ps) => s + getMonthlyEarnings(ps), 0);
  const ytdDeductions = ytdPayslips.reduce((s, ps) => s + (parseFloat(ps.total_deductions) || 0), 0);
  const latestPayslip = payslips[0];

  const availableYears = [...new Set(payslips.map(ps => ps.pay_year))].sort((a, b) => b - a);

  // Calculate CTC Breakdown based on the latest payslip
  const ctcBreakdown = latestPayslip ? [
    { name: 'Basic Salary', value: (parseFloat(latestPayslip.basic_salary) || 0) * 12, color: '#8b5cf6' },
    { name: 'HRA', value: (parseFloat(latestPayslip.hra) || 0) * 12, color: '#3b82f6' },
    { name: 'Special Allowance', value: (parseFloat(latestPayslip.special_allowance) || 0) * 12, color: '#10b981' },
    { name: 'Medical Insurance', value: (parseFloat(latestPayslip.medical_insurance) || 0) * 12, color: '#f59e0b' },
    { name: "PF Employer's Contribution", value: (parseFloat(latestPayslip.pf_employer_contribution) || 0) * 12, color: '#f43f5e' },
    { name: 'Travelling Reimbursement', value: (parseFloat(latestPayslip.travelling_reimbursement) || 0) * 12, color: '#0ea5e9' }
  ].filter(item => item.value > 0).sort((a, b) => b.value - a.value) : [];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[#ebe4ff] p-3 rounded-xl shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-[#6b7280] mb-1">{payload[0].name}</p>
          <p className="text-sm font-black font-mono" style={{ color: payload[0].payload.color }}>
            {fmt(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const panelBase = "bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_8px_32px_rgba(180,140,255,0.08)]";

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="w-full space-y-6 animate-fade-in-up pb-10">
      {/* Header */}
      <div className={`${panelBase} p-6`}>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8b5cf6] mb-1">Compensation Details // Payroll</p>
        <h2 className="text-2xl font-display font-black text-black uppercase tracking-tighter italic">
          My <span className="text-[#8b5cf6]">Payroll</span>
        </h2>
      </div>

      {/* YTD Summary Cards */}
      {payslips.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Latest Net Pay',
              value: fmt(latestPayslip?.net_in_hand || 0),
              sub: latestPayslip ? `${MONTH_NAMES[latestPayslip.pay_month]} ${latestPayslip.pay_year}` : '—',
              icon: DollarSign,
              color: '#10b981',
              bg: 'bg-emerald-50',
              border: 'border-emerald-200',
              textColor: 'text-emerald-700'
            },
            {
              label: 'Current Annual CTC',
              value: fmt(latestPayslip?.gross_ctc || 0),
              sub: 'Total Compensation',
              icon: FileText,
              color: '#3b82f6',
              bg: 'bg-blue-50',
              border: 'border-blue-200',
              textColor: 'text-blue-600'
            },
            {
              label: `YTD Earnings (${currentYear})`,
              value: fmt(ytdEarnings),
              sub: `${ytdPayslips.length} months received`,
              icon: TrendingUp,
              color: '#8b5cf6',
              bg: 'bg-[#f5efff]',
              border: 'border-[#ebe4ff]',
              textColor: 'text-[#8b5cf6]'
            },
            {
              label: `YTD Deductions (${currentYear})`,
              value: fmt(ytdDeductions),
              sub: 'Tax + PF + Medical',
              icon: TrendingDown,
              color: '#f43f5e',
              bg: 'bg-red-50',
              border: 'border-red-200',
              textColor: 'text-red-500'
            },
          ].map((card, i) => (
            <div key={i} className={`${panelBase} p-6 border ${card.border} ${card.bg} relative overflow-hidden group`}>
              <div className="absolute top-0 right-0 p-4 opacity-[0.07]">
                <card.icon size={56} />
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#6b7280] mb-3">{card.label}</p>
              <p className={`text-xl font-black font-display italic ${card.textColor}`}>{card.value}</p>
              <p className="text-[9px] text-[#8b8ba3] font-black uppercase tracking-widest mt-1">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* CTC Breakdown View */}
      {latestPayslip && ctcBreakdown.length > 0 && (
        <div className={`${panelBase} p-8 flex flex-col md:flex-row items-center gap-10`}>
          <div className="w-full md:w-1/3 flex justify-center">
            <div className="h-48 w-full max-w-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ctcBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {ctcBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="w-full md:w-2/3">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b5cf6] flex items-center gap-2">
                  <PieChartIcon size={12} /> Annual CTC Breakdown
                </p>
                <p className="text-2xl font-black font-display italic mt-1 text-black">{fmt(latestPayslip.gross_ctc)}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {ctcBreakdown.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                  <div className="flex-1 flex justify-between items-center border-b border-[#f0e8ff] pb-1">
                    <span className="text-[10px] font-bold text-[#6b7280] uppercase tracking-wider">{item.name}</span>
                    <span className="text-[11px] font-black font-mono" style={{ color: item.color }}>{fmt(item.value)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      {payslips.length > 0 && (
        <div className={`${panelBase} p-5 flex flex-wrap gap-3 items-center`}>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b8ba3] mr-2">Filter:</p>
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(e.target.value)}
            className="bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs font-bold px-4 py-2.5 rounded-xl focus:outline-none focus:border-[#c084fc] transition-all"
          >
            <option value="">All Months</option>
            {Object.entries(MONTH_NAMES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            className="bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs font-bold px-4 py-2.5 rounded-xl focus:outline-none focus:border-[#c084fc] transition-all"
          >
            <option value="">All Years</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {(filterMonth || filterYear) && (
            <button
              onClick={() => { setFilterMonth(''); setFilterYear(''); }}
              className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest text-[#6b7280] hover:text-[#8b5cf6] transition-all flex items-center gap-1.5"
            >
              <X size={11} /> Clear
            </button>
          )}
          <span className="ml-auto text-[9px] font-black uppercase tracking-widest text-[#8b8ba3]">
            {filtered.length} payslip{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Payslip List */}
      {payslips.length === 0 ? (
        <div className={`${panelBase} p-20 text-center`}>
          <div className="w-20 h-20 rounded-[1.6rem] bg-[#f5efff] flex items-center justify-center mx-auto mb-6">
            <DollarSign size={36} className="text-[#ebe4ff]" />
          </div>
          <p className="text-base font-black text-black italic uppercase tracking-tight mb-2">No Payslips Found</p>
          <p className="text-[10px] text-[#6b7280] font-black uppercase tracking-widest">
            Your payslips will appear here once your finance team uploads them.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={`${panelBase} p-16 text-center`}>
          <p className="text-[10px] font-black uppercase tracking-widest text-[#b6b6c7]">No payslips match your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ps, i) => (
            <div
              key={i}
              className={`${panelBase} hover:border-[#c084fc] hover:shadow-[0_8px_32px_rgba(192,132,252,0.15)] transition-all`}
            >
              <div
                className="flex items-center justify-between px-8 py-5 cursor-pointer"
                onClick={() => setSelectedPayslip(selectedPayslip?.id === ps.id ? null : ps)}
              >
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] flex items-center justify-center text-white shadow-lg shadow-purple-200">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <p className="font-black text-black italic text-base uppercase tracking-tight">
                      {MONTH_NAMES[ps.pay_month]} {ps.pay_year}
                    </p>
                    <p className="text-[9px] text-[#8b8ba3] font-mono uppercase mt-0.5">
                      Earnings: {fmt(getMonthlyEarnings(ps))} · Deductions: {fmt(ps.total_deductions)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right hidden sm:block">
                    <p className="text-[9px] font-black uppercase tracking-widest text-[#6b7280]">Net In Hand</p>
                    <p className="text-lg font-black text-emerald-600 italic">{fmt(ps.net_in_hand)}</p>
                  </div>
                  <span className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[8px] font-black uppercase rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Paid
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); downloadPDF(ps); }}
                    disabled={downloadingId === `${ps.pay_year}-${ps.pay_month}`}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#f5efff] border border-[#ebe4ff] text-[#8b5cf6] text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-[#8b5cf6] hover:text-white hover:border-[#8b5cf6] transition-all disabled:opacity-50"
                  >
                    <Download size={13} />
                    {downloadingId === `${ps.pay_year}-${ps.pay_month}` ? 'Downloading...' : 'Download PDF'}
                  </button>
                  <ChevronDown
                    size={16}
                    className={`text-[#8b8ba3] transition-transform ${selectedPayslip?.id === ps.id ? 'rotate-180' : ''}`}
                  />
                </div>
              </div>

              {/* Expanded Breakdown */}
              {selectedPayslip?.id === ps.id && (
                <div className="border-t border-[#ebe4ff] px-8 py-6 animate-fade-in-up">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Earnings */}
                    <div className="bg-[#f5efff] border border-[#ebe4ff] rounded-2xl p-5">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-[#8b5cf6] mb-4 flex items-center gap-2">
                        <TrendingUp size={12} /> Earnings
                      </p>
                      <div className="space-y-2.5">
                        {[
                          ['Basic Salary', ps.basic_salary],
                          ['HRA', ps.hra],
                          ['Special Allowance', ps.special_allowance],
                          ['Medical Insurance', ps.medical_insurance],
                          ["PF Employer's Contribution", ps.pf_employer_contribution],
                          ['Travelling Reimbursement', ps.travelling_reimbursement],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center py-2 border-b border-[#ebe4ff] last:border-0">
                            <span className="text-[10px] font-bold text-[#6b7280]">{k}</span>
                            <span className="text-[10px] font-black text-black font-mono">{fmt(v)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-3 border-t-2 border-[#8b5cf6]">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#8b5cf6]">Total Monthly Earnings</span>
                          <span className="text-sm font-black text-[#8b5cf6] font-mono">{fmt(getMonthlyEarnings(ps))}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#a78bfa]">Annual CTC Ref.</span>
                          <span className="text-[10px] font-bold text-[#a78bfa] font-mono">{fmt(ps.gross_ctc)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-5">
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-red-500 mb-4 flex items-center gap-2">
                        <TrendingDown size={12} /> Deductions
                      </p>
                      <div className="space-y-2.5">
                        {[
                          ['Income Tax', ps.income_tax],
                          ['Medical', ps.medical_deduction],
                          ['Employer PF', ps.employer_pf],
                          ['Employee PF', ps.employee_pf],
                        ].map(([k, v]) => (
                          <div key={k} className="flex justify-between items-center py-2 border-b border-red-100 last:border-0">
                            <span className="text-[10px] font-bold text-[#6b7280]">{k}</span>
                            <span className="text-[10px] font-black text-red-500 font-mono">{fmt(v)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center pt-3 border-t-2 border-red-400">
                          <span className="text-[10px] font-black uppercase tracking-widest text-red-500">Total Deductions</span>
                          <span className="text-sm font-black text-red-500 font-mono">{fmt(ps.total_deductions)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Net In Hand */}
                  <div className="mt-5 bg-emerald-50 border border-emerald-200 rounded-2xl px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-600 mb-1">Net Pay For The Month</p>
                      <p className="text-[9px] text-[#6b7280] font-black uppercase tracking-widest">This is your take-home pay after all deductions</p>
                    </div>
                    <p className="text-3xl font-black font-display italic text-emerald-600">{fmt(ps.net_in_hand)}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
