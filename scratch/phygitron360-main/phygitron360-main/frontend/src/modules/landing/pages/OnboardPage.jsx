import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  UserPlus, ArrowRight, Zap, CheckCircle, Upload, 
  Trash2, Plus, Info, ShieldCheck, Phone, MapPin, GraduationCap,
  Eye, EyeOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import logo from "../../../assets/phy360.png";
import {
  MAX_FILE_SIZE,
  isAtLeastAge,
  isBankAccount,
  isPan,
  validateFile,
  validatePassword,
  isValidEmail,
  isNonEmpty,
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

export default function OnboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tokenInfo, setTokenInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Validation States
  const [validationErrors, setValidationErrors] = useState({});

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Form states
  const [form, setForm] = useState({
    password: '', contact_number: '', dob: '',
    current_address: '', permanent_address: '',
    location: '',
    primary_skills: '', secondary_skills: '',
    bank_name: '', bank_account_no: '', pan_no: ''
  });

  // Country Code and Emergency States
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyCountryCode, setEmergencyCountryCode] = useState('+91');
  const [emergencyPhone, setEmergencyPhone] = useState('');

  const [educationList, setEducationList] = useState([
    { degree: '', university: '', year: '', percentage: '' }
  ]);
  
  const [files, setFiles] = useState({ photo_file: null, cv_file: null, id_proof_file: null });
  const [sameAsCurrent, setSameAsCurrent] = useState(false);

  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  const ROLE_LABELS = {
      'org_admin': 'Org Admin (L2)',
      'manager': 'Manager (L3)',
      'employee': 'Employee (L4)'
  };

  useEffect(() => {
    if (!token) {
        setError('Missing secure onboarding token.');
        setLoading(false);
        return;
    }
    fetch('/api/onboarding/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    })
    .then(res => res.json())
    .then(data => {
        if (data.valid || data.email) {
            setTokenInfo(data);
        } else {
            setError(data.detail || 'Token invalid or expired.');
        }
    })
    .catch(() => setError('Connection failed.'))
    .finally(() => setLoading(false));
  }, [token]);

  const validateStep = (currentStep) => {
      const errors = {};
      
      if (currentStep === 1) {
          // Password validation
          const passwordError = validatePassword(form.password);
          if (passwordError) errors.password = passwordError;
          
          // DOB / Age check
          if (!form.dob) errors.dob = "Required";
          else if (!isAtLeastAge(form.dob, 18)) errors.dob = "Must be at least 18 years old";
          
          // Phone validation - strictly 10 digits
          const phoneDigits = form.contact_number.replace(/\D/g, '');
          if (!form.contact_number) {
              errors.contact_number = "Contact number is required";
          } else if (!/^\d{10}$/.test(phoneDigits)) {
              errors.contact_number = "Must be exactly 10 digits (e.g. 9876543210)";
          }

          if (!emergencyName) {
              errors.emergencyName = "Emergency contact name is required";
          }
          
          const emergencyDigits = emergencyPhone.replace(/\D/g, '');
          if (!emergencyPhone) {
              errors.emergencyPhone = "Emergency phone is required";
          } else if (!/^\d{10}$/.test(emergencyDigits)) {
              errors.emergencyPhone = "Must be exactly 10 digits (e.g. 9876543210)";
          }
      }

      if (currentStep === 2) {
          if (!form.current_address) errors.current_address = "Required";
          if (!form.permanent_address && !sameAsCurrent) errors.permanent_address = "Required";
          if (!form.location) errors.location = "Required";
          if (!form.primary_skills) errors.primary_skills = "Required";
          if (!form.bank_name) errors.bank_name = "Required";
          if (!form.bank_account_no) errors.bank_account_no = "Required";
          else if (!isBankAccount(form.bank_account_no)) errors.bank_account_no = "9-18 digits only";
          if (!form.pan_no) errors.pan_no = "Required";
          else if (!isPan(form.pan_no)) errors.pan_no = "Use ABCDE1234F format";
      }

      if (currentStep === 3) {
          educationList.forEach((edu, idx) => {
              if (!edu.degree || !edu.university || !edu.year) {
                  errors[`edu_${idx}`] = "All fields required";
              } else if (!/^\d{4}$/.test(String(edu.year).trim())) {
                  errors[`edu_${idx}`] = "Year must be 4 digits";
              }
          });
      }

      setValidationErrors(errors);
      return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
      if (validateStep(step)) {
          setStep(step + 1);
      } else {
          toast.error("Please fix errors before proceeding");
      }
  };

  const handleChange = (e) => {
      const { name, value } = e.target;
      setForm(prev => {
          const updated = { ...prev, [name]: value };
          if (name === 'current_address' && sameAsCurrent) {
              updated.permanent_address = value;
          }
          return updated;
      });
  };

  const handleSameAsCurrent = (checked) => {
      setSameAsCurrent(checked);
      if (checked) {
          setForm(prev => ({ ...prev, permanent_address: prev.current_address }));
      }
  };

  const addEducation = () => {
      setEducationList([...educationList, { degree: '', university: '', year: '', percentage: '' }]);
  };

  const removeEducation = (index) => {
      if (educationList.length > 1) {
          setEducationList(educationList.filter((_, i) => i !== index));
      }
  };

  const updateEducation = (index, field, value) => {
      const newList = [...educationList];
      newList[index][field] = value;
      setEducationList(newList);
  };

  const handleFileChange = (e) => {
      const { name, files: fList } = e.target;
      const file = fList[0];
      const rules = {
          photo_file: { exts: ['.jpg', '.jpeg', '.png'], size: MAX_FILE_SIZE.image, label: 'Profile photo' },
          cv_file: { exts: ['.pdf'], size: MAX_FILE_SIZE.resume, label: 'Resume/CV' },
          id_proof_file: { exts: ['.pdf', '.jpg', '.jpeg', '.png'], size: MAX_FILE_SIZE.document, label: 'ID proof' },
      };
      const rule = rules[name];
      const fileError = rule ? validateFile(file, rule.exts, rule.size, rule.label) : '';
      if (fileError) {
          toast.error(fileError);
          e.target.value = '';
          return;
      }
      setFiles(prev => ({ ...prev, [name]: file }));

      // Simulate Resume Parsing for CV
      if (name === 'cv_file' && file) {
          toast.promise(
              new Promise(resolve => setTimeout(resolve, 1500)),
              {
                  loading: 'Reading resume details...',
                  success: 'Skills and experience added',
                  error: 'Parsing failed',
              }
          ).then(() => {
              // Mock population
              setForm(prev => ({
                  ...prev,
                  primary_skills: prev.primary_skills || 'Skills: React, Node.js, AWS',
                  secondary_skills: prev.secondary_skills || 'Python, Docker, SQL'
              }));
          });
      }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (step < 4) {
       handleNext();
       return;
    }

    // Final file check
    if (!files.cv_file || !files.photo_file || !files.id_proof_file) {
        toast.error("All uploads (Resume/CV, Photo, and ID Proof) are mandatory");
        return;
    }

    setSubmitting(true);
    const fd = new FormData();
    fd.append('token', token);

    const finalContactNumber = `${phoneCountryCode} ${form.contact_number.trim()}`;
    const finalEmergencyContact = `${emergencyName} - ${emergencyCountryCode} ${emergencyPhone.trim()}`;

    Object.keys(form).forEach(k => {
        if (k === 'contact_number') {
            fd.append(k, finalContactNumber);
        } else {
            fd.append(k, form[k]);
        }
    });
    fd.append('emergency_contact', finalEmergencyContact);
    fd.append('education_details', JSON.stringify(educationList));
    Object.keys(files).forEach(k => files[k] && fd.append(k, files[k]));

    try {
        const res = await fetch('/api/onboarding/complete', {
            method: 'POST',
            body: fd
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to submit data');
        setSuccess(true);
        toast.success("Onboarding details submitted!");
    } catch (err) {
        toast.error(err.message);
    } finally {
        setSubmitting(false);
    }
  };

  // Helper to render error message
  const renderError = (field) => {
    if (validationErrors[field]) {
        return <p className="text-red-500 text-[9px] font-bold mt-1 ml-1">{validationErrors[field]}</p>;
    }
    return null;
  };

  return (
    <div className="onboard-page relative min-h-screen bg-[#f5f5f5] text-black flex items-center justify-center p-6 overflow-hidden font-inter">
      <div className="onboard-bg-glow absolute inset-0 z-0 h-full w-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[1000px] h-[1000px] bg-primary/10 blur-[200px] rounded-full animate-pulse opacity-40 will-change-transform" />
      </div>

      <div className="relative z-10 w-full max-w-2xl animate-fade-in-up">
        <div className="mb-10 flex flex-col items-center">
          <div onClick={() => navigate('/')} className="cursor-pointer mb-6 transition-all hover:scale-105 active:scale-95">
             <img src={logo} alt="PHYGITRON 360" className="onboard-logo" />
          </div>
          <h1 className="text-4xl font-display font-black tracking-tighter uppercase mb-2">Complete <span className="text-primary text-glow">Onboarding</span></h1>
          <div className="flex items-center gap-2 opacity-50 uppercase tracking-[0.4em] text-[10px] font-black">
              <ShieldCheck size={12} /> Secure candidate onboarding
          </div>
        </div>

        <div className="glass-panel p-1 border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
          <div className="bg-[#0B1326]/60 backdrop-blur-3xl rounded-[26px] p-8 md:p-12">
             {loading ? (
                 <div className="text-center py-20">
                     <div className="w-12 h-12 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                     <p className="text-[12px] text-white/40 uppercase font-black tracking-widest animate-pulse">Checking onboarding link...</p>
                 </div>
             ) : error ? (
                 <div className="text-center space-y-6 py-12">
                     <div className="w-20 h-20 bg-error/10 text-error border border-error/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl">
                        <Zap size={40} />
                     </div>
                     <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">Link unavailable</h2>
                     <p className="text-[14px] text-white/50 pb-8 leading-relaxed uppercase tracking-wider">{error}</p>
                     <button onClick={() => navigate('/')} className="px-10 py-4 glass-panel border-white/10 text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-white/5 transition-all">Return home</button>
                 </div>
             ) : success ? (
                 <div className="text-center space-y-6 py-12">
                     <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                        <CheckCircle size={40} />
                     </div>
                     <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter">Onboarding submitted</h2>
                     <p className="text-sm text-white/50 pb-10 leading-relaxed max-w-md mx-auto">
                        Your details have been submitted. The HR team will verify your credentials shortly and notify you when your account is ready.
                     </p>
                     <button onClick={() => navigate('/login')} className="w-full bg-primary text-black font-black text-[12px] uppercase tracking-[0.2em] py-6 rounded-2xl hover:bg-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20">
                        Go to login
                     </button>
                 </div>
             ) : (
                <form onSubmit={handleSubmit} className="space-y-8">
                   <div className="flex justify-between items-end mb-10 border-b border-white/5 pb-8">
                       <div className="space-y-1">
                           <p className="text-[10px] font-black uppercase tracking-widest text-primary">Candidate details</p>
                           <h2 className="text-2xl font-display font-black text-white uppercase">{tokenInfo.name}</h2>
                           <p className="text-[11px] text-white/40 font-medium">{tokenInfo.email} // {ROLE_LABELS[tokenInfo.role] || tokenInfo.role}</p>
                       </div>
                       <div className="text-right">
                           <div className="flex gap-1 mb-2">
                               {[1,2,3,4].map(i => (
                                   <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'w-6 bg-primary shadow-glow' : 'w-2 bg-white/10'}`} />
                               ))}
                           </div>
                           <span className="text-[10px] font-black tracking-widest uppercase text-white/30">Step {step} / 4</span>
                       </div>
                   </div>

                   {/* Step 1: Identity & Credentials */}
                   {step === 1 && (
                      <div className="space-y-6 animate-fade-in-up">
                         <div className="flex items-center gap-2 mb-2">
                             <ShieldCheck size={16} className="text-primary" />
                             <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Account setup</h3>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Password</label>
                               <div className="relative">
                                 <input 
                                   type={showPassword ? 'text' : 'password'} 
                                   name="password" 
                                   value={form.password} 
                                   onChange={handleChange} 
                                   className={`w-full glass-panel-input pr-10 ${validationErrors.password ? 'border-error/50' : 'border-white/5'}`} 
                                   placeholder="Min 8 characters" 
                                 />
                                 <button
                                   type="button"
                                   onClick={() => setShowPassword(!showPassword)}
                                   className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors"
                                 >
                                   {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                 </button>
                               </div>
                               {renderError('password')}
                            </div>
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Date of birth</label>
                               <input type="date" name="dob" value={form.dob} onChange={handleChange} className={`w-full glass-panel-input ${validationErrors.dob ? 'border-error/50' : 'border-white/5'}`} />
                               {renderError('dob')}
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Primary Contact with Country Code */}
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1 flex items-center gap-1"><Phone size={10} /> Contact number *</label>
                               <div className="flex gap-2">
                                 <select 
                                   value={phoneCountryCode} 
                                   onChange={e => setPhoneCountryCode(e.target.value)} 
                                   className="bg-white border border-gray-300 rounded-xl px-3 text-xs text-gray-900 outline-none focus:border-[#7b1eff]/40 transition-colors w-28"
                                 >
                                   {COUNTRY_CODES.map(c => <option key={c.code} value={c.code} className="bg-white text-gray-900" style={{ color: '#000000' }}>{c.country}</option>)}
                                 </select>
                                 <input 
                                   required
                                   type="tel"
                                   name="contact_number" 
                                   value={form.contact_number} 
                                   onChange={handleChange} 
                                   className={`flex-1 glass-panel-input ${validationErrors.contact_number ? 'border-error/50' : 'border-[#e5e5e5]'}`} 
                                   placeholder="9876543210" 
                                 />
                               </div>
                               {renderError('contact_number')}
                            </div>

                            {/* Emergency Contact Name */}
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Emergency Contact Name *</label>
                               <input 
                                 required 
                                 value={emergencyName} 
                                 onChange={e => setEmergencyName(e.target.value)} 
                                 className={`w-full glass-panel-input ${validationErrors.emergencyName ? 'border-error/50' : 'border-[#e5e5e5]'}`} 
                                 placeholder="e.g. Jane Doe (Relation)" 
                               />
                               {renderError('emergencyName')}
                            </div>
                         </div>

                         {/* Emergency Contact Phone with Country Code */}
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1 flex items-center gap-1"><Phone size={10} /> Emergency Contact Phone *</label>
                               <div className="flex gap-2">
                                 <select 
                                   value={emergencyCountryCode} 
                                   onChange={e => setEmergencyCountryCode(e.target.value)} 
                                   className="bg-white border border-gray-300 rounded-xl px-3 text-xs text-gray-900 outline-none focus:border-[#7b1eff]/40 transition-colors w-28"
                                 >
                                   {COUNTRY_CODES.map(c => <option key={c.code} value={c.code} className="bg-white text-gray-900" style={{ color: '#000000' }}>{c.country}</option>)}
                                 </select>
                                 <input 
                                   required
                                   type="tel"
                                   value={emergencyPhone} 
                                   onChange={e => setEmergencyPhone(e.target.value)} 
                                   className={`flex-1 glass-panel-input ${validationErrors.emergencyPhone ? 'border-error/50' : 'border-[#e5e5e5]'}`} 
                                   placeholder="9876543210" 
                                 />
                               </div>
                               {renderError('emergencyPhone')}
                            </div>
                         </div>
                      </div>
                   )}

                   {/* Step 2: Location & Capabilities */}
                   {step === 2 && (
                      <div className="space-y-6 animate-fade-in-up">
                         <div className="flex items-center gap-2 mb-2">
                             <MapPin size={16} className="text-primary" />
                             <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Location and skills</h3>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Current address</label>
                                <textarea name="current_address" rows="2" value={form.current_address} onChange={handleChange} className="w-full glass-panel-input resize-none" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">City / location</label>
                                <input name="location" value={form.location} onChange={handleChange} className="w-full glass-panel-input" placeholder="e.g. Mumbai, Bangalore" />
                             </div>
                          </div>

                         <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Permanent address</label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input type="checkbox" checked={sameAsCurrent} onChange={e => handleSameAsCurrent(e.target.checked)} className="hidden" />
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${sameAsCurrent ? 'bg-primary border-primary' : 'border-white/20'}`}>
                                        {sameAsCurrent && <CheckCircle size={10} className="text-black" />}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/30 group-hover:text-primary transition-colors">Same as current</span>
                                </label>
                            </div>
                            {!sameAsCurrent && <textarea name="permanent_address" rows="2" value={form.permanent_address} onChange={handleChange} className="w-full glass-panel-input resize-none" />}
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Primary skills</label>
                               <input type="text" name="primary_skills" value={form.primary_skills} onChange={handleChange} className={`w-full glass-panel-input ${validationErrors.primary_skills ? 'border-error/50' : 'border-white/5'}`} placeholder="Core Skills" />
                               {renderError('primary_skills')}
                            </div>
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Secondary skills</label>
                               <input type="text" name="secondary_skills" value={form.secondary_skills} onChange={handleChange} className="w-full glass-panel-input" placeholder="Auxiliary Skills" />
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-white/5 mt-4">
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Bank Name *</label>
                               <input type="text" name="bank_name" value={form.bank_name} onChange={handleChange} className={`w-full glass-panel-input ${validationErrors.bank_name ? 'border-error/50' : 'border-white/5'}`} placeholder="e.g. HDFC Bank" />
                               {renderError('bank_name')}
                            </div>
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">Bank Account No. *</label>
                               <input type="text" name="bank_account_no" value={form.bank_account_no} onChange={handleChange} className={`w-full glass-panel-input ${validationErrors.bank_account_no ? 'border-error/50' : 'border-white/5'}`} placeholder="9-18 digit account number" inputMode="numeric" />
                               {renderError('bank_account_no')}
                            </div>
                            <div className="space-y-2">
                               <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">PAN No. *</label>
                               <input type="text" name="pan_no" value={form.pan_no} onChange={handleChange} className={`w-full glass-panel-input ${validationErrors.pan_no ? 'border-error/50' : 'border-white/5'}`} placeholder="e.g. ABCDE1234F" style={{textTransform: 'uppercase'}} />
                               {!validationErrors.pan_no && <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest mt-1 ml-1">PAN format: ABCDE1234F</p>}
                               {renderError('pan_no')}
                            </div>
                         </div>
                      </div>
                   )}

                   {/* Step 3: Education Modules */}
                   {step === 3 && (
                      <div className="space-y-6 animate-fade-in-up">
                         <div className="flex items-center justify-between mb-4">
                             <div className="flex items-center gap-2">
                                <GraduationCap size={16} className="text-primary" />
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Education history</h3>
                             </div>
                             <button type="button" onClick={addEducation} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-primary rounded-xl transition-all border border-primary/20">
                                <Plus size={14} /> <span className="text-[10px] font-black uppercase tracking-widest">Add education</span>
                             </button>
                         </div>

                         <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                             {educationList.map((edu, idx) => (
                                 <div key={idx} className="glass-panel p-6 border-white/5 space-y-4 relative group">
                                     {educationList.length > 1 && (
                                         <button type="button" onClick={() => removeEducation(idx)} className="absolute top-4 right-4 p-2 text-white/20 hover:text-error hover:bg-error/10 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                                            <Trash2 size={14} />
                                         </button>
                                     )}
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                         <input placeholder="Degree / Qualification" value={edu.degree} onChange={e => updateEducation(idx, 'degree', e.target.value)} className="w-full glass-panel-input text-[11px] py-3 bg-black/40" />
                                         <input placeholder="Institution / Board" value={edu.university} onChange={e => updateEducation(idx, 'university', e.target.value)} className="w-full glass-panel-input text-[11px] py-3 bg-black/40" />
                                     </div>
                                     <div className="grid grid-cols-2 gap-4">
                                         <input placeholder="Year" value={edu.year} onChange={e => updateEducation(idx, 'year', e.target.value)} className="w-full glass-panel-input text-[11px] py-3 bg-black/40" />
                                         <input placeholder="CGPA / %" value={edu.percentage} onChange={e => updateEducation(idx, 'percentage', e.target.value)} className="w-full glass-panel-input text-[11px] py-3 bg-black/40" />
                                     </div>
                                 </div>
                             ))}
                         </div>
                      </div>
                   )}

                   {/* Step 4: Digital Proofs */}
                   {step === 4 && (
                      <div className="space-y-6 animate-fade-in-up">
                         <div className="flex items-center gap-2 mb-2">
                             <Upload size={16} className="text-primary" />
                             <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40">Required Document Uploads (All Mandatory)</h3>
                         </div>
                         
                         <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-3 mb-6">
                             <Info size={16} className="text-primary mt-0.5 shrink-0" />
                             <div className="text-[11px] text-black/60 leading-relaxed">
                                 <span className="font-bold text-black block mb-1">Upload Guidelines & Restrictions</span>
                                 All uploads are <span className="text-error font-bold">strictly mandatory</span>. Supported file formats:
                                 <ul className="list-disc list-inside mt-1 space-y-0.5">
                                     <li><strong>Resume/CV:</strong> PDF only (max 5MB, required for AI Parsing)</li>
                                     <li><strong>Profile Photo:</strong> JPG, JPEG, or PNG (max 2MB, clear facial shot)</li>
                                     <li><strong>ID Proof:</strong> PDF, JPG, JPEG, or PNG (max 5MB, government issued)</li>
                                 </ul>
                             </div>
                         </div>

                         <div className="space-y-4">
                            {[
                                { k: 'cv_file', label: 'Resume / CV *', desc: 'Mandatory: Upload your latest resume (PDF)', icon: ShieldCheck, accept: '.pdf' },
                                { k: 'photo_file', label: 'Photo *', desc: 'Mandatory: Clear passport size photo (JPG/PNG)', icon: UserPlus, accept: '.jpg,.jpeg,.png' },
                                { k: 'id_proof_file', label: 'ID proof *', desc: 'Mandatory: Government issued identity proof (PDF/JPG/PNG)', icon: ShieldCheck, accept: '.pdf,.jpg,.jpeg,.png' }
                            ].map((f, i) => (
                               <div key={i} className={`onboard-upload-row flex items-center gap-6 p-6 rounded-[22px] border transition-all ${files[f.k] ? 'is-complete' : 'is-empty'}`}>
                                  <div className={`onboard-upload-icon w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all ${files[f.k] ? 'is-complete' : 'is-empty'}`}>
                                      {files[f.k] ? <CheckCircle size={24} /> : <f.icon size={24} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                     <div className="flex items-center gap-2">
                                         <p className="text-[11px] font-black uppercase tracking-widest text-white">{f.label}</p>
                                         {!files[f.k] && <div className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" title="Required" />}
                                     </div>
                                     <p className="text-[10px] text-white/30 mt-1 uppercase tracking-wider truncate">{files[f.k] ? files[f.k].name : f.desc}</p>
                                  </div>
                                  <label className="cursor-pointer px-5 py-2.5 bg-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-white border border-white/10 rounded-xl transition-all">
                                      {files[f.k] ? 'Replace' : 'Upload'}
                                      <input type="file" name={f.k} onChange={handleFileChange} className="hidden" accept={f.accept} />
                                  </label>
                               </div>
                            ))}
                         </div>
                      </div>
                   )}

                   {/* Navigation */}
                   <div className="flex gap-4 pt-10 border-t border-white/5">
                       {step > 1 && (
                           <button type="button" onClick={() => setStep(step - 1)} className="px-10 py-5 rounded-2xl border border-white/5 text-white/60 text-[11px] font-black uppercase tracking-widest hover:bg-white/5 transition-all">
                               Previous
                           </button>
                       )}
                       <button type="submit" disabled={submitting} className="flex-1 bg-primary text-black font-black text-[12px] uppercase tracking-[0.2em] py-5 rounded-2xl shadow-[0_15px_40px_rgba(204,151,255,0.3)] hover:bg-white hover:shadow-white/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:grayscale">
                           {submitting ? (
                               <>
                                   <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                   Submitting...
                               </>
                           ) : (
                               <>
                                   {step < 4 ? 'Continue' : 'Submit onboarding'}
                                   <ArrowRight size={18} />
                               </>
                           )}
                       </button>
                   </div>
                </form>
             )}
          </div>
        </div>
        
        <div className="mt-10 flex items-center justify-center gap-6 opacity-30 text-[9px] font-black uppercase tracking-widest">
            <span className="flex items-center gap-2"><ShieldCheck size={12}/> Secure form</span>
            <span className="flex items-center gap-2"><Info size={12}/> Resume parsing enabled</span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .onboard-page {
          background: #f5f5f5;
          color: #111111;
          min-height: 100vh;
          align-items: flex-start;
          padding-top: 48px;
          padding-bottom: 48px;
        }

        .onboard-bg-glow {
          display: none;
        }

        .onboard-page .glass-panel {
          background: #ffffff !important;
          border: 1px solid #e5e5e5 !important;
          border-radius: 8px !important;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08) !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .onboard-page [class*="bg-[#0B1326]"] {
          background: #ffffff !important;
          border-radius: 8px !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }

        .onboard-page [class*="bg-[#060E20]"],
        .onboard-page [class*="bg-black/40"],
        .onboard-page [class*="bg-white/5"] {
          background: #f7f7f7 !important;
        }

        .onboard-page [class*="border-white"] {
          border-color: #e5e5e5 !important;
        }

        .onboard-page [class*="text-white"],
        .onboard-page [class*="text-on-surface"] {
          color: #111111 !important;
        }

        .onboard-page [class*="text-white/"],
        .onboard-page [class*="opacity-50"],
        .onboard-page [class*="opacity-40"],
        .onboard-page [class*="opacity-30"] {
          color: #666666 !important;
          opacity: 1 !important;
        }

        .onboard-page .text-primary,
        .onboard-page [class*="text-primary"] {
          color: #7b1eff !important;
        }

        .onboard-page .bg-primary,
        .onboard-page [class*="bg-primary"] {
          background: #7b1eff !important;
        }

        .onboard-page .text-black,
        .onboard-page button.bg-primary,
        .onboard-page button[class*="bg-primary"] {
          color: #ffffff !important;
        }

        .onboard-page h1,
        .onboard-page h2,
        .onboard-page h3,
        .onboard-page label,
        .onboard-page button,
        .onboard-page p,
        .onboard-page span {
          letter-spacing: 0 !important;
        }

        .onboard-page h1 {
          font-size: clamp(28px, 4vw, 42px) !important;
          font-weight: 500 !important;
          text-transform: none !important;
        }

        .onboard-logo {
          width: min(150px, 64vw);
          height: auto;
          display: block;
        }

        .onboard-page h2 {
          font-weight: 600 !important;
          text-transform: none !important;
        }

        .onboard-page label,
        .onboard-page h3,
        .onboard-page p,
        .onboard-page span {
          text-transform: none !important;
        }

        .onboard-page button,
        .onboard-page label[class*="cursor-pointer"] {
          border-radius: 6px !important;
        }

        .onboard-page .rounded-3xl,
        .onboard-page .rounded-2xl,
        .onboard-page .rounded-[22px],
        .onboard-page .rounded-[26px] {
          border-radius: 8px !important;
        }

        .onboard-page .shadow-glow,
        .onboard-page .text-glow {
          box-shadow: none !important;
          text-shadow: none !important;
        }

        .onboard-upload-row.is-complete {
          background: #eeeeee !important;
          border-color: #d6d6d6 !important;
        }

        .onboard-upload-row.is-empty {
          background: #f7f7f7 !important;
          border-color: #e5e5e5 !important;
        }

        .onboard-upload-row.is-empty:hover {
          background: #f1f1f1 !important;
        }

        .onboard-upload-icon.is-complete {
          background: #4a4a4a !important;
          border-color: #4a4a4a !important;
          color: #ffffff !important;
        }

        .onboard-upload-icon.is-empty {
          background: #ffffff !important;
          border-color: #d8d8d8 !important;
          color: #777777 !important;
        }

        .glass-panel-input {
          background: #ffffff;
          border: 1px solid #d8d8d8;
          border-radius: 6px;
          padding: 16px 20px;
          color: #111111;
          font-size: 13px;
          width: 100%;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          outline: none;
        }
        .glass-panel-input:focus {
          border-color: #7b1eff;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(123, 30, 255, 0.12);
        }
        .glass-panel-input::placeholder {
          color: #8a8a8a;
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cccccc; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #999999; }
      `}} />
    </div>
  );
}