import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { X, Upload, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  MAX_FILE_SIZE,
  isAtLeastAge,
  isEmail,
  isEmployeeCode,
  isNonNegativeNumber,
  isPhone,
  validateFile,
} from '../../../core/utils/validators';

const ROLES = ['org_admin', 'manager', 'employee', 'candidate'];

const Field = ({ label, k, type = 'text', options, form, set }) => (
  <div>
    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b5cf6] block mb-3">
      {label}
    </label>
    {options ? (
      <select value={form[k]} onChange={e => set(k, e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-[#f8f5ff] text-black text-[13px] font-semibold px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    ) : (
      <input type={type} value={form[k]} onChange={e => set(k, e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all placeholder:text-[#b0a8c5]" />
    )}
  </div>
);

export default function AddEmployeeModal({ onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('single'); // 'single' or 'bulk'
  const [managers, setManagers] = useState([]);
  
  useEffect(() => {
    fetch('/api/options', { credentials: 'include' })
      .then(r => r.json())
      .then(data => setManagers(data.managers || []))
      .catch(() => {});
  }, []);
  
  // Single Add State
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: '', name: '', email: '', dob: '', phone: '', emergency: '',
    doj: '', team: '', role: 'employee', type: 'Full-time', manager: '',
    location: '', designation: '', current_address: '', permanent_address: '',
    pf: 'No', mediclaim: 'No', notes: '', primary_skillset: '',
    secondary_skillset: '', experience_years: '',
  });

  // Bulk Upload State
  const [bulkData, setBulkData] = useState([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const validateSingle = () => {
    const required = [
      ['Employee ID', form.code],
      ['Full Name', form.name],
      ['Email Address', form.email],
      ['Phone Number', form.phone],
      ['Date of Birth', form.dob],
      ['Joining Date', form.doj],
      ['Department', form.team],
      ['Job Title', form.designation],
      ['Work Location', form.location],
    ];
    const missing = required.find(([, value]) => !String(value || '').trim());
    if (missing) return `${missing[0]} is required.`;
    if (!isEmployeeCode(form.code)) return 'Employee ID must be 3-20 letters, numbers, hyphens, or underscores.';
    if (!isEmail(form.email)) return 'Enter a valid email address.';
    if (!isPhone(form.phone)) return 'Phone number must be 7-15 digits, optionally starting with +.';
    if (form.emergency && !isPhone(form.emergency)) return 'Emergency contact must be 7-15 digits, optionally starting with +.';
    if (!isAtLeastAge(form.dob, 18)) return 'Employee must be at least 18 years old.';
    if (form.experience_years !== '' && !isNonNegativeNumber(form.experience_years)) return 'Experience must be 0 or greater.';
    if (!ROLES.includes(form.role)) return 'Select a valid system access role.';
    return '';
  };

  const submitSingle = async () => {
    const validationError = validateSingle();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v) fd.append(k, v);
      });
      const res = await fetch('/api/employee', {
        method: 'POST',
        credentials: 'include',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      
      toast.success(data.message || 'Employee added');
      if (data.login_credentials) {
        toast.success(
          `Login: ${data.login_credentials.username} / ${data.login_credentials.temporary_password}`,
          { duration: 10000 }
        );
      }
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const error = validateFile(file, ['.xlsx', '.xls', '.csv'], MAX_FILE_SIZE.spreadsheet, 'Employee bulk file');
    if (error) {
      toast.error(error);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        setBulkData(data);
        if (data.length === 0) {
          toast.error('The uploaded file is empty.');
        } else {
          toast.success(`Loaded ${data.length} records. Please review before confirming.`);
        }
      } catch (err) {
        toast.error('Failed to parse Excel file. Please use the provided template.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const submitBulk = async () => {
    if (bulkData.length === 0) {
      toast.error('No data to upload.');
      return;
    }
    const rowError = validateBulkRows(bulkData);
    if (rowError) {
      toast.error(rowError, { duration: 7000 });
      return;
    }
    setBulkUploading(true);
    try {
      const res = await fetch('/api/employees/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bulkData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed');
      
      if (data.failed > 0) {
        toast.error(`Successfully added ${data.success} employees, but ${data.failed} failed. Check console for details.`, { duration: 6000 });
        console.error("Bulk upload errors:", data.errors);
      } else {
        toast.success(`Successfully added all ${data.success} employees! Check emails for login credentials.`);
      }
      onSuccess();
    } catch (e) {
      toast.error(e.message || 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const validateBulkRows = (rows) => {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const rowNo = i + 2;
      const code = String(row["Employee Code"] || '').trim();
      const name = String(row["Name"] || '').trim();
      const email = String(row["Email ID"] || '').trim();
      const phone = String(row["Contact Number"] || '').trim();
      const dob = String(row["Date of Birth"] || '').trim();
      const doj = String(row["Date of Joining"] || '').trim();
      const exp = row["Experience Years"];

      if (!code || !name || !email) return `Row ${rowNo}: Employee Code, Name, and Email ID are mandatory.`;
      if (!isEmployeeCode(code)) return `Row ${rowNo}: Employee Code must be 3-20 letters/numbers/hyphen/underscore.`;
      if (!isEmail(email)) return `Row ${rowNo}: Enter a valid Email ID.`;
      if (phone && !isPhone(phone)) return `Row ${rowNo}: Contact Number must be 7-15 digits.`;
      if (dob && !isAtLeastAge(dob, 18)) return `Row ${rowNo}: Date of Birth must confirm age 18 or above.`;
      if (doj && Number.isNaN(new Date(doj).getTime())) return `Row ${rowNo}: Date of Joining is invalid.`;
      if (exp !== undefined && exp !== '' && !isNonNegativeNumber(exp)) return `Row ${rowNo}: Experience Years must be 0 or greater.`;
    }
    return '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-5" onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-[2.8rem] border border-[#ece3ff] bg-[#fcfbff] shadow-[0_30px_100px_rgba(180,140,255,0.18)] p-12 custom-scrollbar animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-7 right-7 w-11 h-11 rounded-2xl bg-[#f5f1ff] border border-[#e7ddff] flex items-center justify-center hover:bg-[#ede6ff] transition-all">
          <X size={18} className="text-black" />
        </button>

        <div className="mb-10">
          <p className="text-[10px] font-black uppercase tracking-[0.32em] text-[#8b5cf6] mb-3">
            Employee Central
          </p>
          <h2 className="text-4xl font-black tracking-tight text-black leading-none mb-8">
            Add Team Member
          </h2>

          <div className="flex bg-[#f5f1ff] p-1.5 rounded-2xl mb-8 w-max">
            <button
              className={`px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all ${activeTab === 'single' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              onClick={() => setActiveTab('single')}
            >
              Single Add
            </button>
            <button
              className={`px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all ${activeTab === 'bulk' ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'}`}
              onClick={() => setActiveTab('bulk')}
            >
              Bulk Upload
            </button>
          </div>
        </div>

        {activeTab === 'single' ? (
          <>
            <div className="flex gap-3 mb-8">
              {[1, 2, 3].map(s => (
                <div key={s} className={`flex-1 h-2 rounded-full transition-all duration-300 ${s <= step ? 'bg-gradient-to-r from-[#c084fc] to-[#8b5cf6]' : 'bg-[#ece7fa]'}`} />
              ))}
            </div>

            <div className="space-y-6">
              {step === 1 && (
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Employee ID *" k="code" form={form} set={set} />
                  <Field label="Full Name *" k="name" form={form} set={set} />
                  <Field label="Email Address *" k="email" type="email" form={form} set={set} />
                  <Field label="Phone Number *" k="phone" form={form} set={set} />
                  <Field label="Date of Birth *" k="dob" type="date" form={form} set={set} />
                  <Field label="Emergency Contact" k="emergency" form={form} set={set} />
                </div>
              )}

              {step === 2 && (
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Joining Date *" k="doj" type="date" form={form} set={set} />
                  <Field label="Department *" k="team" form={form} set={set} />
                  <Field label="Job Title *" k="designation" form={form} set={set} />
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b5cf6] block mb-3">Reporting Manager</label>
                    <select value={form.manager} onChange={e => set('manager', e.target.value)} className="w-full rounded-2xl border border-[#e8defc] bg-[#f8f5ff] text-black text-[13px] font-semibold px-5 py-4 focus:outline-none focus:border-[#b78cff] transition-all">
                      <option value="">Select Manager</option>
                      {managers.map(m => <option key={m.code} value={m.code}>{m.name} ({m.role})</option>)}
                    </select>
                  </div>
                  <Field label="Work Location *" k="location" form={form} set={set} />
                  <Field label="Employment Type" k="type" options={['Full-time', 'Part-time', 'Contract', 'Intern']} form={form} set={set} />
                  <Field label="System Access Role" k="role" options={ROLES} form={form} set={set} />
                </div>
              )}

              {step === 3 && (
                <div className="grid grid-cols-2 gap-6">
                  <Field label="Primary Skills" k="primary_skillset" form={form} set={set} />
                  <Field label="Secondary Skills" k="secondary_skillset" form={form} set={set} />
                  <Field label="Experience (Years)" k="experience_years" type="number" form={form} set={set} />
                  <Field label="PF Enabled" k="pf" options={['No', 'Yes']} form={form} set={set} />
                  <Field label="Mediclaim Enabled" k="mediclaim" options={['No', 'Yes']} form={form} set={set} />
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.22em] text-[#8b5cf6] block mb-3">Additional Notes</label>
                    <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={4} className="w-full rounded-2xl border border-[#e8defc] bg-white text-black text-[13px] px-5 py-4 focus:outline-none focus:border-[#b78cff] resize-none" />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-5 mt-10">
              {step > 1 && (
                <button onClick={() => setStep(s => s - 1)} className="flex-1 py-4 rounded-2xl border border-[#e8defc] bg-white text-black text-[11px] font-black uppercase tracking-[0.25em] hover:bg-[#f5f1ff] transition-all">Back</button>
              )}
              {step < 3 ? (
                <button onClick={() => setStep(s => s + 1)} className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-[0_12px_30px_rgba(180,140,255,0.28)] hover:scale-[1.01] transition-all">Continue</button>
              ) : (
                <button onClick={submitSingle} disabled={submitting} className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-[0_12px_30px_rgba(180,140,255,0.28)] hover:scale-[1.01] transition-all disabled:opacity-50">
                  {submitting ? 'Adding...' : 'Add Employee'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="bg-[#f8f5ff] border border-[#e8defc] rounded-2xl p-6 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm mb-1 text-black">1. Download Template</h3>
                <p className="text-xs text-gray-500">Get the standard Excel file to ensure your data is formatted correctly.</p>
              </div>
              <a 
                href="/api/employees/bulk-upload/template" 
                download
                className="flex items-center gap-2 bg-white border border-[#e8defc] px-4 py-2 rounded-xl text-xs font-bold text-[#8b5cf6] hover:bg-[#f5f1ff] transition-all"
              >
                <Download size={14} /> Download .xlsx
              </a>
            </div>

            <div className="bg-white border-2 border-dashed border-[#e8defc] rounded-2xl p-8 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 bg-[#f5f1ff] rounded-full flex items-center justify-center mb-4">
                <FileSpreadsheet className="text-[#8b5cf6]" size={24} />
              </div>
              <h3 className="font-bold text-sm mb-2 text-black">2. Upload Filled Template</h3>
              <p className="text-xs text-gray-500 mb-6 max-w-xs">Upload your completed .xlsx file. The system will automatically generate secure temporary passwords for new users.</p>
              
              <label className="cursor-pointer bg-black text-white px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-gray-800 transition-all flex items-center gap-2">
                <Upload size={14} /> Browse Files
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            {bulkData.length > 0 && (
              <div className="border border-[#e8defc] rounded-2xl overflow-hidden mt-4">
                <div className="bg-[#f5f1ff] px-4 py-3 border-b border-[#e8defc] flex justify-between items-center">
                  <h3 className="font-bold text-xs text-black">Data Preview ({bulkData.length} Records)</h3>
                </div>
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white sticky top-0 border-b border-[#e8defc]">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-gray-500">Emp Code</th>
                        <th className="px-4 py-3 font-semibold text-gray-500">Name</th>
                        <th className="px-4 py-3 font-semibold text-gray-500">Email</th>
                        <th className="px-4 py-3 font-semibold text-gray-500">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f1ff]">
                      {bulkData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-[#faf8ff] transition-all">
                          <td className="px-4 py-3 font-medium">{row["Employee Code"] || '-'}</td>
                          <td className="px-4 py-3">{row["Name"] || '-'}</td>
                          <td className="px-4 py-3">{row["Email ID"] || '-'}</td>
                          <td className="px-4 py-3">{row["Role"] || 'employee'}</td>
                        </tr>
                      ))}
                      {bulkData.length > 10 && (
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-center text-gray-400 italic">
                            ... and {bulkData.length - 10} more rows
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-5 mt-4">
              <button onClick={submitBulk} disabled={bulkUploading || bulkData.length === 0} className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white text-[11px] font-black uppercase tracking-[0.25em] shadow-[0_12px_30px_rgba(180,140,255,0.28)] hover:scale-[1.01] transition-all disabled:opacity-50">
                {bulkUploading ? 'Uploading & Processing...' : 'Confirm & Upload'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
