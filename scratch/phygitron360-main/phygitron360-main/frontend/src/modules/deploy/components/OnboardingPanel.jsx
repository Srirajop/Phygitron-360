import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  UserPlus, Mail, CheckCircle, Clock, Trash2, Plus, 
  FileText, Briefcase, GraduationCap, MapPin, Phone, 
  ChevronRight, BadgeCheck, ShieldAlert, Eye, ExternalLink,
  Copy, Link, Ban
} from 'lucide-react';
import ComboBox from '../../../core/components/ComboBox';
import {
  isEmail,
  isEmployeeCode,
  isFutureDate,
  isNonEmpty,
  isValidPhone,
} from '../../../core/utils/validators';

const DESIGNATIONS = [
    'Software Engineer', 'Senior Engineer', 'Team Lead', 'Project Manager', 
    'Product Manager', 'Designer', 'QA Analyst', 'Sales Executive', 
    'HR Associate', 'Accountant', 'Marketing Specialist', 'Operations Manager'
];

const DEPARTMENTS = [
    'Engineering', 'Product', 'Design', 'Marketing', 'Sales', 
    'Human Resources', 'Finance', 'Operations', 'Quality Assurance'
];

export default function OnboardingPanel() {
  const [activeTab, setActiveTab] = useState('invites');
  const [invites, setInvites] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [managers, setManagers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [dynDesignations, setDynDesignations] = useState([]);
  const [dynDepartments, setDynDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'employee', department: '', designation: '' });
  const [submitting, setSubmitting] = useState(false);

  const isLightMode = window.location.pathname.startsWith('/deploy');

  // Approval Form Stats
  const [approveForm, setApproveForm] = useState({
    manager: '',
    type: 'Full Time',
    pf: 'No',
    mediclaim: 'No',
    location: '',
    notes: '',
    code: '',
    doj: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { 
    if (activeTab === 'invites') loadInvites();
    else {
        loadApprovals();
        loadOptions();
    }
  }, [activeTab]);

  const loadOptions = async () => {
    try {
        const res = await fetch('/api/options', { credentials: 'include' });
        const data = await res.json();
        setManagers(data.managers || []);
        setLocations(data.locations || []);
        setDynDesignations(data.designations || []);
        setDynDepartments(data.departments || []);
    } catch {
        toast.error("Failed to sync structural dependencies");
    }
  };

  const loadInvites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/invites', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setInvites(data);
    } catch {
      toast.error('Failed to load active invite sequences');
    } finally {
      setLoading(false);
    }
  };

  const loadApprovals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/approvals', { credentials: 'include' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApprovals(data);
    } catch {
      toast.error('Failed to load approval pipeline');
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!form.name || !form.email) {
      toast.error('Please input complete vectors');
      return;
    }
    if (!isEmail(form.email)) {
      toast.error('Enter a valid invite email address');
      return;
    }
    if (!isNonEmpty(form.role)) {
      toast.error('Select an onboarding role');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Transmission failed');
      toast.success('Sequence Initiated successfully');
      setForm({ name: '', email: '', role: 'employee', department: '', designation: '' });
      setShowForm(false);
      loadInvites();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const copyInviteLink = (token) => {
    const link = `${window.location.origin}/onboard?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Sequence link copied to clipboards');
  };

  const revokeInvite = async (id) => {
    if (!confirm('Are you sure you want to revoke this invite?')) return;
    try {
      const res = await fetch(`/api/onboarding/invite/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error();
      toast.success('Invite sequence revoked');
      loadInvites();
    } catch {
      toast.error('Failed to abort invitation sequence');
    }
  };

  const hardDeleteInvite = async (id) => {
    if (!confirm('Are you sure you want to completely delete this invite log? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/onboarding/invite/${id}/delete`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error();
      toast.success('Invite log permanently deleted');
      loadInvites();
    } catch {
      toast.error('Failed to delete invite log');
    }
  };

  const openApprovalReview = (approval) => {
    setSelectedApproval(approval);
    setApproveForm(prev => ({
      ...prev,
      code: approval.employee_code,
      location: approval.location || '',
      doj: approval.doj || new Date().toISOString().split('T')[0]
    }));
  };

  const manageCompletedInvite = async (invite) => {
    try {
      const [approvalsRes] = await Promise.all([
        fetch('/api/onboarding/approvals', { credentials: 'include' }),
        loadOptions()
      ]);

      if (!approvalsRes.ok) throw new Error();

      const pendingApprovals = await approvalsRes.json();
      setApprovals(pendingApprovals);

      const approval = pendingApprovals.find(app =>
        app.email_id?.toLowerCase?.() === invite.email?.toLowerCase?.()
      );

      if (!approval) {
        toast.error('No pending approval found for this invite');
        return;
      }

      openApprovalReview(approval);
    } catch {
      toast.error('Failed to load onboarding approval');
    }
  };

  const handleApprove = async (e) => {
    e.preventDefault();

    // ── Validation ──
    if (!approveForm.manager || !approveForm.location || !approveForm.code) {
        toast.error("Please fill in all required information");
        return;
    }

    if (!isEmployeeCode(approveForm.code)) {
        toast.error("Employee code must be 3-20 letters, numbers, hyphens, or underscores");
        return;
    }

    if (!approveForm.doj) {
        toast.error("Date of joining is required");
        return;
    }

    if (isFutureDate(approveForm.doj)) {
        toast.error("Date of joining cannot be in the future");
        return;
    }

    setSubmitting(true);
    try {
        const formData = new FormData();
        formData.append('new_employee_code', approveForm.code);
        formData.append('doj', approveForm.doj);
        formData.append('reporting_manager', approveForm.manager);
        formData.append('employment_type', approveForm.type);
        formData.append('pf_included', approveForm.pf);
        formData.append('mediclaim_included', approveForm.mediclaim);
        formData.append('location', approveForm.location);
        formData.append('notes', approveForm.notes || '');

        const res = await fetch(`/api/onboarding/approve/${selectedApproval.employee_code}`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Activation failed');
        toast.success("Personnel Active in Matrix");
        setSelectedApproval(null);
        loadApprovals();
    } catch (e) {
        toast.error(e.message);
    } finally {
        setSubmitting(false);
    }
  };

  const inviteStatusStyle = {
    'Pending': 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
    'Completed': 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
    'Expired': 'bg-red-500/10 text-red-500 border border-red-500/20',
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-8">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.4em] mb-2 ${isLightMode ? 'text-[#8b5cf6]' : 'text-primary'}`}>Onboarding Management</p>
          <h2 className={`text-3xl font-display font-black uppercase tracking-tighter italic ${isLightMode ? 'text-black' : 'text-white'}`}>Onboarding Hub</h2>
        </div>
        
        <div className={`flex gap-2 p-1.5 rounded-2xl border ${isLightMode ? 'bg-[#f5efff] border-[#ece2ff]' : 'bg-white/5 border-white/5'}`}>
            <button 
              onClick={() => setActiveTab('invites')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'invites' 
                  ? (isLightMode ? 'bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white shadow-md' : 'bg-primary text-black shadow-lg shadow-primary/20') 
                  : (isLightMode ? 'text-[#6b7280] hover:text-black' : 'text-white/40 hover:text-white')
              }`}
            >
               Outbound Invites
            </button>
            <button 
              onClick={() => setActiveTab('approvals')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                activeTab === 'approvals' 
                  ? (isLightMode ? 'bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white shadow-md' : 'bg-primary text-black shadow-lg shadow-primary/20') 
                  : (isLightMode ? 'text-[#6b7280] hover:text-black' : 'text-white/40 hover:text-white')
              }`}
            >
               Pending Approvals
               {approvals.length > 0 && (
                 <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-error text-[8px] font-black text-white animate-pulse">
                   {approvals.length}
                 </span>
               )}
            </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
            <div className={`w-12 h-12 border-3 border-t-transparent rounded-full animate-spin mb-4 ${isLightMode ? 'border-[#8b5cf6]' : 'border-primary'}`} />
            <p className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b5cf6]' : 'text-primary'}`}>Synchronizing Persistence Layer...</p>
        </div>
      ) : activeTab === 'invites' ? (
        <div className="space-y-6 animate-fade-in-up">
           {/* Invites Toolbar */}
           <div className={`flex justify-between items-center p-6 rounded-[2rem] border ${
             isLightMode 
               ? 'bg-white border-[#ebe4ff] shadow-[0_10px_40px_rgba(180,140,255,0.06)]' 
               : 'bg-white/5 border-white/5 shadow-2xl'
           }`}>
              <div className="flex gap-8 px-4">
                 {[
                   { label: 'Sent', val: invites.length, color: isLightMode ? 'text-[#8b5cf6]' : 'text-primary' },
                   { label: 'Pending', val: invites.filter(i => i.status === 'Pending').length, color: 'text-amber-500' },
                   { label: 'Completed', val: invites.filter(i => i.status === 'Completed').length, color: 'text-emerald-500' }
                 ].map((s, i) => (
                   <div key={i}>
                      <p className={`text-xl font-display font-black ${s.color}`}>{s.val}</p>
                      <p className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b8ba3]' : 'text-white/30'}`}>{s.label}</p>
                   </div>
                 ))}
              </div>
              <button 
                onClick={() => setShowForm(true)}
                className={`flex items-center gap-3 px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all ${
                  isLightMode 
                    ? 'bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white shadow-[0_10px_30px_rgba(139,92,246,0.15)] hover:opacity-95' 
                    : 'bg-primary text-black hover:bg-white'
                }`}
              >
                <Plus size={16} /> Deploy New Invite
              </button>
           </div>

           <div className={`overflow-hidden rounded-[2rem] border ${
             isLightMode 
               ? 'bg-white border-[#ebe4ff] shadow-[0_10px_40px_rgba(180,140,255,0.06)]' 
               : 'glass-panel border-white/5'
           }`}>
             <table className="w-full text-left">
               <thead className={`border-b ${isLightMode ? 'bg-[#faf7ff] border-[#f1ebff]' : 'bg-white/5 border-white/10'}`}>
                 <tr>
                   {['Identity', 'Designation', 'Access Role', 'Current Status', 'Initiated', 'Action'].map(h => (
                     <th key={h} className={`px-6 py-5 text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b8ba3]' : 'text-white/30'}`}>{h}</th>
                   ))}
                 </tr>
               </thead>
               <tbody className={`divide-y ${isLightMode ? 'divide-[#f1ebff]' : 'divide-white/5'}`}>
                 {invites.length === 0 ? (
                   <tr>
                     <td colSpan={6} className={`px-6 py-20 text-center text-[10px] uppercase font-black tracking-widest ${isLightMode ? 'text-[#b6b6c7]' : 'text-white/20'}`}>
                       No active invite sequences in current sector
                     </td>
                   </tr>
                 ) : invites.map((inv, i) => (
                   <tr key={inv.id || i} className={`transition-colors group ${isLightMode ? 'hover:bg-[#faf7ff]' : 'hover:bg-white/[0.02]'}`}>
                     <td className="px-6 py-4">
                        <p className={`text-sm font-bold ${isLightMode ? 'text-black' : 'text-white'}`}>{inv.name}</p>
                        <p className={`text-[10px] font-mono mt-1 ${isLightMode ? 'text-[#6b7280]' : 'text-white/40'}`}>{inv.email}</p>
                     </td>
                     <td className="px-6 py-4">
                        <p className={`text-xs font-medium ${isLightMode ? 'text-black/80' : 'text-white/70'}`}>{inv.designation || 'N/A'}</p>
                        <p className={`text-[9px] uppercase tracking-widest ${isLightMode ? 'text-[#8b8ba3]' : 'text-white/30'}`}>{inv.department || 'General'}</p>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b5cf6]' : 'text-primary'}`}>{inv.role}</span>
                     </td>
                     <td className="px-6 py-4">
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${inviteStatusStyle[inv.status] || 'bg-white/5 text-white/30'}`}>
                          {inv.status}
                        </span>
                     </td>
                     <td className={`px-6 py-4 text-[10px] font-mono ${isLightMode ? 'text-[#6b7280]' : 'text-white/20'}`}>
                        {new Date(inv.created_at).toLocaleDateString()}
                     </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          {inv.status === 'Completed' && (
                            <button
                              onClick={() => manageCompletedInvite(inv)}
                              className={`px-4 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                                isLightMode
                                  ? 'text-[#6b7280] bg-[#faf7ff] border-[#ebe4ff] hover:bg-[#f3e8ff] hover:text-[#8b5cf6]'
                                  : 'text-white/40 bg-white/5 border-white/5 hover:text-primary hover:bg-white/10'
                              }`}
                            >
                              Manage
                            </button>
                          )}
                          {inv.status === 'Pending' && (
                            <>
                            <button 
                              onClick={() => copyInviteLink(inv.token)} 
                              title="Copy Invite Link"
                              className={`p-2 rounded-lg border transition-all ${
                                isLightMode 
                                  ? 'text-[#6b7280] bg-[#faf7ff] border-[#ebe4ff] hover:bg-[#f3e8ff] hover:text-[#8b5cf6]' 
                                  : 'text-white/40 bg-white/5 border-white/5 hover:text-primary hover:bg-white/10'
                              }`}
                            >
                               <Link size={14} />
                            </button>
                            <button 
                              onClick={() => revokeInvite(inv.id)} 
                              title="Revoke Invite"
                              className={`p-2 rounded-lg border transition-all ${
                                isLightMode 
                                  ? 'text-[#6b7280] bg-[#faf7ff] border-[#ebe4ff] hover:bg-red-50 hover:text-red-500 hover:border-red-100' 
                                  : 'text-white/40 bg-white/5 border-white/5 hover:text-error hover:bg-white/10'
                              }`}
                            >
                               <Ban size={14} />
                            </button>
                            </>
                          )}
                          {inv.status === 'Revoked' && (
                            <button 
                              onClick={() => hardDeleteInvite(inv.id)} 
                              title="Delete Log"
                              className={`p-2 rounded-lg border transition-all ${
                                isLightMode 
                                  ? 'text-[#6b7280] bg-[#faf7ff] border-[#ebe4ff] hover:bg-red-50 hover:text-red-500 hover:border-red-100' 
                                  : 'text-white/40 bg-white/5 border-white/5 hover:text-error hover:bg-white/10'
                              }`}
                            >
                               <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      ) : (
        /* Approvals Tab */
        <div className="space-y-6 animate-fade-in-up">
           <div className={`overflow-hidden rounded-[2rem] border ${
             isLightMode 
               ? 'bg-white border-[#ebe4ff] shadow-[0_10px_40px_rgba(180,140,255,0.06)]' 
               : 'glass-panel border-white/5'
           }`}>
             <table className="w-full text-left">
               <thead className={`border-b ${isLightMode ? 'bg-[#faf7ff] border-[#f1ebff]' : 'bg-white/5 border-white/10'}`}>
                 <tr>
                   {['Candidate', 'Role', 'Invite Code', 'Status', 'Action'].map(h => (
                     <th key={h} className={`px-6 py-5 text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b8ba3]' : 'text-white/30'}`}>{h}</th>
                   ))}
                 </tr>
               </thead>
               <tbody className={`divide-y ${isLightMode ? 'divide-[#f1ebff]' : 'divide-white/5'}`}>
                 {approvals.length === 0 ? (
                   <tr>
                     <td colSpan={5} className={`px-6 py-20 text-center text-[10px] uppercase font-black tracking-widest ${isLightMode ? 'text-[#b6b6c7]' : 'text-white/20'}`}>
                       Global personnel pipeline is clear
                     </td>
                   </tr>
                 ) : approvals.map((app, i) => (
                   <tr key={app.employee_code || i} className={`transition-colors group ${isLightMode ? 'hover:bg-[#faf7ff]' : 'hover:bg-white/[0.02]'}`}>
                     <td className="px-6 py-6">
                        <div className="flex items-center gap-4">
                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-display font-black text-lg overflow-hidden shrink-0 ${
                             isLightMode 
                               ? 'bg-[#f3e8ff] text-[#8b5cf6] border border-[#ebe4ff]' 
                               : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                           }`}>
                              {app.photo_path ? (
                                  <img src={app.photo_path.startsWith('http') ? app.photo_path : `/${app.photo_path.replace(/^\//, '')}`} className="w-full h-full object-cover" alt="" />
                              ) : (
                                  app.name?.[0] || '?'
                              )}
                           </div>
                           <div>
                              <p className={`text-sm font-bold ${isLightMode ? 'text-black' : 'text-white'}`}>{app.name}</p>
                              <p className={`text-[10px] font-mono mt-1 ${isLightMode ? 'text-[#6b7280]' : 'text-white/40'}`}>{app.email_id}</p>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-6">
                        <p className={`text-xs font-medium ${isLightMode ? 'text-black/80' : 'text-white/70'}`}>{app.designation}</p>
                        <p className={`text-[9px] uppercase tracking-widest ${isLightMode ? 'text-[#8b8ba3]' : 'text-white/30'}`}>{app.team}</p>
                     </td>
                     <td className="px-6 py-6">
                        <span className={`text-[10px] font-black uppercase font-mono tracking-widest ${isLightMode ? 'text-[#8b5cf6]' : 'text-primary'}`}>{app.employee_code}</span>
                     </td>
                     <td className="px-6 py-6">
                        <div className="flex flex-col gap-1.5">
                            <span className="flex items-center gap-2 text-[9px] font-black uppercase text-emerald-500"><BadgeCheck size={10} /> Identity Verified</span>
                            <span className="flex items-center gap-2 text-[9px] font-black uppercase text-amber-500"><Clock size={10} /> Awaiting Sync</span>
                        </div>
                     </td>
                     <td className="px-6 py-6 text-right">
                        <button 
                          onClick={() => openApprovalReview(app)}
                          className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group ${
                            isLightMode 
                              ? 'bg-[#faf7ff] border border-[#ebe4ff] text-[#6b7280] hover:bg-gradient-to-r hover:from-[#c084fc] hover:to-[#8b5cf6] hover:text-white' 
                              : 'bg-white/5 text-white hover:bg-primary hover:text-black'
                          }`}
                        >
                          Review Matrix <ChevronRight size={14} className="inline ml-1 group-hover:translate-x-1 transition-transform" />
                        </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      )}

      {/* Invite Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className={`p-10 w-full max-w-md space-y-6 scale-in-center rounded-[2.5rem] border ${
            isLightMode 
              ? 'bg-white border-[#ebe4ff] shadow-[0_20px_50px_rgba(180,140,255,0.15)] animate-fade-in' 
              : 'glass-panel border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.9)]'
          }`}>
            <div className="flex items-center gap-4 mb-2">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isLightMode ? 'bg-[#f3e8ff] text-[#8b5cf6]' : 'bg-primary/10 text-primary'
              }`}><UserPlus size={24} /></div>
              <h3 className={`text-lg font-black uppercase tracking-tighter ${isLightMode ? 'text-black' : 'text-white'}`}>Outbound Sequence</h3>
            </div>
            
            <div className="space-y-4">
               <div className="space-y-1.5">
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${isLightMode ? 'text-[#8b5cf6]' : 'text-white/30'}`}>Name</label>
                  <input 
                    value={form.name} 
                    onChange={e => setForm({...form, name: e.target.value})} 
                    className={`w-full text-xs px-5 py-4 rounded-xl outline-none transition-all ${
                      isLightMode 
                        ? 'bg-[#faf7ff] border border-[#ebe4ff] text-black focus:border-[#c084fc]' 
                        : 'glass-panel border border-white/5 text-white bg-black/20 focus:border-primary/40'
                    }`} 
                    placeholder="Full name..." 
                  />
               </div>
               <div className="space-y-1.5">
                  <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${isLightMode ? 'text-[#8b5cf6]' : 'text-white/30'}`}>Email</label>
                  <input 
                    type="email"
                    value={form.email} 
                    onChange={e => setForm({...form, email: e.target.value})} 
                    className={`w-full text-xs px-5 py-4 rounded-xl outline-none transition-all ${
                      isLightMode 
                        ? 'bg-[#faf7ff] border border-[#ebe4ff] text-black focus:border-[#c084fc]' 
                        : 'glass-panel border border-white/5 text-white bg-black/20 focus:border-primary/40'
                    }`} 
                    placeholder="Email address..." 
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 flex-1">
                    <ComboBox 
                      label="Designation"
                      options={dynDesignations.length > 0 ? dynDesignations : DESIGNATIONS}
                      value={form.designation}
                      onChange={val => setForm({...form, designation: val})}
                      placeholder="Select Designation..."
                    />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <ComboBox 
                      label="Department"
                      options={dynDepartments.length > 0 ? dynDepartments : DEPARTMENTS}
                      value={form.department}
                      onChange={val => setForm({...form, department: val})}
                      placeholder="Select Department..."
                    />
                  </div>
               </div>
              <div className="space-y-1.5">
                 <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${isLightMode ? 'text-[#8b5cf6]' : 'text-white/30'}`}>Access Role</label>
                  <select 
                    value={form.role}
                    onChange={e => setForm({...form, role: e.target.value})}
                    className={`w-full text-xs px-5 py-4 rounded-xl outline-none transition-all ${
                      isLightMode 
                        ? 'bg-[#faf7ff] border border-[#ebe4ff] text-black focus:border-[#c084fc]' 
                        : 'glass-panel border border-white/5 text-white bg-black/20 focus:border-primary/40'
                    }`}
                  >
                    {[
                      { id: 'org_admin', label: 'Org Admin (L2)' },
                      { id: 'manager', label: 'Manager (L3)' },
                      { id: 'employee', label: 'Employee (L4)' }
                    ].map(r => (
                      <option key={r.id} value={r.id} className={isLightMode ? 'text-black bg-white' : 'text-white bg-[#080f1f]'}>{r.label}</option>
                    ))}
                  </select>
              </div>
            </div>

            <div className="flex gap-4 pt-6">
              <button 
                onClick={() => setShowForm(false)}
                className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  isLightMode 
                    ? 'border border-[#ebe4ff] text-[#6b7280] hover:bg-[#faf7ff] hover:text-black' 
                    : 'border border-white/10 text-white/40 hover:text-white'
                }`}
              >
                Abort
              </button>
              <button 
                onClick={sendInvite} disabled={submitting}
                className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-[0.98] transition-all ${
                  isLightMode 
                    ? 'bg-gradient-to-r from-[#c084fc] to-[#8b5cf6] text-white shadow-lg' 
                    : 'bg-primary text-black shadow-xl shadow-primary/20'
                }`}
              >
                {submitting ? 'Transmitting...' : 'Initiate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval & Review Drawer (The "Detail View") */}
      {selectedApproval && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm">
           <div className={`w-full max-w-3xl h-full border-l animate-slide-in-right overflow-y-auto pr-2 custom-scrollbar ${
             isLightMode ? 'bg-white border-[#ebe4ff]' : 'glass-panel border-white/10'
           }`}>
              <div className="p-10 space-y-10">
                 {/* Header */}
                 <div className="flex justify-between items-start">
                    <div className="flex gap-6 items-center">
                        <div className={`w-20 h-20 rounded-3xl flex items-center justify-center font-display font-black text-3xl overflow-hidden shrink-0 ${
                          isLightMode 
                            ? 'bg-[#f3e8ff] text-[#8b5cf6] border border-[#ebe4ff]' 
                            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        }`}>
                           {selectedApproval.photo_path ? (
                               <img src={selectedApproval.photo_path.startsWith('http') ? selectedApproval.photo_path : `/${selectedApproval.photo_path.replace(/^\//, '')}`} className="w-full h-full object-cover" alt="" />
                           ) : (
                               selectedApproval.name?.[0]
                           )}
                        </div>
                        <div>
                           <div className="flex items-center gap-3">
                              <h2 className={`text-3xl font-display font-black uppercase tracking-tighter italic ${isLightMode ? 'text-black' : 'text-white'}`}>{selectedApproval.name}</h2>
                              <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[8px] font-black uppercase tracking-widest border border-emerald-500/20">Pending Invite</span>
                           </div>
                           <p className={`font-black text-xs uppercase tracking-[0.3em] mt-2 italic ${isLightMode ? 'text-[#8b5cf6]' : 'text-primary'}`}>{selectedApproval.designation} // {selectedApproval.team}</p>
                        </div>
                    </div>
                    <button 
                      onClick={() => setSelectedApproval(null)} 
                      className={`p-3 rounded-2xl transition-all ${
                        isLightMode 
                          ? 'bg-[#faf7ff] border border-[#ebe4ff] text-[#6b7280] hover:bg-red-50 hover:text-red-500' 
                          : 'bg-white/5 text-white/30 hover:text-error hover:bg-error/10'
                      }`}
                    >
                      Abort Review
                    </button>
                 </div>

                 {/* Information Grid */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Basic Section */}
                    <div className="space-y-6">
                        <SectionHeader icon={FileText} label="Personal Vectors" />
                        <div className={`space-y-4 p-6 rounded-3xl border ${isLightMode ? 'bg-[#faf7ff] border-[#ebe4ff]' : 'bg-white/5 border-white/5'}`}>
                            <InfoCard label="Email Access" value={selectedApproval.email_id} icon={Mail} />
                            <InfoCard label="Contact Frequency" value={selectedApproval.contact_number} icon={Phone} />
                            <InfoCard label="Temporal Origin" value={selectedApproval.dob} icon={Clock} />
                            <InfoCard label="Emergency Contact" value={selectedApproval.emergency_contact} icon={ShieldAlert} />
                        </div>

                        <SectionHeader icon={Briefcase} label="Skills & Experience" />
                        <div className={`space-y-4 p-6 rounded-3xl border ${isLightMode ? 'bg-[#faf7ff] border-[#ebe4ff]' : 'bg-white/5 border-white/5'}`}>
                            <div className="space-y-1">
                                <p className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b5cf6]' : 'text-primary'}`}>Primary Skill Assets</p>
                                <p className={`text-xs leading-relaxed font-medium ${isLightMode ? 'text-black/80' : 'text-white/80'}`}>{selectedApproval.primary_skillset || 'No telemetry detected'}</p>
                            </div>
                            <div className="space-y-1 mt-4">
                                <p className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b8ba3]' : 'text-white/30'}`}>Secondary Capabilities</p>
                                <p className={`text-xs leading-relaxed ${isLightMode ? 'text-[#6b7280]' : 'text-white/50'}`}>{selectedApproval.secondary_skillset || 'None'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Geography & Education */}
                    <div className="space-y-6">
                        <SectionHeader icon={MapPin} label="Geographic Anchors" />
                        <div className={`space-y-4 p-6 rounded-3xl border ${isLightMode ? 'bg-[#faf7ff] border-[#ebe4ff]' : 'bg-white/5 border-white/5'}`}>
                            <div className="space-y-1">
                                <p className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b8ba3]' : 'text-white/30'}`}>Current Base</p>
                                <p className={`text-xs leading-relaxed ${isLightMode ? 'text-black/80' : 'text-white/70'}`}>{selectedApproval.current_address}</p>
                            </div>
                            <div className="space-y-1 mt-4">
                                <p className={`text-[9px] font-black uppercase tracking-widest ${isLightMode ? 'text-[#8b8ba3]' : 'text-white/30'}`}>Permanent Point</p>
                                <p className={`text-xs leading-relaxed ${isLightMode ? 'text-black/80' : 'text-white/70'}`}>{selectedApproval.permanent_address}</p>
                            </div>
                        </div>

                        <SectionHeader icon={GraduationCap} label="Academic History Blocks" />
                        <div className={`space-y-3 p-6 rounded-3xl border ${isLightMode ? 'bg-[#faf7ff] border-[#ebe4ff]' : 'bg-white/5 border-white/5'}`}>
                            {(() => {
                                let edu = selectedApproval.education_details;
                                try {
                                    if (typeof edu === 'string') edu = JSON.parse(edu);
                                } catch { 
                                    return <p className={`text-xs italic ${isLightMode ? 'text-[#6b7280]' : 'text-white/50'}`}>Invalid data format.</p>;
                                }
                                
                                if (Array.isArray(edu) && edu.length > 0) {
                                    return edu.map((e, idx) => (
                                        <div key={idx} className={`pb-3 mb-3 border-b last:border-0 last:pb-0 last:mb-0 ${isLightMode ? 'border-[#ebe4ff]' : 'border-white/5'}`}>
                                            <p className={`text-xs font-black uppercase ${isLightMode ? 'text-black' : 'text-white'}`}>{e.degree}</p>
                                            <p className={`text-[10px] mt-1 uppercase tracking-widest italic ${isLightMode ? 'text-[#6b7280]' : 'text-white/40'}`}>{e.university} ({e.year})</p>
                                            {e.percentage && <p className={`text-[10px] mt-1 font-black ${isLightMode ? 'text-[#8b5cf6]' : 'text-primary'}`}>Scoring: {e.percentage}</p>}
                                        </div>
                                    ));
                                }
                                return <p className={`text-xs italic ${isLightMode ? 'text-[#6b7280]' : 'text-white/50'}`}>No academic history detected.</p>;
                            })()}
                        </div>
                    </div>
                 </div>

                 {/* Document Review */}
                 <div className="space-y-6">
                    <SectionHeader icon={Eye} label="Identity Artifacts" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                           { label: 'Resume (CV)', path: selectedApproval.cv_path },
                           { label: 'Identity Visual', path: selectedApproval.photo_path },
                           { label: 'Official Credential', path: selectedApproval.id_proofs }
                        ].map((d, i) => (
                           <div key={i} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all cursor-pointer ${
                             isLightMode ? 'bg-[#faf7ff] border-[#ebe4ff] hover:bg-[#f3e8ff]' : 'bg-white/5 border-white/5 hover:bg-white/10'
                           }`}>
                              <div className="flex items-center gap-3">
                                 <FileText size={16} className={isLightMode ? 'text-[#8b5cf6]' : 'text-primary'} />
                                 <p className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-black/60' : 'text-white/40'}`}>{d.label}</p>
                              </div>
                               {d.path ? (
                                 <a 
                                   href={d.path.startsWith('http') ? d.path : `/${d.path.replace(/^\//, '')}`} 
                                   target="_blank" 
                                   rel="noreferrer" 
                                   className={`p-2 rounded-lg transition-colors border ${
                                     isLightMode 
                                       ? 'text-[#8b5cf6] bg-white border-[#ebe4ff] hover:bg-[#faf7ff]' 
                                       : 'text-primary bg-white/5 hover:text-white border-transparent'
                                   }`}
                                 >
                                   <ExternalLink size={14}/>
                                 </a>
                               ) : (
                                 <span className="text-error/50 text-[8px] font-black uppercase">Missing</span>
                               )}
                           </div>
                        ))}
                    </div>
                 </div>

                 {/* Approval Form */}
                 <div className={`mt-12 p-10 rounded-[40px] space-y-8 shadow-2xl ${
                   isLightMode 
                     ? 'bg-[#f0fdf4] border border-[#bbf7d0] shadow-emerald-500/5' 
                     : 'bg-emerald-500/5 border border-emerald-500/10 shadow-emerald-500/5'
                 }`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
                          isLightMode ? 'bg-emerald-200 text-emerald-700' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                           <ShieldAlert size={24} />
                        </div>
                        <div>
                           <h3 className={`text-xl font-display font-black uppercase tracking-tighter ${isLightMode ? 'text-emerald-900' : 'text-white'}`}>Initiate Activation Protocol</h3>
                           <p className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-emerald-700' : 'text-emerald-400'}`}>Fill in employee information to complete setup</p>
                        </div>
                    </div>

                    <form onSubmit={handleApprove} className="space-y-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <ComboBox 
                                label="Reporting Manager"
                                options={managers.map(m => ({ id: m.code, name: `${m.name} (${m.role})` }))}
                                value={approveForm.manager}
                                onChange={val => setApproveForm({...approveForm, manager: val})}
                                placeholder="Select or type manager name..."
                              />
                           </div>
                           <div className="space-y-2">
                              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${isLightMode ? 'text-emerald-800' : 'text-white/30'}`}>Neural Employment Type</label>
                              <select 
                                value={approveForm.type}
                                onChange={e => setApproveForm({...approveForm, type: e.target.value})}
                                className={`w-full px-5 py-4 rounded-2xl text-xs outline-none transition-all ${
                                  isLightMode 
                                    ? 'bg-white border border-[#bbf7d0] text-black focus:border-emerald-500' 
                                    : 'glass-panel border border-white/10 bg-black/40 text-white focus:border-emerald-500/40'
                                }`}
                              >
                                 <option value="Full Time" className={isLightMode ? 'text-black bg-white' : 'text-white bg-[#080f1f]'}>Full Time</option>
                                 <option value="Contract" className={isLightMode ? 'text-black bg-white' : 'text-white bg-[#080f1f]'}>Contract</option>
                                 <option value="Internship" className={isLightMode ? 'text-black bg-white' : 'text-white bg-[#080f1f]'}>Internship</option>
                              </select>
                           </div>
                       </div>
                       
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           {['pf', 'mediclaim'].map(k => (
                             <div key={k} className="space-y-2">
                                <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${isLightMode ? 'text-emerald-800' : 'text-white/30'}`}>{k.toUpperCase()} Enrollment</label>
                                <select 
                                  value={approveForm[k]}
                                  onChange={e => setApproveForm({...approveForm, [k]: e.target.value})}
                                  className={`w-full px-5 py-4 rounded-2xl text-xs outline-none transition-all ${
                                    isLightMode 
                                      ? 'bg-white border border-[#bbf7d0] text-black focus:border-emerald-500' 
                                      : 'glass-panel border border-white/10 bg-black/40 text-white focus:border-emerald-500/40'
                                  }`}
                                >
                                   <option value="No" className={isLightMode ? 'text-black bg-white' : 'text-white bg-[#080f1f]'}>No</option>
                                   <option value="Yes" className={isLightMode ? 'text-black bg-white' : 'text-white bg-[#080f1f]'}>Yes</option>
                                </select>
                             </div>
                           ))}
                           <div className="space-y-2">
                              <ComboBox 
                                label="Location of Work"
                                options={locations.length > 0 ? locations : ['Remote', 'On-Site', 'Hybrid']}
                                value={approveForm.location}
                                onChange={val => setApproveForm({...approveForm, location: val})}
                                placeholder="Choose location..."
                              />
                           </div>
                           <div className="space-y-2 col-span-1 md:col-span-2">
                              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${isLightMode ? 'text-emerald-800' : 'text-white/30'}`}>Onboarding / Employee Code (Editable)</label>
                              <input 
                                value={approveForm.code}
                                onChange={e => setApproveForm({...approveForm, code: e.target.value})}
                                className={`w-full px-5 py-4 rounded-2xl text-xs outline-none font-mono transition-all uppercase ${
                                  isLightMode 
                                    ? 'bg-white border border-[#bbf7d0] text-[#8b5cf6] font-black focus:border-[#8b5cf6]' 
                                    : 'glass-panel border border-white/10 bg-black/40 text-primary font-black focus:border-primary/40'
                                }`}
                              />
                              <p className={`text-[8px] font-bold uppercase tracking-widest ml-1 ${isLightMode ? 'text-emerald-600' : 'text-white/30'}`}>Format: 3-20 letters, numbers, hyphens, or underscores</p>
                           </div>
                           <div className="space-y-2">
                              <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${isLightMode ? 'text-emerald-800' : 'text-white/30'}`}>Official Date of Joining (DOJ)</label>
                              <input 
                                type="date"
                                value={approveForm.doj}
                                onChange={e => setApproveForm({...approveForm, doj: e.target.value})}
                                className={`w-full px-5 py-4 rounded-2xl text-xs outline-none transition-all ${
                                  isLightMode 
                                    ? 'bg-white border border-[#bbf7d0] text-black focus:border-emerald-500' 
                                    : 'glass-panel border border-white/10 bg-black/40 text-white focus:border-emerald-500/40'
                                }`}
                              />
                              <p className={`text-[8px] font-bold uppercase tracking-widest ml-1 ${isLightMode ? 'text-emerald-600' : 'text-white/30'}`}>Cannot be in the future</p>
                           </div>
                       </div>

                       <div className="space-y-2">
                           <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${isLightMode ? 'text-emerald-800' : 'text-white/30'}`}>Internal Clearance Notes</label>
                           <textarea 
                             rows="3"
                             value={approveForm.notes}
                             onChange={e => setApproveForm({...approveForm, notes: e.target.value})}
                             placeholder="Neural profile performance notes..."
                             className={`w-full px-5 py-4 rounded-2xl text-xs outline-none resize-none transition-all ${
                               isLightMode 
                                 ? 'bg-white border border-[#bbf7d0] text-black focus:border-emerald-500' 
                                 : 'glass-panel border border-white/10 bg-black/40 text-white focus:border-emerald-500/40'
                             }`}
                           />
                       </div>

                       <div className="flex gap-4 pt-4">
                          <button 
                            type="button"
                            onClick={() => setSelectedApproval(null)}
                            className={`flex-1 py-5 rounded-3xl text-[10px] font-black uppercase tracking-widest transition-all ${
                              isLightMode 
                                ? 'border border-[#bbf7d0] text-emerald-800 hover:bg-white' 
                                : 'border border-white/10 text-white/30 hover:text-white'
                            }`}
                          >
                            Defer Approval
                          </button>
                          <button 
                            type="submit" disabled={submitting}
                            className={`flex-1 py-5 rounded-3xl font-black text-[12px] uppercase tracking-[0.2em] transition-all ${
                              isLightMode 
                                ? 'bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 shadow-emerald-600/10' 
                                : 'bg-emerald-500 text-black shadow-2xl shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                          >
                            {submitting ? 'Activating Matrix...' : 'Activate Personnel'}
                          </button>
                       </div>
                    </form>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon: Icon, label }) {
    const isLightMode = window.location.pathname.startsWith('/deploy');
    return (
        <div className={`flex items-center gap-3 border-b pb-4 mb-4 ${isLightMode ? 'border-[#f1ebff]' : 'border-white/5'}`}>
            <Icon size={16} className={isLightMode ? 'text-[#8b5cf6]' : 'text-primary'} />
            <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${isLightMode ? 'text-black' : 'text-white'}`}>{label}</span>
        </div>
    );
}

function InfoCard({ label, value, icon: Icon }) {
    const isLightMode = window.location.pathname.startsWith('/deploy');
    return (
        <div className="flex items-start gap-4">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              isLightMode ? 'bg-[#f3e8ff] text-[#8b5cf6]' : 'bg-white/5 text-white/20'
            }`}><Icon size={12}/></div>
            <div>
                <p className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${
                  isLightMode ? 'text-[#8b5cf6]' : 'text-white/30'
                }`}>{label}</p>
                <p className={`text-xs font-medium ${isLightMode ? 'text-black' : 'text-white/90'}`}>{value || '—'}</p>
            </div>
        </div>
    );
}