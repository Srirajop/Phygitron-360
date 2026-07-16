import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';
import {
  Upload, FileSpreadsheet, Send, Users, BarChart3,
  ChevronDown, Download, Search, CheckCircle, AlertCircle,
  DollarSign, TrendingUp, Calendar, RefreshCw, Eye, X
} from 'lucide-react';
import {
  MAX_FILE_SIZE,
  isBankAccount,
  isNonNegativeNumber,
  isPan,
  validateFile,
} from '../../../core/utils/validators';

const MONTH_NAMES = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December'
};

const fmt = (v) => {
  const n = parseFloat(v) || 0;
  return `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function PayrollPanel() {
  const { user } = useAuth();
  const [tab, setTab] = useState('upload');

  // Upload state
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [payMonth, setPayMonth] = useState(new Date().getMonth() + 1);
  const [payYear, setPayYear] = useState(new Date().getFullYear());
  const [payDate, setPayDate] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  // Manage cycles state
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [cycleDetail, setCycleDetail] = useState([]);
  const [loadingCycles, setLoadingCycles] = useState(false);

  // Directory state
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [empPayslips, setEmpPayslips] = useState([]);
  const [loadingEmpPayslips, setLoadingEmpPayslips] = useState(false);

  // Preview modal
  const [previewRecord, setPreviewRecord] = useState(null);

  useEffect(() => {
    if (tab === 'manage') fetchCycles();
    if (tab === 'directory') fetchEmployees();
  }, [tab]);

  const fetchCycles = async () => {
    setLoadingCycles(true);
    try {
      const res = await fetch('/api/payroll/cycles', { credentials: 'include' });
      const data = await res.json();
      setCycles(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load pay cycles'); }
    finally { setLoadingCycles(false); }
  };

  const fetchCycleDetail = async (year, month) => {
    try {
      const res = await fetch(`/api/payroll/cycle/${year}/${month}`, { credentials: 'include' });
      const data = await res.json();
      setCycleDetail(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load cycle details'); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetch('/api/employees', { credentials: 'include' });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load employees'); }
  };

  const fetchEmpPayslips = async (code) => {
    setLoadingEmpPayslips(true);
    try {
      const res = await fetch(`/api/payroll/employee/${code}`, { credentials: 'include' });
      const data = await res.json();
      setEmpPayslips(Array.isArray(data) ? data : []);
    } catch { toast.error('Failed to load payslips'); }
    finally { setLoadingEmpPayslips(false); }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (f) handleFileSelected(f);
  };

  const handleFileSelected = (f) => {
    const error = validateFile(f, ['.xlsx', '.xls'], MAX_FILE_SIZE.spreadsheet, 'Payroll Excel file');
    if (error) {
      toast.error(error);
      return;
    }
    setFile(f);
    setPreview([]);
  };

  const parseFile = async () => {
    if (!file) { toast.error('Please select an Excel file first'); return; }
    if (payMonth < 1 || payMonth > 12) { toast.error('Pay month must be between 1 and 12'); return; }
    if (payYear < 2000 || payYear > 2100) { toast.error('Pay year must be between 2000 and 2100'); return; }
    setIsParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/payroll/upload', { method: 'POST', credentials: 'include', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Parse failed');
      setPreview(data.preview || []);
      toast.success(`${data.count} employee records parsed successfully`);
    } catch (e) { toast.error(e.message); }
    finally { setIsParsing(false); }
  };

  const pushPayCycle = async () => {
    if (!preview.length) { toast.error('No records to push — parse a file first'); return; }
    const validationError = validatePayrollPreview(preview);
    if (validationError) { toast.error(validationError, { duration: 7000 }); return; }
    setIsPushing(true);
    try {
      const payload = {
        pay_month: payMonth,
        pay_year: payYear,
        pay_date: payDate || null,
        records: preview.map(r => ({
          employee_code: r.employee_code,
          pay_month: payMonth,
          pay_year: payYear,
          pay_date: payDate || null,
          basic_salary: r.basic_salary || 0,
          hra: r.hra || 0,
          special_allowance: r.special_allowance || 0,
          medical_insurance: r.medical_insurance || 0,
          pf_employer_contribution: r.pf_employer_contribution || 0,
          travelling_reimbursement: r.travelling_reimbursement || 0,
          gross_ctc: r.gross_ctc || 0,
          income_tax: r.income_tax || 0,
          medical_deduction: r.medical_deduction || 0,
          employer_pf: r.employer_pf || 0,
          employee_pf: r.employee_pf || 0,
          total_deductions: r.total_deductions || 0,
          net_in_hand: r.net_in_hand || 0,
        }))
      };
      const res = await fetch('/api/payroll/push', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Push failed');
      toast.success(`✓ Payslips pushed for ${data.success_count} employees — notifications sent`);
      setPreview([]);
      setFile(null);
      setTab('manage');
      fetchCycles();
    } catch (e) { toast.error(e.message); }
    finally { setIsPushing(false); }
  };

  const validatePayrollPreview = (records) => {
    const moneyFields = [
      'basic_salary', 'hra', 'special_allowance', 'medical_insurance',
      'pf_employer_contribution', 'travelling_reimbursement', 'gross_ctc',
      'income_tax', 'medical_deduction', 'employer_pf', 'employee_pf',
      'total_deductions', 'net_in_hand'
    ];
    for (let i = 0; i < records.length; i += 1) {
      const r = records[i];
      const label = r.employee_code || `record ${i + 1}`;
      if (!r.employee_code) return `Payroll ${label}: employee code is required.`;
      for (const field of moneyFields) {
        if (r[field] !== undefined && r[field] !== null && !isNonNegativeNumber(r[field])) {
          return `${label}: ${field.replaceAll('_', ' ')} must be 0 or greater.`;
        }
      }
      if (r.bank_account_no && !isBankAccount(r.bank_account_no)) return `${label}: bank account number should be 9-18 digits.`;
      if (r.pan_no && !isPan(r.pan_no)) return `${label}: PAN must follow ABCDE1234F format.`;
      if ((Number(r.total_deductions) || 0) > (Number(r.monthly_ctc) || Number(r.gross_ctc) || 0)) {
        return `${label}: deductions look higher than earnings. Please review before pushing.`;
      }
    }
    return '';
  };

  const downloadPDF = async (employeeCode, year, month) => {
    try {
      const res = await fetch(`/api/payroll/admin/download/${employeeCode}/${year}/${month}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${employeeCode}_${MONTH_NAMES[month]}_${year}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { toast.error(e.message); }
  };

  const previewPDF = async (record) => {
    try {
      toast.loading('Creating preview...', { id: 'pdf-preview' });
      const payload = {
        ...record,
        pay_month: payMonth,
        pay_year: payYear,
        pay_date: payDate || null,
      };
      const res = await fetch('/api/payroll/preview-pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to generate preview');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      toast.success('Preview generated', { id: 'pdf-preview' });
    } catch (e) { toast.error(e.message, { id: 'pdf-preview' }); }
  };

  const panelBase = "bg-white border border-[#ebe4ff] rounded-[2rem] shadow-[0_8px_32px_rgba(180,140,255,0.08)]";
  const tabActive = "bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white shadow-lg";
  const tabInactive = "bg-[#f5efff] border border-[#ebe4ff] text-[#6b7280] hover:text-black hover:bg-[#ede9fe] transition-all";

  const tabs = [
    { id: 'upload', label: 'Bulk Data Upload', icon: Upload },
    { id: 'directory', label: 'Employee Directory', icon: Users },
    { id: 'manage', label: 'Manage Cycles', icon: BarChart3 },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className={`${panelBase} p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8b5cf6] mb-1">Employee Central // Payroll</p>
          <h2 className="text-2xl font-display font-black text-black uppercase tracking-tighter italic">
            Payroll <span className="text-[#8b5cf6]">Management</span>
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${tab === t.id ? tabActive : tabInactive}`}
            >
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: BULK UPLOAD ── */}
      {tab === 'upload' && (
        <div className="space-y-6">
          {/* Pay cycle selector */}
          <div className={`${panelBase} p-6`}>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b5cf6] mb-5">Pay Cycle Configuration</p>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[#6b7280] mb-2 block">Month</label>
                <select
                  value={payMonth}
                  onChange={e => setPayMonth(Number(e.target.value))}
                  className="bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-[#c084fc] transition-all min-w-[140px]"
                >
                  {Object.entries(MONTH_NAMES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[#6b7280] mb-2 block">Year</label>
                <input
                  type="number"
                  value={payYear}
                  onChange={e => setPayYear(Number(e.target.value))}
                  className="bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-[#c084fc] transition-all w-28"
                />
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-[#6b7280] mb-2 block">Pay Date <span className="text-[#c0a0f0]">(optional)</span></label>
                <input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                  className="bg-[#faf7ff] border border-[#ebe4ff] text-black text-xs font-bold px-4 py-3 rounded-xl focus:outline-none focus:border-[#c084fc] transition-all"
                />
              </div>
            </div>
          </div>

          {/* File Drop Zone */}
          <div
            className={`${panelBase} p-10 text-center transition-all cursor-pointer border-2 border-dashed ${dragOver ? 'border-[#8b5cf6] bg-[#f5efff]' : 'border-[#ebe4ff]'}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={handleFileDrop} />
            <div className={`w-20 h-20 rounded-[1.6rem] mx-auto mb-6 flex items-center justify-center transition-all ${dragOver ? 'bg-[#8b5cf6] text-white' : 'bg-[#f5efff] text-[#8b5cf6]'}`}>
              <FileSpreadsheet size={36} />
            </div>
            {file ? (
              <div>
                <p className="text-sm font-black text-black uppercase italic">{file.name}</p>
                <p className="text-[10px] text-[#8b5cf6] font-black uppercase tracking-widest mt-1">{(file.size / 1024).toFixed(1)} KB — Ready to Parse</p>
              </div>
            ) : (
              <div>
                <p className="text-base font-black text-black uppercase italic tracking-tight mb-2">Drop your Excel file here</p>
                <p className="text-[10px] text-[#6b7280] font-black uppercase tracking-widest mb-5">Multi-sheet .xlsx · One sheet per employee code</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = '/api/payroll/admin/template';
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 mx-auto bg-white border border-[#ebe4ff] text-[#8b5cf6] text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-[#8b5cf6] hover:text-white hover:border-[#8b5cf6] transition-all shadow-sm"
                >
                  <Download size={13} />
                  Download Template
                </button>
              </div>
            )}
          </div>

          {/* Parse Button */}
          {file && !preview.length && (
            <div className="flex justify-center">
              <button
                onClick={parseFile}
                disabled={isParsing}
                className="flex items-center gap-3 px-10 py-4 bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-xl disabled:opacity-50"
              >
                {isParsing ? <RefreshCw size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
                {isParsing ? 'Parsing Excel...' : 'Parse & Preview'}
              </button>
            </div>
          )}

          {/* Preview Table */}
          {preview.length > 0 && (
            <div className={`${panelBase} overflow-hidden`}>
              <div className="px-8 py-5 border-b border-[#ebe4ff] flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b5cf6]">Parsed Preview — {preview.length} Employees</p>
                  <p className="text-[9px] text-[#6b7280] font-black uppercase tracking-widest mt-1">
                    Pay Period: {MONTH_NAMES[payMonth]} {payYear}
                  </p>
                </div>
                <button
                  onClick={pushPayCycle}
                  disabled={isPushing}
                  className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#10b981] to-[#059669] text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-lg disabled:opacity-50"
                >
                  {isPushing ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                  {isPushing ? 'Pushing...' : 'New Pay Cycle — Send Payslips'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f5efff] border-b border-[#ebe4ff]">
                    <tr>
                      {['Employee Code', 'Basic', 'HRA', 'Spec. Allow.', 'Med. Ins.', 'PF Employer', 'Travel', 'Monthly CTC', 'Annual CTC', 'Tax', 'PF Emp.', 'Total Ded.', 'Net In Hand', 'Preview'].map(h => (
                        <th key={h} className={`px-4 py-3 text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                          h === 'Annual CTC' ? 'text-[#8b5cf6]' :
                          h === 'Net In Hand' ? 'text-[#10b981]' :
                          h === 'Total Ded.' ? 'text-[#ef4444]' :
                          'text-[#8b8ba3]'
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e8ff]">
                    {preview.map((r, i) => (
                      <tr key={i} className="hover:bg-[#faf7ff] transition-colors">
                        <td className="px-4 py-3 font-black text-xs text-black italic uppercase">{r.employee_code}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-[#6b7280]">{fmt(r.basic_salary)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-[#6b7280]">{fmt(r.hra)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-[#6b7280]">{fmt(r.special_allowance)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-[#6b7280]">{fmt(r.medical_insurance)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-[#6b7280]">{fmt(r.pf_employer_contribution)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-[#6b7280]">{fmt(r.travelling_reimbursement)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono font-bold text-[#4b5563] bg-[#f8fafc] border-l border-[#e2e8f0]">{fmt(r.monthly_ctc)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono font-black text-[#8b5cf6] bg-[#f5efff] border-r border-[#e2e8f0]">{fmt(r.gross_ctc)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-[#ef4444]">{fmt(r.income_tax)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono text-[#ef4444]">{fmt(r.employee_pf)}</td>
                        <td className="px-4 py-3 text-[10px] font-mono font-bold text-[#ef4444] bg-[#fef2f2] border-r border-[#fecaca]">{fmt(r.total_deductions)}</td>
                        <td className="px-4 py-3 text-[11px] font-mono font-black text-[#10b981] bg-[#ecfdf5] border-r border-[#a7f3d0]">{fmt(r.net_in_hand)}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => previewPDF(r)} className="text-[#8b5cf6] hover:text-[#7c3aed] flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest mx-auto">
                            <Eye size={12} /> View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: EMPLOYEE DIRECTORY ── */}
      {tab === 'directory' && (
        <div className={`${panelBase} p-8`}>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b5cf6] mb-6">Employee Payroll Directory</p>
          <div className="max-w-md mb-8">
            <label className="text-[9px] font-black uppercase tracking-widest text-[#6b7280] mb-2 block">Select Employee</label>
            <select
              value={selectedEmp?.employee_code || ''}
              onChange={e => {
                const emp = employees.find(em => em.employee_code === e.target.value);
                setSelectedEmp(emp);
                if (emp) fetchEmpPayslips(emp.employee_code);
              }}
              className="w-full bg-[#faf7ff] border border-[#ebe4ff] text-black text-sm px-4 py-3 rounded-xl focus:outline-none focus:border-[#c084fc] transition-all"
            >
              <option value="">Select an employee...</option>
              {employees.map(e => (
                <option key={e.employee_code} value={e.employee_code}>
                  {e.name} ({e.employee_code})
                </option>
              ))}
            </select>
          </div>

          {selectedEmp && (
            <div>
              <div className="flex items-center gap-4 bg-[#f5efff] border border-[#ebe4ff] rounded-2xl p-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] flex items-center justify-center text-white font-black text-xl">
                  {selectedEmp.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-black text-black uppercase italic text-sm">{selectedEmp.name}</p>
                  <p className="text-[9px] text-[#8b8ba3] font-mono uppercase">{selectedEmp.employee_code} · {selectedEmp.designation}</p>
                </div>
              </div>

              {loadingEmpPayslips ? (
                <div className="flex justify-center p-10"><div className="w-8 h-8 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>
              ) : empPayslips.length === 0 ? (
                <p className="text-center text-[10px] font-black uppercase tracking-widest text-[#b6b6c7] py-10">No payslips found for this employee</p>
              ) : (
                <div className="space-y-3">
                  {empPayslips.map((ps, i) => (
                    <div key={i} className="flex items-center justify-between bg-white border border-[#ebe4ff] rounded-2xl px-6 py-4 hover:bg-[#faf7ff] transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-[#f5efff] flex items-center justify-center text-[#8b5cf6]">
                          <Calendar size={18} />
                        </div>
                        <div>
                          <p className="font-black text-black italic text-sm uppercase">{MONTH_NAMES[ps.pay_month]} {ps.pay_year}</p>
                          <p className="text-[9px] text-[#8b8ba3] font-mono uppercase">CTC: {fmt(ps.gross_ctc)} · Ded: {fmt(ps.total_deductions)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">{fmt(ps.net_in_hand)}</span>
                        <button
                          onClick={() => downloadPDF(ps.employee_code, ps.pay_year, ps.pay_month)}
                          className="flex items-center gap-2 px-4 py-2 bg-[#f5efff] text-[#8b5cf6] text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-[#8b5cf6] hover:text-white transition-all"
                        >
                          <Download size={13} /> PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!selectedEmp && (
            <div className="text-center py-16 opacity-30">
              <Users size={48} className="mx-auto mb-4 text-[#8b8ba3]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[#6b7280]">Select an employee to view their payslip history</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: MANAGE CYCLES ── */}
      {tab === 'manage' && (
        <div className="space-y-6">
          {loadingCycles ? (
            <div className="flex justify-center p-20"><div className="w-10 h-10 border-2 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" /></div>
          ) : cycles.length === 0 ? (
            <div className={`${panelBase} p-20 text-center`}>
              <DollarSign size={48} className="mx-auto mb-4 text-[#ebe4ff]" />
              <p className="text-[10px] font-black uppercase tracking-widest text-[#b6b6c7]">No pay cycles found — upload your first Excel file</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cycles.map((c, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedCycle(c);
                    fetchCycleDetail(c.pay_year, c.pay_month);
                  }}
                  className={`${panelBase} p-6 text-left hover:border-[#c084fc] hover:shadow-[0_8px_32px_rgba(192,132,252,0.2)] transition-all group ${selectedCycle?.pay_month === c.pay_month && selectedCycle?.pay_year === c.pay_year ? 'border-[#8b5cf6] shadow-[0_8px_32px_rgba(139,92,246,0.2)]' : ''}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#f5efff] flex items-center justify-center text-[#8b5cf6] group-hover:bg-[#8b5cf6] group-hover:text-white transition-all">
                      <Calendar size={18} />
                    </div>
                    <span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">Processed</span>
                  </div>
                  <p className="text-lg font-black text-black uppercase italic">{MONTH_NAMES[c.pay_month]} {c.pay_year}</p>
                  <p className="text-[9px] text-[#8b8ba3] font-black uppercase tracking-widest mt-1">{c.employee_count} employees</p>
                </button>
              ))}
            </div>
          )}

          {/* Cycle Detail */}
          {selectedCycle && cycleDetail.length > 0 && (
            <div className={`${panelBase} overflow-hidden`}>
              <div className="px-8 py-5 border-b border-[#ebe4ff] flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b5cf6]">
                  {MONTH_NAMES[selectedCycle.pay_month]} {selectedCycle.pay_year} — {cycleDetail.length} Employees
                </p>
                <button onClick={() => setSelectedCycle(null)} className="p-2 rounded-xl bg-[#f5efff] text-[#6b7280] hover:bg-[#8b5cf6] hover:text-white transition-all">
                  <X size={14} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f5efff] border-b border-[#ebe4ff]">
                    <tr>
                      {['Employee', 'Designation', 'Gross CTC', 'Deductions', 'Net In Hand', 'Download'].map(h => (
                        <th key={h} className="px-6 py-3 text-[9px] font-black uppercase tracking-widest text-[#8b8ba3]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0e8ff]">
                    {cycleDetail.map((r, i) => (
                      <tr key={i} className="hover:bg-[#faf7ff] transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-black text-xs text-black italic uppercase">{r.employee_name || r.employee_code}</p>
                          <p className="text-[9px] text-[#8b8ba3] font-mono uppercase">{r.employee_code}</p>
                        </td>
                        <td className="px-6 py-4 text-[10px] text-[#6b7280] font-bold">{r.designation || '—'}</td>
                        <td className="px-6 py-4 text-[10px] font-mono font-black text-[#8b5cf6]">{fmt(r.gross_ctc)}</td>
                        <td className="px-6 py-4 text-[10px] font-mono text-red-500">{fmt(r.total_deductions)}</td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">{fmt(r.net_in_hand)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => downloadPDF(r.employee_code, selectedCycle.pay_year, selectedCycle.pay_month)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f5efff] text-[#8b5cf6] text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-[#8b5cf6] hover:text-white transition-all"
                          >
                            <Download size={12} /> PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PREVIEW MODAL ── */}
      {previewRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setPreviewRecord(null)}>
          <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-8 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#8b5cf6]">Payslip Preview</p>
                <p className="text-xl font-black text-black italic uppercase">{previewRecord.employee_code}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => previewPDF(previewRecord)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center gap-2">
                  <FileSpreadsheet size={14} /> Preview PDF
                </button>
                <button onClick={() => setPreviewRecord(null)} className="p-2 rounded-xl bg-[#f5efff] text-[#6b7280] hover:bg-[#8b5cf6] hover:text-white transition-all"><X size={16} /></button>
              </div>
            </div>
            <div className="space-y-2">
              <div className="bg-[#f5efff] rounded-xl p-4 mb-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#6b7280] mb-3">Employee Financial Info</p>
                {[
                  ['Name', previewRecord.name || 'Not Found'],
                  ['Bank Name', previewRecord.bank_name || 'Not Found'],
                  ['Account No.', previewRecord.bank_account_no || 'Not Found'],
                  ['PAN No.', previewRecord.pan_no || 'Not Found'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1.5 border-b border-[#ebe4ff] last:border-0">
                    <span className="text-[10px] font-bold text-[#6b7280]">{k}</span>
                    <span className="text-[10px] font-black text-black">{v}</span>
                  </div>
                ))}
              </div>
              <div className="bg-[#f5efff] rounded-xl p-4 mb-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-[#6b7280] mb-3">Earnings</p>
                {[
                  ['Basic Salary', previewRecord.basic_salary],
                  ['HRA', previewRecord.hra],
                  ['Special Allowance', previewRecord.special_allowance],
                  ['Medical Insurance', previewRecord.medical_insurance],
                  ["PF Employer's Contribution", previewRecord.pf_employer_contribution],
                  ['Travelling Reimbursement', previewRecord.travelling_reimbursement],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1.5 border-b border-[#ebe4ff] last:border-0">
                    <span className="text-[10px] font-bold text-[#6b7280]">{k}</span>
                    <span className="text-[10px] font-black text-black font-mono">{fmt(v)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-3 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#8b5cf6]">Gross CTC</span>
                  <span className="text-sm font-black text-[#8b5cf6] font-mono">{fmt(previewRecord.gross_ctc)}</span>
                </div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-400 mb-3">Deductions</p>
                {[
                  ['Income Tax', previewRecord.income_tax],
                  ['Medical', previewRecord.medical_deduction],
                  ['Employer PF', previewRecord.employer_pf],
                  ['Employee PF', previewRecord.employee_pf],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between items-center py-1.5 border-b border-red-100 last:border-0">
                    <span className="text-[10px] font-bold text-[#6b7280]">{k}</span>
                    <span className="text-[10px] font-black text-red-500 font-mono">{fmt(v)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex justify-between items-center">
                <span className="text-sm font-black uppercase tracking-widest text-emerald-700">Net In Hand</span>
                <span className="text-xl font-black text-emerald-600 font-mono">{fmt(previewRecord.net_in_hand)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
