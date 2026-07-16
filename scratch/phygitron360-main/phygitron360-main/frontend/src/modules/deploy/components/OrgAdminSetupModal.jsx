import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Trash2, CheckCircle, Upload, FileText, UserPlus, 
  ShieldCheck, MapPin, GraduationCap, Phone, Plus, ArrowRight 
} from 'lucide-react';
import {
  MAX_FILE_SIZE,
  isAtLeastAge,
  isBankAccount,
  isPan,
  isPincode,
  validateFile,
} from '../../../core/utils/validators';

const COUNTRY_CODES = [
  { code: '+91', country: 'IN (+91)' },
  { code: '+1', country: 'US/CA (+1)' },
  { code: '+44', country: 'UK (+44)' },
  { code: '+48', country: 'PL (+48)' },
  { code: '+971', country: 'AE (+971)' },
  { code: '+61', country: 'AU (+61)' },
  { code: '+49', country: 'DE (+49)' },
  { code: '+33', country: 'FR (+33)' },
  { code: '+65', country: 'SG (+65)' }
];

export default function OrgAdminSetupModal({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    full_name: '',
    dob: '',
    contact_number: '', // Local number digits only
    current_location: '',
    state: '',
    city: '',
    pincode: '',
    bank_name: '',
    bank_account_no: '',
    pan_no: '',
    pf_included: 'No',
    mediclaim_included: 'No',
    primary_skills: '',
    secondary_skills: ''
  });

  // Country Code and Emergency States
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyCountryCode, setEmergencyCountryCode] = useState('+91');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [educationList, setEducationList] = useState([
    { degree: '', university: '', cgpa: '', year: '' }
  ]);

  const [files, setFiles] = useState({
    photo_file: null,
    cv_file: null,
    id_proof_file: null
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const updateEducation = (i, field, value) => {
    const copy = [...educationList];
    copy[i][field] = value;
    setEducationList(copy);
  };

  const addEducation = () => {
    setEducationList([
      ...educationList,
      { degree: '', university: '', cgpa: '', year: '' }
    ]);
  };

  const removeEducation = (i) => {
    if (educationList.length > 1) {
      setEducationList(educationList.filter((_, idx) => idx !== i));
    }
  };

  const handleFileChange = (e) => {
    const { name, files: f } = e.target;
    const file = f[0];
    if (!file) return;
    const fileRules = {
      photo_file: { exts: ['.jpg', '.jpeg', '.png'], size: MAX_FILE_SIZE.image, label: 'Profile photo' },
      cv_file: { exts: ['.pdf'], size: MAX_FILE_SIZE.resume, label: 'Resume/CV' },
      id_proof_file: { exts: ['.pdf', '.jpg', '.jpeg', '.png'], size: MAX_FILE_SIZE.document, label: 'ID proof' },
    };
    const rule = fileRules[name];
    const error = rule ? validateFile(file, rule.exts, rule.size, rule.label) : '';
    if (error) {
      toast.error(error);
      e.target.value = '';
      return;
    }
    setFiles(prev => ({ ...prev, [name]: file }));
  };

  const validateStep = () => {
    if (step === 1) {
      if (!form.full_name || !form.dob || !form.contact_number || !emergencyName || !emergencyPhone || !form.bank_name || !form.bank_account_no || !form.pan_no) {
        toast.error("All personal, contact, and financial details are mandatory");
        return false;
      }
      if (!isAtLeastAge(form.dob, 18)) {
        toast.error("Date of Birth must confirm age 18 or above");
        return false;
      }
      
      const phoneDigitsRegex = /^\d{7,15}$/;
      if (!phoneDigitsRegex.test(form.contact_number.trim())) {
        toast.error("Primary Contact must be a valid number of digits (7-15 digits)");
        return false;
      }
      if (!phoneDigitsRegex.test(emergencyPhone.trim())) {
        toast.error("Emergency Contact must be a valid number of digits (7-15 digits)");
        return false;
      }
      if (!isBankAccount(form.bank_account_no)) {
        toast.error("Bank account number must be 9-18 digits only");
        return false;
      }
      if (!isPan(form.pan_no)) {
        toast.error("PAN must follow ABCDE1234F format");
        return false;
      }
    }

    if (step === 2) {
      if (!form.current_location || !form.city || !form.state || !form.pincode) {
        toast.error("All address fields are mandatory");
        return false;
      }
      if (!isPincode(form.pincode)) {
        toast.error("Pincode must be a valid 6 digit Indian pincode");
        return false;
      }
    }

    if (step === 3) {
      if (educationList.some(e => !e.degree || !e.university || !e.cgpa || !e.year)) {
        toast.error("Complete all academic records. All fields are mandatory");
        return false;
      }
      if (educationList.some(e => !/^\d{4}$/.test(String(e.year).trim()))) {
        toast.error("Graduation year must be 4 digits, e.g. 2022");
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step < 4) {
      if (validateStep()) setStep(prev => prev + 1);
      return;
    }

    // Verify all uploads are present (everything is mandatory)
    if (!files.photo_file || !files.cv_file || !files.id_proof_file) {
      toast.error("All uploads (Photo, CV/Resume, and ID Proof) are mandatory");
      return;
    }

    setLoading(true);

    const fd = new FormData();
    const finalAddress = `${form.current_location}, ${form.city}, ${form.state} - ${form.pincode}`;
    const finalContactNumber = `${phoneCountryCode} ${form.contact_number.trim()}`;
    const finalEmergencyContact = `${emergencyName} - ${emergencyCountryCode} ${emergencyPhone.trim()}`;

    fd.append("current_address", finalAddress);
    fd.append("permanent_address", finalAddress);
    fd.append("location", form.city);
    fd.append("full_name", form.full_name);
    fd.append("dob", form.dob);
    fd.append("contact_number", finalContactNumber);
    fd.append("emergency_contact", finalEmergencyContact);
    fd.append("bank_name", form.bank_name);
    fd.append("bank_account_no", form.bank_account_no);
    fd.append("pan_no", form.pan_no);
    fd.append("pf_included", form.pf_included);
    fd.append("mediclaim_included", form.mediclaim_included);
    fd.append("primary_skills", form.primary_skills);
    fd.append("secondary_skills", form.secondary_skills);
    fd.append('education_details', JSON.stringify(educationList));

    Object.entries(files).forEach(([k, v]) => v && fd.append(k, v));

    try {
      const res = await fetch('/api/onboarding/admin-unification', {
        method: 'POST',
        credentials: 'include',
        body: fd
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to submit identity");

      toast.success("Identity initialized successfully");
      onComplete(data.employee_code);

    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md px-6 py-12 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[24px] p-8 md:p-12 shadow-2xl my-auto animate-fade-in-up font-inter text-slate-800">
        
        {/* HEADER */}
        <div className="mb-8 flex justify-between items-center border-b border-slate-100 pb-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Phygitron 360 // Security Node</span>
            <h2 className="text-3xl font-display font-black text-slate-900 uppercase tracking-tighter mt-1">Identity <span className="text-primary text-glow">Initialization</span></h2>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    step >= i ? 'w-8 bg-primary' : 'w-2 bg-slate-100'
                  }`}
                />
              ))}
            </div>
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">Step {step} of 4</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* STEP 1: Personal Details */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={16} className="text-primary" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Personal & Contact Info (All Mandatory)</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Full Name *</label>
                  <input required name="full_name" value={form.full_name} onChange={handleChange} className="w-full glass-panel-input" placeholder="Enter your full name" />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Date of Birth *</label>
                  <input required type="date" name="dob" value={form.dob} onChange={handleChange} className="w-full glass-panel-input" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Primary Contact with Country Code */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1"><Phone size={10} /> Primary Contact *</label>
                  <div className="flex gap-2">
                    <select 
                      value={phoneCountryCode} 
                      onChange={e => setPhoneCountryCode(e.target.value)} 
                      className="bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 outline-none focus:border-primary/40 transition-colors w-28"
                    >
                      {COUNTRY_CODES.map(c => <option key={c.code} value={c.code} className="bg-white text-slate-800">{c.country}</option>)}
                    </select>
                    <input 
                      required
                      type="tel"
                      name="contact_number" 
                      value={form.contact_number} 
                      onChange={handleChange} 
                      className="flex-1 glass-panel-input" 
                      placeholder="98765 43210" 
                    />
                  </div>
                </div>

                {/* Emergency Contact Name */}
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Emergency Contact Name *</label>
                  <input 
                    required 
                    value={emergencyName} 
                    onChange={e => setEmergencyName(e.target.value)} 
                    className="w-full glass-panel-input" 
                    placeholder="e.g. Jane Doe (Relation)" 
                  />
                </div>
              </div>

              {/* Emergency Contact Phone with Country Code */}
              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center gap-1"><Phone size={10} /> Emergency Contact Phone *</label>
                <div className="flex gap-2">
                  <select 
                    value={emergencyCountryCode} 
                    onChange={e => setEmergencyCountryCode(e.target.value)} 
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 text-xs text-slate-800 outline-none focus:border-primary/40 transition-colors w-28"
                  >
                    {COUNTRY_CODES.map(c => <option key={c.code} value={c.code} className="bg-white text-slate-800">{c.country}</option>)}
                  </select>
                  <input 
                    required
                    type="tel"
                    value={emergencyPhone} 
                    onChange={e => setEmergencyPhone(e.target.value)} 
                    className="flex-1 glass-panel-input" 
                    placeholder="98765 43210" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Bank Name *</label>
                  <input required name="bank_name" value={form.bank_name} onChange={handleChange} className="w-full glass-panel-input" placeholder="e.g. HDFC Bank" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Bank Account No. *</label>
                  <input required name="bank_account_no" value={form.bank_account_no} onChange={handleChange} className="w-full glass-panel-input" placeholder="9-18 digits only" inputMode="numeric" />
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest ml-1">Digits only, usually 9-18 digits</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">PAN No. *</label>
                  <input required name="pan_no" value={form.pan_no} onChange={handleChange} className="w-full glass-panel-input" placeholder="ABCDE1234F" style={{textTransform: 'uppercase'}} />
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest ml-1">Format: ABCDE1234F</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center justify-between">
                    <span>PF Included? *</span>
                  </label>
                  <select name="pf_included" value={form.pf_included} onChange={handleChange} className="w-full glass-panel-input cursor-pointer">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1 flex items-center justify-between">
                    <span>Mediclaim Included? *</span>
                  </label>
                  <select name="mediclaim_included" value={form.mediclaim_included} onChange={handleChange} className="w-full glass-panel-input cursor-pointer">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Address & Location */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} className="text-primary" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Location Details (All Mandatory)</h3>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Current Address Street *</label>
                <input required placeholder="Street address, building, apartment" value={form.current_location} onChange={e => setForm({...form, current_location: e.target.value})} className="w-full glass-panel-input"/>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">City *</label>
                  <input required placeholder="e.g. Bangalore" value={form.city} onChange={e => setForm({...form, city: e.target.value})} className="w-full glass-panel-input"/>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">State *</label>
                  <input required placeholder="e.g. Karnataka" value={form.state} onChange={e => setForm({...form, state: e.target.value})} className="w-full glass-panel-input"/>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Pincode *</label>
                  <input required placeholder="6 digits, e.g. 560001" value={form.pincode} onChange={e => setForm({...form, pincode: e.target.value})} className="w-full glass-panel-input" inputMode="numeric"/>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Education History */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <GraduationCap size={16} className="text-primary" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Academic History (All Mandatory)</h3>
                </div>
                <button type="button" onClick={addEducation} className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-primary border border-primary/20 rounded-xl transition-colors">
                  <Plus size={13} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Add Degree</span>
                </button>
              </div>

              <div className="space-y-5 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                {educationList.map((edu, i) => (
                  <div key={i} className="glass-panel p-5 border-slate-100 space-y-4 relative group">
                    {educationList.length > 1 && (
                      <button type="button" onClick={() => removeEducation(i)} className="absolute top-4 right-4 p-2 text-slate-300 hover:text-error hover:bg-error/5 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={14} />
                      </button>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Degree *</label>
                        <input required placeholder="e.g. B.Tech / MBA" value={edu.degree} onChange={e => updateEducation(i, 'degree', e.target.value)} className="w-full glass-panel-input text-[11px] py-2.5 bg-slate-50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">University / College *</label>
                        <input required placeholder="e.g. IIT Delhi" value={edu.university} onChange={e => updateEducation(i, 'university', e.target.value)} className="w-full glass-panel-input text-[11px] py-2.5 bg-slate-50" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">CGPA / Marks % *</label>
                        <input required placeholder="e.g. 8.5 or 85%" value={edu.cgpa} onChange={e => updateEducation(i, 'cgpa', e.target.value)} className="w-full glass-panel-input text-[11px] py-2.5 bg-slate-50" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[8px] font-black uppercase tracking-widest text-slate-400 ml-1">Graduation Year *</label>
                        <input required placeholder="e.g. 2022" value={edu.year} onChange={e => updateEducation(i, 'year', e.target.value)} className="w-full glass-panel-input text-[11px] py-2.5 bg-slate-50" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-6 border-t border-slate-100">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Primary Skills</label>
                  <input name="primary_skills" value={form.primary_skills || ''} onChange={handleChange} className="w-full glass-panel-input" placeholder="e.g. React, Node.js" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 ml-1">Secondary Skills</label>
                  <input name="secondary_skills" value={form.secondary_skills || ''} onChange={handleChange} className="w-full glass-panel-input" placeholder="e.g. Python, Docker" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Document Uploads (Mandatory) */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Upload size={16} className="text-primary" />
                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Required Document Uploads (All Mandatory)</h3>
              </div>

              {/* Guidelines Box */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3 mb-6">
                <ShieldCheck size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="text-[11px] text-slate-600 leading-relaxed">
                  <span className="font-bold text-slate-800 block mb-1">Upload Guidelines & Restrictions</span>
                  All uploads are <span className="text-primary font-bold">strictly mandatory</span>. Supported file formats:
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    <li><strong>Resume/CV:</strong> PDF only (max 5MB, required for AI Parsing)</li>
                    <li><strong>Profile Photo:</strong> JPG, JPEG, or PNG (max 2MB, clear facial shot)</li>
                    <li><strong>ID Proof:</strong> PDF, JPG, JPEG, or PNG (max 5MB, government issued)</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { k: 'photo_file', label: 'Profile Photo *', desc: 'Mandatory: Clear face photo (JPG/PNG)', icon: UserPlus, accept: '.jpg,.jpeg,.png' },
                  { k: 'cv_file', label: 'Resume / CV *', desc: 'Mandatory: Latest curriculum vitae (PDF)', icon: FileText, accept: '.pdf' },
                  { k: 'id_proof_file', label: 'Government ID Proof *', desc: 'Mandatory: Passport/Aadhaar/PAN (PDF/JPG/PNG)', icon: ShieldCheck, accept: '.pdf,.jpg,.jpeg,.png' }
                ].map((f, i) => (
                  <div key={i} className={`flex items-center gap-5 p-5 rounded-2xl border transition-all ${files[f.k] ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200 hover:bg-slate-100/50'}`}>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${files[f.k] ? 'bg-emerald-100 border-emerald-200 text-emerald-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}>
                      {files[f.k] ? <CheckCircle size={20} /> : <f.icon size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">{f.label}</p>
                        {!files[f.k] && <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider truncate">{files[f.k] ? files[f.k].name : f.desc}</p>
                    </div>
                    <label className="cursor-pointer px-4 py-2 bg-slate-100 hover:bg-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-700 border border-slate-200 rounded-xl transition-all">
                      {files[f.k] ? 'Replace' : 'Upload'}
                      <input required={!files[f.k]} type="file" name={f.k} onChange={handleFileChange} className="hidden" accept={f.accept} />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* BUTTON BAR */}
          <div className="flex gap-4 pt-6 border-t border-slate-100">
            {step > 1 && (
              <button 
                type="button" 
                onClick={() => setStep(step - 1)} 
                className="px-8 py-4 rounded-xl border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
              >
                Previous
              </button>
            )}
            
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-1 bg-primary text-white font-black text-[11px] uppercase tracking-widest py-4 rounded-xl hover:bg-primary/95 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  {step < 4 ? 'Continue' : 'Complete Setup'}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>

        </form>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .glass-panel-input {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 16px;
          color: #0f172a;
          font-size: 13px;
          outline: none;
          transition: all 0.2s ease;
        }
        .glass-panel-input:focus {
          border-color: #7b1eff;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(123, 30, 255, 0.1);
        }
        .glass-panel-input::placeholder {
          color: #94a3b8;
        }
        .glass-panel {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0, 0, 0, 0.2); }
      `}} />
    </div>
  );
}
