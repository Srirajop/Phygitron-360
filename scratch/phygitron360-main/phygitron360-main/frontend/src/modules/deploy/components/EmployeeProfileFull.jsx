import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Mail, Phone, MapPin, Briefcase, Calendar, 
  ShieldCheck, FileText, User, ChevronRight,
  TrendingUp, Award, Clock, ArrowLeft, Download,
  ExternalLink, Building, Landmark, GraduationCap,
  Save, Edit3, Image, Upload, Trash2, Package, CheckCircle, Key
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import HasPermission from '../../../components/common/HasPermission';
import {
  isValidEmail,
  isValidPhone,
  isValidPAN,
  isValidBankAccount,
  isValidPincode,
  isValidDate,
  isDateAfter,
  isValidURL,
  isPositiveNumber
} from '../../../core/utils/validators';

export default function EmployeeProfileFull({ employeeCode: initialCode, onBack }) {
    const [employeeCode, setEmployeeCode] = useState(initialCode);
    const [details, setDetails] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [formData, setFormData] = useState({});
    const [assets, setAssets] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [managers, setManagers] = useState([]);
    const [errors, setErrors] = useState({});
    const fileInputPfp = useRef();
    const fileInputCv = useRef();
    const fileInputId = useRef();

    const fetchDetails = async (code) => {
        try {
            setLoading(true);
            const res = await fetch(`/api/employee/${code}`, { credentials: 'include' });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setDetails(data);
            setFormData({
                ...data,
                primary_skillset: data.skill_matrix?.primary_skillset || '',
                secondary_skillset: data.skill_matrix?.secondary_skillset || '',
                experience_years: data.skill_matrix?.experience_years || '0',
                doj: (data.doj || '').split('T')[0],
                dob: (data.dob || '').split('T')[0],
                pf_included: ['Yes', 'yes', 'true', '1', true].includes(data.pf_included),
                mediclaim_included: ['Yes', 'yes', 'true', '1', true].includes(data.mediclaim_included),
            });
        } catch {
            toast.error('Failed to load employee profile');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (employeeCode) {
            fetchDetails(employeeCode);
            fetch(`/api/assets/${employeeCode}`, { credentials: 'include' })
                .then(r => r.json()).then(d => setAssets(d)).catch(() => {});
            
            fetch('/api/options', { credentials: 'include' })
                .then(r => r.json())
                .then(data => {
                    if(data.managers) setManagers(data.managers);
                }).catch(() => {});
        }
    }, [employeeCode]);

    // ── Validation Functions ──
    const validateForm = () => {
        const newErrors = {};

        // Email validation
        if (formData.email_id && !isValidEmail(formData.email_id)) {
            newErrors.email_id = 'Please enter a valid email address';
        }

        // Phone validation
        if (formData.contact_number && !isValidPhone(formData.contact_number)) {
            newErrors.contact_number = 'Please enter a valid phone number (10 digits)';
        }

        // Emergency contact validation
        if (formData.emergency_contact && !isValidPhone(formData.emergency_contact)) {
            newErrors.emergency_contact = 'Please enter a valid emergency contact number (10 digits)';
        }

        // DOB validation - just check if valid date
            if (formData.dob && !isValidDate(formData.dob)) {
                newErrors.dob = 'Please enter a valid date of birth';
            }

        // DOJ validation - cannot be before DOB
        if (formData.doj && formData.dob) {
            if (!isValidDate(formData.doj)) {
                newErrors.doj = 'Please enter a valid date of joining';
            } else if (!isDateAfter(formData.doj, formData.dob)) {
                newErrors.doj = 'Date of joining cannot be before date of birth';
            }
        }

        // Experience validation
        if (formData.experience_years && !isPositiveNumber(formData.experience_years)) {
            newErrors.experience_years = 'Experience years must be a positive number';
        }

        // Bank Account validation
        if (formData.bank_account_no && !isValidBankAccount(formData.bank_account_no)) {
            newErrors.bank_account_no = 'Please enter a valid bank account number (digits only, 9-18 digits)';
        }

        // PAN validation
        if (formData.pan_no && !isValidPAN(formData.pan_no)) {
            newErrors.pan_no = 'Please enter a valid PAN (e.g. ABCDE1234F)';
        }

        // URL validations
        if (formData.linkedin_url && !isValidURL(formData.linkedin_url)) {
            newErrors.linkedin_url = 'Please enter a valid LinkedIn URL';
        }
        if (formData.portfolio_url && !isValidURL(formData.portfolio_url)) {
            newErrors.portfolio_url = 'Please enter a valid portfolio URL';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    if (loading && !details) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-[10px] font-black uppercase tracking-widest text-black/80">Loading employee profile...</p>
            </div>
        );
    }

    if (!details) return null;

    const handleSave = async () => {
        // Run validation before saving
        if (!validateForm()) {
            // Focus the first field with error
            const firstError = Object.keys(errors)[0];
            if (firstError) {
                const el = document.getElementById(`field-${firstError}`);
                if (el) el.focus();
            }
            toast.error('Please fix the errors before saving');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                designation: formData.designation,
                team: formData.team,
                employment_type: formData.employment_type,
                reporting_manager: formData.reporting_manager,
                location: formData.location,
                contact_number: formData.contact_number,
                emergency_contact: formData.emergency_contact,
                current_address: formData.current_address,
                permanent_address: formData.permanent_address,
                dob: formData.dob,
                email_id: formData.email_id,
                doj: formData.doj,
                notes: formData.notes,
                education_details: formData.education_details,
                pf_included: formData.pf_included,
                mediclaim_included: formData.mediclaim_included,
                primary_skillset: formData.primary_skillset,
                secondary_skillset: formData.secondary_skillset,
                experience_years: formData.experience_years,
                bank_name: formData.bank_name,
                bank_account_no: formData.bank_account_no,
                pan_no: formData.pan_no,
            };

            const res = await fetch(`/api/employee/${details.employee_code}`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.detail || 'Update failed');
            
            toast.success('Profile updated successfully');
            setEditMode(false);
            setErrors({});
            fetchDetails(details.employee_code);
        } catch (e) {
            toast.error(e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (type, file) => {
        if (!file) return;
        
        // ── File Validation ──
        const allowedTypes = {
            pfp: ['image/jpeg', 'image/png', 'image/webp'],
            cv: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            id: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
        };
        
        const maxSize = 5 * 1024 * 1024; // 5MB
        
        if (!allowedTypes[type].includes(file.type)) {
            const typeNames = {
                pfp: 'JPEG, PNG, WebP',
                cv: 'PDF, DOC, DOCX',
                id: 'JPEG, PNG, WebP, PDF'
            };
            toast.error(`Please upload a valid file type: ${typeNames[type]}`);
            return;
        }
        
        if (file.size > maxSize) {
            toast.error('File size must be less than 5MB');
            return;
        }

        const fd = new FormData();
        if (type === 'pfp') fd.append('photo_file', file);
        if (type === 'cv') fd.append('cv_file', file);
        if (type === 'id') fd.append('id_proof_file', file);

        try {
            toast.loading('Uploading file...', { id: 'upload' });
            const res = await fetch(`/api/employee/${details.employee_code}/documents`, {
                method: 'POST',
                credentials: 'include',
                body: fd
            });
            if (!res.ok) throw new Error('Upload failed');
            toast.success('Artifact synchronized', { id: 'upload' });
            fetchDetails(details.employee_code);
        } catch {
            toast.error('Upload failed', { id: 'upload' });
        }
    };

    const handleOffboard = async () => {
        if (!window.confirm('Are you sure you want to initiate offboarding? This action is irreversible.')) return;
        const exitDate = new Date().toISOString().split('T')[0];
        try {
            const res = await fetch(`/api/employee/${details.employee_code}/offboard`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ exit_date: exitDate, exit_reason: 'Administrative Exit', exit_type: 'Immediate' })
            });
            if (res.ok) {
                toast.success("Personnel decoupled successfully");
                window.location.reload();
            }
        } catch {
            toast.error("Decoupling failed");
        }
    };

    const handleAdminReset = async (type) => {
        try {
            const res = await fetch(`/api/auth/admin-reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    employee_code: details.employee_code,
                    reset_type: type
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || data.message || 'Action failed');
            
            if (type === 'temp_password') {
                toast.success(`Temporary Password: ${data.temporary_password}`, { duration: 10000 });
            } else {
                toast.success('Reset link sent to employee email');
            }
        } catch (e) {
            toast.error(e.message);
        }
    };

    // Helper to render error message
    const renderError = (field) => {
        if (errors[field]) {
            return <p className="text-red-500 text-[9px] font-bold mt-1">{errors[field]}</p>;
        }
        return null;
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Action Bar */}
            <div className="flex justify-between items-center bg-gradient-to-r from-[#f7f3ff] to-[#faf7ff] p-4 rounded-2xl border border-[#e9ddff] shadow-lg shadow-primary/5">
                <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-black/90 hover:text-black transition-all">
                    <ArrowLeft size={14} /> Back to Nexus
                </button>
                <div className="flex gap-3">
                    {editMode ? (
                        <>
                            <button 
                                onClick={() => setEditMode(false)}
                                className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-black/90 hover:bg-[#faf7ff] transition-all"
                            >
                                Abort
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-2 px-8 py-2 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all shadow-lg shadow-primary/20"
                            >
                                {isSaving ? 'Syncing...' : <><Save size={14} /> Synchronize Profile</>}
                            </button>
                        </>
                    ) : (
                        <HasPermission permission="deploy.employees.edit">
                            <button 
                                onClick={() => setEditMode(true)}
                                className="flex items-center gap-2 px-8 py-2 bg-white border border-[#ece4ff] shadow-sm border-[#e9defd] text-primary text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-[#7c3aed] hover:text-white transition-all"
                            >
                                <Edit3 size={14} /> Edit Profile
                            </button>
                        </HasPermission>
                    )}
                </div>
            </div>

            {/* Header / Hero Section */}
            <div className="bg-gradient-to-br from-white via-[#faf7ff] to-[#f7f3ff] border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-primary/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                
                <div className="flex flex-col md:flex-row gap-8 items-start md:items-center relative z-10">
                    {/* Profile Photo */}
                    <div className="relative group">
                        <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border-2 border-primary/30 flex items-center justify-center text-primary font-display font-black text-5xl shrink-0 shadow-2xl shadow-primary/20 overflow-hidden">
                            {details.photo_path ? (
                                <img src={details.photo_path.startsWith('http') ? details.photo_path : `/${details.photo_path.replace(/^\//, '')}`} className="w-full h-full object-cover" alt="" />
                            ) : (
                                details.name?.[0]
                            )}
                        </div>
                        {editMode && (
                            <button 
                                onClick={() => fileInputPfp.current.click()}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-1 rounded-3xl text-white text-[9px] font-black uppercase tracking-widest"
                            >
                                <Image size={18} /> Update PFP
                            </button>
                        )}
                        <input type="file" ref={fileInputPfp} hidden accept="image/jpeg,image/png,image/webp" onChange={e => handleFileUpload('pfp', e.target.files[0])} />
                    </div>
                    
                    <div className="flex-1 space-y-4">
                        <div className="flex flex-col gap-2">
                            {editMode ? (
                                <div>
                                    <input 
                                        type="text" 
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="text-4xl font-display font-black text-black uppercase tracking-tighter italic bg-[#faf7ff] border border-[#e9defd] rounded-xl px-4 py-1 focus:outline-none focus:border-primary w-full"
                                        placeholder="Full Name"
                                    />
                                    {renderError('name')}
                                </div>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <h2 className="text-4xl font-display font-black text-black uppercase tracking-tighter italic">{details.name}</h2>
                                    <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                                        details.employment_status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}>
                                        {details.employment_status || 'Active'}
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3">
                            {editMode ? (
                                <>
                                    <input 
                                        type="text" 
                                        placeholder="Designation"
                                        value={formData.designation}
                                        onChange={e => setFormData({...formData, designation: e.target.value})}
                                        className="bg-[#faf7ff] border border-[#e9defd] rounded-lg px-4 py-1.5 text-xs text-primary font-bold uppercase tracking-widest focus:outline-none"
                                    />
                                    <span className="text-black/90">//</span>
                                    <input 
                                        type="text" 
                                        placeholder="Team"
                                        value={formData.team}
                                        onChange={e => setFormData({...formData, team: e.target.value})}
                                        className="bg-[#faf7ff] border border-[#e9defd] rounded-lg px-4 py-1.5 text-xs text-black/75 font-bold uppercase tracking-widest focus:outline-none"
                                    />
                                </>
                            ) : (
                                <p className="text-primary font-black text-sm uppercase tracking-[0.3em] flex items-center gap-2">
                                    {details.designation} <span className="text-black/90">//</span> {details.team}
                                </p>
                            )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">

<div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
    <div className="flex items-center gap-2 mb-2">
        <Mail size={12} className="text-[#7c3aed]" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#6d28d9]">Email</p>
    </div>
    {editMode ? (
        <div>
            <input
                type="email"
                value={formData.email_id || ''}
                onChange={e => setFormData({...formData, email_id: e.target.value})}
                className="w-full bg-white border border-[#ddd6fe] rounded-xl px-3 py-2 text-xs text-black font-semibold focus:outline-none focus:border-[#7c3aed]"
                placeholder="employee@company.com"
                id="field-email_id"
            />
            {renderError('email_id')}
        </div>
    ) : (
        <p className="text-xs font-black text-black truncate">{formData.email_id || '—'}</p>
    )}
</div>

<div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
    <div className="flex items-center gap-2 mb-2">
        <Phone size={12} className="text-[#7c3aed]" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#6d28d9]">Contact</p>
    </div>
    {editMode ? (
        <div>
            <input
                type="tel"
                value={formData.contact_number || ''}
                onChange={e => setFormData({...formData, contact_number: e.target.value})}
                className="w-full bg-white border border-[#ddd6fe] rounded-xl px-3 py-2 text-xs text-black font-semibold focus:outline-none focus:border-[#7c3aed]"
                placeholder="9876543210"
                id="field-contact_number"
            />
            {renderError('contact_number')}
        </div>
    ) : (
        <p className="text-xs font-black text-black truncate">{formData.contact_number || '—'}</p>
    )}
</div>

<div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
    <div className="flex items-center gap-2 mb-2">
        <MapPin size={12} className="text-[#7c3aed]" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#6d28d9]">Location</p>
    </div>
    {editMode ? (
        <input
            type="text"
            value={formData.location || ''}
            onChange={e => setFormData({...formData, location: e.target.value})}
            className="w-full bg-white border border-[#ddd6fe] rounded-xl px-3 py-2 text-xs text-black font-semibold focus:outline-none focus:border-[#7c3aed]"
            placeholder="City, Country"
        />
    ) : (
        <p className="text-xs font-black text-black truncate">{formData.location || '—'}</p>
    )}
</div>

<div className="bg-[#f4ecff] border border-[#ddd6fe] rounded-2xl px-4 py-3 hover:border-[#7c3aed] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
    <div className="flex items-center gap-2 mb-2">
        <Briefcase size={12} className="text-[#7c3aed]" />
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#6d28d9]">Employee ID</p>
    </div>
    <p className="text-xs font-black text-black truncate">{formData.employee_code || '—'}</p>
</div>

</div>
                    </div>
                </div>
            </div>

            {/* Main Grid: Left (2/3) + Right (1/3) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* ── LEFT COLUMN ── */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Personnel Statistics */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <EditStatCard label="Tenure (DOJ)" value={formData.doj} sub="Joined Date" type="date" editMode={editMode} onChange={v => setFormData({...formData, doj: v})} error={errors.doj} />
                        <EditStatCard label="Contract" value={formData.employment_type} sub="Engagement Mode" editMode={editMode} onChange={v => setFormData({...formData, employment_type: v})} />
                        <EditStatCard label="Experience" value={formData.experience_years} sub="Years" type="number" editMode={editMode} onChange={v => setFormData({...formData, experience_years: v})} error={errors.experience_years} />
                        <EditStatCard label="Manager" value={formData.reporting_manager} sub="Reporting Hub" editMode={editMode} type="select" options={managers.map(m => ({ label: `${m.name} (${m.role})`, value: m.code }))} onChange={v => setFormData({...formData, reporting_manager: v})} displayValue={managers.find(m => m.code === formData.reporting_manager)?.name || formData.reporting_manager} />
                    </div>

                    {/* Skill Synergy */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={TrendingUp} title="Skills & Expertise" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4 italic">Primary Vector Nodes</p>
                                {editMode ? (
                                    <textarea 
                                        value={formData.primary_skillset}
                                        onChange={e => setFormData({...formData, primary_skillset: e.target.value})}
                                        className="w-full bg-gradient-to-br from-[#f7f3ff] to-[#faf7ff] border border-[#e9ddff] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-primary"
                                        rows={3}
                                        placeholder="Comma separated skills..."
                                    />
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {(details.skill_matrix?.primary_skillset || '').split(',').map((s, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-primary/10 to-primary/5 text-primary text-[10px] font-bold uppercase rounded-lg border border-primary/20 shadow-sm shadow-primary/10">
                                                {s.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-black/75 mb-4 italic">Auxiliary Capability Blocks</p>
                                {editMode ? (
                                    <textarea 
                                        value={formData.secondary_skillset}
                                        onChange={e => setFormData({...formData, secondary_skillset: e.target.value})}
                                        className="w-full bg-gradient-to-br from-[#f7f3ff] to-[#faf7ff] border border-[#e9ddff] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-primary/20"
                                        rows={3}
                                        placeholder="Comma separated skills..."
                                    />
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {(details.skill_matrix?.secondary_skillset || '').split(',').map((s, i) => (
                                            <span key={i} className="px-3 py-1.5 bg-gradient-to-r from-[#f7f3ff] to-[#faf7ff] text-black/75 text-[10px] font-bold uppercase rounded-lg border border-[#e9ddff] shadow-sm">
                                                {s.trim()}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Education Logs */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={GraduationCap} title="Academic Foundation Blocks" />
                        <div className="mt-6 space-y-4">
                            {editMode ? (
                                <div className="space-y-4">
                                    <textarea 
                                        value={typeof formData.education_details === 'string' ? formData.education_details : JSON.stringify(formData.education_details, null, 2)}
                                        onChange={e => setFormData({...formData, education_details: e.target.value})}
                                        className="w-full font-mono bg-gradient-to-br from-[#f7f3ff] to-[#faf7ff] border border-[#e9ddff] rounded-xl p-6 text-[10px] text-black focus:outline-none focus:border-primary/30"
                                        rows={10}
                                        placeholder="[ { 'degree': '...', 'university': '...', 'year': '...' } ]"
                                    />
                                    <p className="text-[8px] uppercase font-black text-black/80 tracking-tighter">Enter educational history in JSON sequence protocol</p>
                                </div>
                            ) : (
                                (() => {
                                    let edu = details.education_details;
                                    try { if (typeof edu === 'string') edu = JSON.parse(edu); } catch { return null; }
                                    
                                    if (Array.isArray(edu) && edu.length > 0) {
                                        return edu.map((e, i) => (
                                            <div key={i} className="flex gap-6 items-start p-6 bg-gradient-to-r from-[#f7f3ff] to-[#faf7ff] rounded-2xl border border-[#e9ddff] hover:border-primary/30 hover:bg-primary/5 transition-all group shadow-sm hover:shadow-md hover:shadow-primary/10">
                                                <div className="w-12 h-12 rounded-xl bg-[#faf7ff] flex items-center justify-center text-black/90 shrink-0 group-hover:text-primary transition-colors">
                                                    <Landmark size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex justify-between items-start">
                                                        <h4 className="text-black font-bold text-sm uppercase">{e.degree}</h4>
                                                        <span className="text-xs font-black text-primary font-mono">{e.year}</span>
                                                    </div>
                                                    <p className="text-xs text-black/90 mt-1 uppercase tracking-widest">{e.university}</p>
                                                </div>
                                            </div>
                                        ));
                                    }
                                    return <p className="text-xs text-black/80 italic text-center py-4">No academic history detected.</p>;
                                })()
                            )}
                        </div>
                    </div>

                    {/* Compliance Toggles */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={ShieldCheck} title="Compliance Protocol" />
                        <div className="mt-6 space-y-4">
                            <ComplianceRow
                                label="PF Included"
                                active={formData.pf_included}
                                editMode={editMode}
                                onToggle={() => setFormData({...formData, pf_included: !formData.pf_included})}
                            />
                            <ComplianceRow
                                label="Mediclaim Included"
                                active={formData.mediclaim_included}
                                editMode={editMode}
                                onToggle={() => setFormData({...formData, mediclaim_included: !formData.mediclaim_included})}
                            />
                        </div>
                    </div>

                    {/* Documents */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={FileText} title="Document Artifacts" />
                        <div className="mt-6 space-y-3">
                            <FileCard
                                label="Curriculum Vitae"
                                path={details.cv_path}
                                editMode={editMode}
                                onUpload={() => fileInputCv.current.click()}
                            />
                            <FileCard
                                label="Identity Proof"
                                path={details.id_proofs}
                                editMode={editMode}
                                onUpload={() => fileInputId.current.click()}
                            />
                        </div>
                        <input type="file" ref={fileInputCv} hidden accept=".pdf,.doc,.docx" onChange={e => handleFileUpload('cv', e.target.files[0])} />
                        <input type="file" ref={fileInputId} hidden accept="image/jpeg,image/png,image/webp,.pdf" onChange={e => handleFileUpload('id', e.target.files[0])} />
                    </div>

                    {/* Allocation & Lifecycle Matrix */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/10 overflow-hidden rounded-2xl">
                        <div className="p-6 border-b border-[#ece4ff] bg-[#f4ecff] flex items-center justify-between">
                            <SectionHeader icon={Package} title="Allocation & Lifecycle Matrix" />
                        </div>

                        <div className="p-2 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                            {/* Onboarding Section */}
                            <div className="space-y-1">
                                <div className="px-4 py-2 bg-[#f4ecff] rounded-lg mb-2 border border-[#e9ddff]">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#7c3aed] italic">
                                        I. Onboarding Protocol
                                    </p>
                                </div>
                                {[
                                    { key: 'ob_laptop', label: 'Laptop Unit' },
                                    { key: 'ob_laptop_bag', label: 'Laptop Bag' },
                                    { key: 'ob_headphones', label: 'Headphones' },
                                    { key: 'ob_mouse', label: 'External Mouse' },
                                    { key: 'ob_id_card', label: 'Identity Card' },
                                    { key: 'ob_email_access', label: 'Email Node' },
                                    { key: 'ob_groups', label: 'Group Access' },
                                    { key: 'ob_mediclaim', label: 'Mediclaim' },
                                    { key: 'ob_pf', label: 'Provident Fund' }
                                ].map(a => (
                                    <div key={a.key} className="flex items-center justify-between p-3 px-6 hover:bg-[#f4ecff] transition-all border-b border-[#ece4ff] last:border-0 group">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-black group-hover:text-[#6d28d9] transition-colors">
                                            {a.label}
                                        </span>
                                        {assets?.[a.key] ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase border border-emerald-200 shadow-sm">
                                                <CheckCircle size={8} /> Allocated
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-[#f4ecff] text-black rounded-full text-[8px] font-black uppercase border border-[#ddd6fe] shadow-sm">
                                                Pending
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Clearance Section */}
                            <div className="space-y-1 pt-4">
                                <div className="px-4 py-2 bg-[#f4ecff] rounded-lg mb-2 border border-[#e9ddff]">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 italic">
                                        II. Access Permissions
                                    </p>
                                </div>
                                {[
                                    { key: 'cl_laptop', label: 'Laptop Returned' },
                                    { key: 'cl_laptop_bag', label: 'Bag Returned' },
                                    { key: 'cl_headphones', label: 'Headphones Returned' },
                                    { key: 'cl_mouse', label: 'Mouse Returned' },
                                    { key: 'cl_extra_hardware', label: 'Extra Hardware Returned' },
                                    { key: 'cl_client_assets', label: 'Client Assets Verified' },
                                    { key: 'cl_id_card', label: 'ID Surrendered' },
                                    { key: 'cl_email_access', label: 'Email Disabled' },
                                    { key: 'cl_groups', label: 'Access Purged' },
                                    { key: 'cl_relieving_letter', label: 'Relieving Letter' }
                                ].map(a => (
                                    <div key={a.key} className="flex items-center justify-between p-3 px-6 hover:bg-[#f4ecff] transition-all border-b border-[#ece4ff] last:border-0 group">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-black group-hover:text-[#7c3aed] transition-colors">
                                            {a.label}
                                        </span>
                                        {assets?.[a.key] ? (
                                            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[8px] font-black uppercase border border-amber-200 shadow-sm">
                                                <CheckCircle size={8} /> Cleared
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 bg-[#f4ecff] text-black rounded-full text-[8px] font-black uppercase border border-[#ddd6fe] shadow-sm">
                                                In Use
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-[#faf7ff] border-t border-[#ece4ff]">
                            <button
                                onClick={() => window.location.href = `/deploy?tab=allocations&code=${details.employee_code}`}
                                className="w-full py-3 px-4 rounded-xl border border-[#d8c7ff] bg-white text-[#6d28d9] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#7c3aed] hover:text-white hover:scale-[1.02] hover:shadow-lg hover:shadow-[#7c3aed]/20 transition-all"
                            >
                                Open Deployment Command
                            </button>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={FileText} title="Operator Notes" />
                        <div className="mt-6">
                            {editMode ? (
                                <textarea
                                    value={formData.notes || ''}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                    className="w-full bg-gradient-to-br from-[#f7f3ff] to-[#faf7ff] border border-[#e9ddff] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-primary"
                                    rows={5}
                                    placeholder="Internal notes..."
                                />
                            ) : (
                                <p className="text-xs text-black/80 leading-relaxed bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                    {details.notes || 'No operator notes recorded.'}
                                </p>
                            )}
                        </div>
                    </div>

                </div>
                {/* ── END LEFT COLUMN ── */}

                {/* ── RIGHT COLUMN ── */}
                <div className="space-y-8">

                    {/* Geographic Anchors */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={Landmark} title="Geographic Anchor Points" />
                        <div className="mt-6 space-y-6">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-black mb-2">
                                    Primary Operation Base
                                </p>
                                {editMode ? (
                                    <div>
                                        <textarea
                                            value={formData.current_address}
                                            onChange={e => setFormData({...formData, current_address: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            rows={2}
                                        />
                                        {renderError('current_address')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black leading-relaxed bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff] shadow-sm">
                                        {details.current_address || 'Unregistered'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-black mb-2">
                                    Permanent Identity Anchor
                                </p>
                                {editMode ? (
                                    <div>
                                        <textarea
                                            value={formData.permanent_address}
                                            onChange={e => setFormData({...formData, permanent_address: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl p-4 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            rows={2}
                                        />
                                        {renderError('permanent_address')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black leading-relaxed bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff] shadow-sm">
                                        {details.permanent_address || 'Matches Primary'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Financial Nodes */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={Landmark} title="Financial Nodes" />
                        <div className="mt-6 space-y-6">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-black mb-2">
                                    Bank Name
                                </p>
                                {editMode ? (
                                    <input
                                        type="text"
                                        value={formData.bank_name || ''}
                                        onChange={e => setFormData({...formData, bank_name: e.target.value})}
                                        className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                        placeholder="e.g. HDFC Bank"
                                    />
                                ) : (
                                    <p className="text-xs text-black font-bold bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                        {details.bank_name || 'Not recorded'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-black mb-2">
                                    Bank Account No.
                                </p>
                                {editMode ? (
                                    <div>
                                        <input
                                            type="text"
                                            value={formData.bank_account_no || ''}
                                            onChange={e => setFormData({...formData, bank_account_no: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                            placeholder="Enter 9-18 digit account number"
                                            id="field-bank_account_no"
                                        />
                                        {renderError('bank_account_no')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black font-bold bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                        {details.bank_account_no || 'Not recorded'}
                                    </p>
                                )}
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-black mb-2">
                                    PAN No.
                                </p>
                                {editMode ? (
                                    <div>
                                        <input
                                            type="text"
                                            value={formData.pan_no || ''}
                                            onChange={e => setFormData({...formData, pan_no: e.target.value})}
                                            className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed] uppercase"
                                            placeholder="ABCDE1234F"
                                            id="field-pan_no"
                                        />
                                        {renderError('pan_no')}
                                    </div>
                                ) : (
                                    <p className="text-xs text-black font-bold bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff] uppercase">
                                        {details.pan_no || 'Not recorded'}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Emergency Contact */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={Phone} title="Emergency Contact" />
                        <div className="mt-6">
                            {editMode ? (
                                <div>
                                    <input
                                        type="tel"
                                        value={formData.emergency_contact || ''}
                                        onChange={e => setFormData({...formData, emergency_contact: e.target.value})}
                                        className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                        placeholder="Enter 10-digit emergency contact number"
                                        id="field-emergency_contact"
                                    />
                                    {renderError('emergency_contact')}
                                </div>
                            ) : (
                                <p className="text-xs text-black font-bold bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                    {details.emergency_contact || 'Not registered'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Date of Birth */}
                    <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                        <SectionHeader icon={Calendar} title="Biological Timestamp" />
                        <div className="mt-6">
                            {editMode ? (
                                <div>
                                    <input
                                        type="date"
                                        value={formData.dob || ''}
                                        onChange={e => setFormData({...formData, dob: e.target.value})}
                                        className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-xl px-4 py-3 text-xs text-black focus:outline-none focus:border-[#7c3aed]"
                                        id="field-dob"
                                    />
                                    {renderError('dob')}
                                </div>
                            ) : (
                                <p className="text-xs text-black font-bold bg-[#f4ecff] p-4 rounded-xl border border-[#e9ddff]">
                                    {details.dob ? details.dob.split('T')[0] : 'Not recorded'}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Security & Access */}
                    {details.employment_status === 'Active' && (
                        <HasPermission permission="deploy.employees.edit">
                            <div className="bg-white border border-[#e9ddff] shadow-lg shadow-primary/5 p-8 rounded-2xl">
                                <SectionHeader icon={Key} title="Security & Access" />
                                <div className="mt-6 space-y-3">
                                    <p className="text-[10px] text-black/70 uppercase tracking-widest mb-2">
                                        Account Recovery & Access Control
                                    </p>
                                    <button
                                        onClick={() => handleAdminReset('temp_password')}
                                        className="w-full py-3 px-4 rounded-xl border border-[#ddd6fe] bg-[#f4ecff] text-[#6d28d9] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#7c3aed] hover:text-white transition-all"
                                    >
                                        Generate Temp Password
                                    </button>
                                    <button
                                        onClick={() => handleAdminReset('reset_link')}
                                        className="w-full py-3 px-4 rounded-xl border border-[#ddd6fe] bg-white text-[#6d28d9] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-[#f4ecff] transition-all"
                                    >
                                        Send Reset Link
                                    </button>
                                </div>
                            </div>
                        </HasPermission>
                    )}

                    {/* Offboard Danger Zone */}
                    {details.employment_status === 'Active' && (
                        <HasPermission permission="deploy.employees.offboard">
                            <div className="bg-white border border-red-200 shadow-lg shadow-red-500/5 p-8 rounded-2xl">
                                <SectionHeader icon={X} title="Danger Zone" />
                                <div className="mt-6">
                                    <p className="text-[10px] text-black/70 uppercase tracking-widest mb-4">
                                        Initiating offboard will immediately decouple this personnel record.
                                    </p>
                                    <button
                                        onClick={handleOffboard}
                                        className="w-full py-3 px-4 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-[0.2em] hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                                    >
                                        Initiate Offboard Sequence
                                    </button>
                                </div>
                            </div>
                        </HasPermission>
                    )}

                </div>
                {/* ── END RIGHT COLUMN ── */}

            </div>
            {/* ── END MAIN GRID ── */}

        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EditMetaItem({ editMode, icon: Icon, label, value, onChange }) {
    return (
        <div className="space-y-1.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-black flex items-center gap-2">
                <Icon size={10} className="text-[#7c3aed]" />
                {label}
            </p>
            {editMode ? (
                <input
                    type="text"
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    className="w-full bg-[#f4ecff] border border-[#ddd6fe] rounded-lg px-3 py-2 text-xs text-black font-semibold focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#c4b5fd] transition-all"
                />
            ) : (
                <p className="text-xs text-black font-bold truncate">
                    {value || 'Unknown'}
                </p>
            )}
        </div>
    );
}

function EditStatCard({ label, value, sub, editMode, onChange, type = "text", options = [], displayValue, error }) {
    return (
        <div className={`bg-white border border-[#e9ddff] rounded-2xl shadow-sm hover:shadow-md hover:shadow-[#7c3aed]/10 p-6 transition-all ${editMode ? 'ring-2 ring-[#c4b5fd]' : ''}`}>
            <p className="text-[9px] font-black uppercase tracking-widest text-black mb-2">
                {label}
            </p>
            {editMode ? (
                <>
                    {type === 'select' ? (
                        <select
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            className={`w-full bg-[#f4ecff] border ${error ? 'border-red-400' : 'border-[#ddd6fe]'} rounded-lg px-3 py-2 text-sm text-black font-black uppercase focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#c4b5fd] appearance-none`}
                        >
                            <option value="">Select Manager</option>
                            {options.map((opt, i) => (
                                <option key={i} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    ) : type === 'date' ? (
                        <input
                            type="date"
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            className={`w-full bg-[#f4ecff] border ${error ? 'border-red-400' : 'border-[#ddd6fe]'} rounded-lg px-3 py-2 text-sm text-black font-black uppercase focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#c4b5fd]`}
                        />
                    ) : (
                        <input
                            type={type}
                            value={value || ''}
                            onChange={e => onChange(e.target.value)}
                            className={`w-full bg-[#f4ecff] border ${error ? 'border-red-400' : 'border-[#ddd6fe]'} rounded-lg px-3 py-2 text-sm text-black font-black uppercase focus:outline-none focus:border-[#7c3aed] focus:ring-2 focus:ring-[#c4b5fd]`}
                        />
                    )}
                    {error && <p className="text-red-500 text-[9px] font-bold mt-1">{error}</p>}
                </>
            ) : (
                <p className="text-lg font-display font-black text-black uppercase truncate">
                    {displayValue || value || '—'}
                </p>
            )}
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-[#7c3aed] mt-2">
                {sub}
            </p>
        </div>
    );
}

function SectionHeader({ icon: Icon, title }) {
    return (
        <div className="flex items-center gap-3 border-b border-[#ece4ff] pb-4">
            <div className="w-8 h-8 rounded-lg bg-[#f4ecff] flex items-center justify-center text-[#7c3aed] border border-[#ddd6fe]">
                <Icon size={14} />
            </div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-black">
                {title}
            </h3>
        </div>
    );
}

function FileCard({ label, path, editMode, onUpload }) {
    return (
        <div className="flex items-center justify-between p-4 bg-[#f8f5ff] rounded-xl border border-[#e9ddff] group hover:border-[#c4b5fd] hover:shadow-md hover:shadow-[#7c3aed]/10 transition-all">
            <div className="flex items-center gap-3">
                <FileText size={16} className="text-[#7c3aed] group-hover:text-[#6d28d9] transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-black">
                    {label}
                </span>
            </div>
            <div className="flex gap-2">
                {path && (
                    <a
                        href={path.startsWith('http') ? path : `/${path.replace(/^\//, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 bg-white rounded-lg border border-[#e9ddff] text-[#7c3aed] hover:bg-[#7c3aed] hover:text-white hover:shadow-md hover:shadow-[#7c3aed]/20 transition-all"
                    >
                        <ExternalLink size={12} />
                    </a>
                )}
                {editMode && (
                    <button
                        onClick={onUpload}
                        className="p-2 bg-white rounded-lg border border-[#e9ddff] text-black hover:bg-[#7c3aed] hover:text-white hover:shadow-md hover:shadow-[#7c3aed]/20 transition-all"
                    >
                        <Upload size={12} />
                    </button>
                )}
            </div>
        </div>
    );
}

function ComplianceRow({ label, active, editMode, onToggle }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-black">
                {label}
            </span>
            <button
                disabled={!editMode}
                onClick={onToggle}
                className={`w-10 h-5 rounded-full relative transition-all ${active ? 'bg-[#7c3aed]' : 'bg-[#ddd6fe]'} ${!editMode ? 'opacity-50' : 'cursor-pointer'}`}
            >
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${active ? 'right-0.5' : 'left-0.5'}`} />
            </button>
        </div>
    );
}