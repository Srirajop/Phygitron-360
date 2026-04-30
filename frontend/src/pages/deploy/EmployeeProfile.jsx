import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { deployApi, adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  User, Briefcase, MapPin, Mail, Calendar, Award, 
  ChevronRight, BarChart2, BookOpen, Download, FileText, ExternalLink,
  ArrowLeft, CheckCircle, AlertTriangle, Hash, Edit2, UserCheck, TrendingUp,
  Plus, X, Save, Brain, Phone, ShieldCheck, GraduationCap, Upload, Eye, CreditCard, DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const LEVEL_CONFIG = {
  beginner:     { badge: 'badge-muted',    bar: '#9CA3AF', pct: 25 },
  intermediate: { badge: 'badge-info',     bar: '#3B82F6', pct: 50 },
  advanced:     { badge: 'badge-primary',  bar: '#8B5CF6', pct: 75 },
  expert:       { badge: 'badge-success',  bar: '#10B981', pct: 100 },
};

const STATUS_CONFIG = {
  active:     { badge: 'badge-success', label: 'Active',     dot: '#10B981' },
  on_leave:   { badge: 'badge-warning', label: 'On Leave',   dot: '#F59E0B' },
  deployed:   { badge: 'badge-info',    label: 'Deployed',   dot: '#3B82F6' },
  notice_period: { badge: 'badge-warning', label: 'Notice Period', dot: '#F59E0B' },
  exited:     { badge: 'badge-danger',  label: 'Exited',     dot: '#F43F5E' },
  offboarded: { badge: 'badge-muted',   label: 'Offboarded', dot: '#9CA3AF' },
};

function Avatar({ src, name, size = 72 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: src ? `url(${API_BASE}/${src})` : 'linear-gradient(135deg, var(--primary), var(--primary-light))',
      backgroundSize: 'cover', backgroundPosition: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 900, fontSize: size > 50 ? '1.5rem' : '1rem',
      boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
      border: '3px solid white', overflow: 'hidden'
    }}>
      {!src && initials}
    </div>
  );
}

function SectionCard({ title, icon, children, action, fullBody = false }) {
  return (
    <div className="card animate-fade-in" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--primary-lightest)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
          }}>{icon}</div>
          <h4 style={{ margin: 0 }}>{title}</h4>
        </div>
        {action}
      </div>
      <div className={fullBody ? "" : "card-body"}>{children}</div>
    </div>
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkill, setNewSkill] = useState({ skill_id: '', level: 'beginner', verified_by: 'self_reported' });
  const [activeTab, setActiveTab] = useState('overview');

  const [payrollData, setPayrollData] = useState([]);
  const [loadingPayroll, setLoadingPayroll] = useState(false);
  const [issuePayrollOpen, setIssuePayrollOpen] = useState(false);
  const [payrollForm, setPayrollForm] = useState({ month_year: '', basic_salary: 0, hra: 0, other_allowances: 0, deductions_tax: 0, deductions_pf: 0 });

  const docInputRef = useRef(null);
  const [uploadingDoc, setUploadingDoc] = useState(null); // 'photo', 'cv', 'id'

  const canEdit = ['hr', 'org_admin'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deployApi.getEmployee(id);
      const d = res.data.data;
      setData(d);
      setSkills(d.skills || []);
      setEditForm({
        emp_id: d.emp_id || '',
        department: d.department || '',
        designation: d.designation || '',
        status: d.status || 'active',
        join_date: d.join_date || '',
        dob: d.dob || '',
        contact_number: d.contact_number || '',
        emergency_contact: d.emergency_contact || '',
        location: d.location || '',
        employment_type: d.employment_type || 'Full-time',
        pf_included: d.pf_included || false,
        mediclaim_included: d.mediclaim_included || false,
        current_address: d.current_address || '',
        permanent_address: d.permanent_address || '',
        education_details: d.education_details || [],
      });
    } catch {
      toast.error('Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    adminApi.listSkills('').then(r => setAllSkills(r.data.data || [])).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (activeTab === 'payroll') {
      setLoadingPayroll(true);
      deployApi.getPayrollList(id)
        .then(res => {
          const fetched = res.data.data;
          setPayrollData(Array.isArray(fetched) ? fetched : []);
        })
        .catch(() => toast.error('Failed to load payroll data'))
        .finally(() => setLoadingPayroll(false));
    }
  }, [activeTab, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await deployApi.updateEmployee(id, editForm);
      toast.success('Professional profile updated');
      setEditing(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const fd = new FormData();
    fd.append(uploadingDoc, file);
    
    const tid = toast.loading(`Uploading ${uploadingDoc}...`);
    try {
      await deployApi.uploadEmployeeDocuments(id, fd);
      toast.success(`${uploadingDoc} updated!`, { id: tid });
      load();
    } catch (err) {
      toast.error('Upload failed', { id: tid });
    } finally {
      setUploadingDoc(null);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.skill_id) { toast.error('Select a skill'); return; }
    try {
      await deployApi.addSkill(id, { ...newSkill, skill_id: parseInt(newSkill.skill_id) });
      toast.success('Skill added to matrix');
      setAddingSkill(false);
      setNewSkill({ skill_id: '', level: 'beginner', verified_by: 'self_reported' });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add skill');
    }
  };

  const handleIssueAsset = async (assetIdx) => {
    const newList = [...(data.asset_checklist || [])];
    newList[assetIdx] = { ...newList[assetIdx], issued: true, issued_date: new Date().toISOString().split('T')[0] };
    try {
      await deployApi.updateEmployee(id, { asset_checklist: newList });
      setData({ ...data, asset_checklist: newList });
      toast.success("Asset marked as issued");
    } catch (err) { toast.error("Update failed"); }
  };

  const handleReturnAsset = async (assetIdx) => {
    const newList = [...(data.asset_checklist || [])];
    newList[assetIdx] = { ...newList[assetIdx], returned: true, return_date: new Date().toISOString().split('T')[0] };
    try {
      await deployApi.updateEmployee(id, { asset_checklist: newList });
      setData({ ...data, asset_checklist: newList });
      toast.success("Asset marked as returned");
    } catch (err) { toast.error("Update failed"); }
  };

  const handleIssuePayroll = async () => {
    try {
      await deployApi.createPayroll(id, payrollForm);
      toast.success("Payslip issued successfully");
      setIssuePayrollOpen(false);
      setPayrollForm({ month_year: '', basic_salary: 0, hra: 0, other_allowances: 0, deductions_tax: 0, deductions_pf: 0 });
      // Reload payrolls
      setLoadingPayroll(true);
      deployApi.getPayrollList(id)
        .then(res => {
          const fetched = res.data.data;
          setPayrollData(Array.isArray(fetched) ? fetched : []);
        })
        .finally(() => setLoadingPayroll(false));
    } catch (err) {
      toast.error('Failed to issue payslip');
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return <div className="page-body"><p>Personnel record not found.</p></div>;

  const statusCfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.active;

  return (
    <div className="animate-fade-in">
      <input type="file" ref={docInputRef} style={{ display: 'none' }} onChange={handleDocUpload} />

      <div style={{ padding: '24px 32px 0' }}>
        <Link to="/deploy" className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>
          <ArrowLeft size={15} /> Employee Directory
        </Link>

        {/* Dynamic Profile Header */}
        <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'visible' }}>
          <div style={{
            height: 120, borderRadius: '24px 24px 0 0',
            background: 'linear-gradient(135deg, var(--primary) 0%, #6366F1 100%)',
            position: 'relative'
          }}>
             <div className="page-bg" style={{ position: 'absolute', opacity: 0.2, filter: 'none' }} />
          </div>

          <div className="card-body" style={{ paddingTop: 0, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: -40, flexWrap: 'wrap', gap: 20 }}>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                  <Avatar name={data.user?.full_name} src={data.photo_path} size={110} />
                  {canEdit && (
                    <button 
                      className="btn btn-primary" 
                      style={{ position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, padding: 0, borderRadius: '50%' }}
                      onClick={() => { setUploadingDoc('photo'); docInputRef.current.click(); }}
                    >
                      <Upload size={14} />
                    </button>
                  )}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                    <h1 style={{ margin: 0, fontSize: '1.85rem' }}>{data.user?.full_name}</h1>
                    <span className={`badge ${statusCfg.badge}`} style={{ verticalAlign: 'middle' }}>{statusCfg.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.88rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Briefcase size={14} /> {data.designation || 'Position Unset'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> {data.location || 'Global Hub'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={14} /> {data.user?.email}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {canEdit && data.status !== 'exited' && (
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-danger" onClick={() => {
                        const reason = window.prompt("Enter exit reason:");
                        const date = window.prompt("Enter exit date (YYYY-MM-DD):", new Date().toISOString().split('T')[0]);
                        if (reason && date) {
                           deployApi.offboardEmployee(id, { reason, exit_date: date })
                             .then(() => { toast.success("Employee offboarded"); load(); })
                             .catch(() => toast.error("Offboarding failed"));
                        }
                    }}>
                       <UserCheck size={15} /> Offboard
                    </button>
                    <button className={`btn ${editing ? 'btn-success' : 'btn-secondary'}`}
                      onClick={() => editing ? handleSave() : setEditing(true)}
                      disabled={saving}
                    >
                      {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : editing ? <><Save size={15} /> Save Changes</> : <><Edit2 size={15} /> Edit Profile</>}
                    </button>
                  </div>
                )}
                <div style={{ textAlign: 'center', background: 'var(--primary-lightest)', borderRadius: 16, padding: '10px 20px', border: '1px solid var(--primary-lighter)' }}>
                  <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{data.capability_index?.toFixed(0) || 0}%</div>
                  <div style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--primary)' }}>C-INDEX</div>
                </div>
              </div>
            </div>

            {/* Profile Tabs */}
            <div style={{ display: 'flex', gap: 32, marginTop: 32, borderBottom: '1px solid var(--border)' }}>
              {[
                { id: 'overview', label: '360 Overview', icon: <Eye size={16} /> },
                { id: 'identity', label: 'Identity & HR', icon: <User size={16} /> },
                { id: 'performance', label: 'Performance (KRA)', icon: <TrendingUp size={16} /> },
                { id: 'training', label: 'Training', icon: <BookOpen size={16} /> },
                { id: 'assets', label: 'Assets', icon: <ShieldCheck size={16} /> },
                { id: 'vault', label: 'Doc Vault', icon: <Hash size={16} /> },
                { id: 'payroll', label: 'Payroll & Salary', icon: <CreditCard size={16} /> }
              ].map(t => (
                <button 
                  key={t.id} 
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: '12px 4px', background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem', fontWeight: 700,
                    color: activeTab === t.id ? 'var(--primary)' : 'var(--text-muted)',
                    borderBottom: `2px solid ${activeTab === t.id ? 'var(--primary)' : 'transparent'}`,
                    transition: 'all 0.3s'
                  }}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 0 }}>
        {editing && (
          <div className="card animate-scale-in" style={{ marginBottom: 24, border: '2px solid var(--primary)' }}>
            <div className="card-header"><h4 style={{ margin: 0 }}>Global Edit: {data.user?.full_name}</h4></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                <div className="form-group"><label className="form-label">Employee ID</label><input className="form-control" value={editForm.emp_id} onChange={e => setEditForm(f => ({ ...f, emp_id: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Position / Designation</label><input className="form-control" value={editForm.designation} onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Department</label><input className="form-control" value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Location</label><input className="form-control" value={editForm.location} onChange={e => setEditForm(f => ({ ...f, location: e.target.value }))} /></div>
                <div className="form-group">
                  <label className="form-label">Employee Status</label>
                  <select className="form-control" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Employment Type</label>
                  <select className="form-control" value={editForm.employment_type} onChange={e => setEditForm(f => ({ ...f, employment_type: e.target.value }))}>
                    <option value="Full-time">Full-time</option>
                    <option value="Contract">Contract</option>
                    <option value="Intern">Intern</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Update Records'}</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: 24 }}>
            <div>
              {/* Skills Matrix */}
              <SectionCard title="Skill DNA" icon={<Brain size={15} />} action={canEdit && <button className="btn btn-secondary btn-sm" onClick={() => setAddingSkill(!addingSkill)}><Plus size={14} /> Add Skill</button>}>
                {addingSkill && (
                  <div className="animate-fade-in" style={{ padding: 16, background: 'var(--primary-lightest)', borderRadius: 12, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <select className="form-control" value={newSkill.skill_id} onChange={e => setNewSkill(s => ({ ...s, skill_id: e.target.value }))}>
                        <option value="">Select Skill…</option>
                        {allSkills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                      <select className="form-control" value={newSkill.level} onChange={e => setNewSkill(s => ({ ...s, level: e.target.value }))} style={{ width: 140 }}>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="expert">Expert</option>
                      </select>
                      <button className="btn btn-primary btn-sm" onClick={handleAddSkill}>Add</button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                  {skills.map((s, i) => {
                    const cfg = LEVEL_CONFIG[s.level] || LEVEL_CONFIG.beginner;
                    return (
                      <div key={i} className="card-body" style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                           <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.name}</span>
                           <span className={`badge ${cfg.badge}`} style={{ fontSize: '0.65rem' }}>{s.level}</span>
                        </div>
                        <div className="progress-bar" style={{ height: 4 }}><div className="progress-fill" style={{ width: `${cfg.pct}%`, background: cfg.bar }} /></div>
                      </div>
                    );
                  })}
                  {skills.length === 0 && <p style={{ gridColumn: 'span 2', textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>No skill data mapped</p>}
                </div>
              </SectionCard>

              {/* Learning Roadmap */}
              <SectionCard title="Growth Pathway" icon={<BookOpen size={15} />}>
                {(data.learning || []).length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No active learning modules</p> : (
                  data.learning.map((e, i) => (
                    <div key={i} style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Assessment/Course Progress</span>
                        <span style={{ fontWeight: 800 }}>{e.progress_percent}%</span>
                      </div>
                      <div className="progress-bar"><div className="progress-fill" style={{ width: `${e.progress_percent}%` }} /></div>
                    </div>
                  ))
                )}
              </SectionCard>
            </div>

            <div>
              {/* Personnel Stats */}
              <div className="card" style={{ marginBottom: 20, background: 'var(--primary-lightest)', border: '1px solid var(--primary-lighter)' }}>
                <div className="card-body">
                  <div style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 12 }}>Rapid Deployment Profile</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Active Deployments</span> <span style={{ fontWeight: 700 }}>{(data.deployments || []).filter(d => d.status==='active').length}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Certifications</span> <span style={{ fontWeight: 700 }}>{(data.certificates || []).length}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Years of Experience</span> <span style={{ fontWeight: 700 }}>{data.experience_years || '—'}</span></div>
                  </div>
                </div>
              </div>

              {/* Assessment Log */}
              <SectionCard title="Assessment Log" icon={<BarChart2 size={15} />}>
                 {(data.assessment_history || []).slice(0, 5).map((a, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{a.assessment_name || 'System Review'}</span>
                      <span style={{ color: a.pass_status ? 'var(--success)' : 'var(--danger)', fontWeight: 800 }}>{a.score?.toFixed(0)}%</span>
                    </div>
                 ))}
                 {(data.assessment_history || []).length === 0 && <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No history logged</p>}
              </SectionCard>
            </div>
          </div>
        )}

        {activeTab === 'identity' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
            <SectionCard title="Personal Dossier" icon={<User size={15} />}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <div><label className="form-label" style={{ fontSize: '0.7rem' }}>Date of Birth</label><div style={{ fontWeight: 600 }}>{data.dob ? new Date(data.dob).toLocaleDateString() : '—'}</div></div>
                 <div><label className="form-label" style={{ fontSize: '0.7rem' }}>Contact Number</label><div style={{ fontWeight: 600 }}>{data.contact_number || '—'}</div></div>
                 <div><label className="form-label" style={{ fontSize: '0.7rem' }}>Emergency Contact</label><div style={{ fontWeight: 600 }}>{data.emergency_contact || '—'}</div></div>
                 <div><label className="form-label" style={{ fontSize: '0.7rem' }}>Location</label><div style={{ fontWeight: 600 }}>{data.location || '—'}</div></div>
              </div>
            </SectionCard>

            <SectionCard title="Employment Details" icon={<Briefcase size={15} />}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <div><label className="form-label" style={{ fontSize: '0.7rem' }}>Department</label><div style={{ fontWeight: 600 }}>{data.department || '—'}</div></div>
                 <div><label className="form-label" style={{ fontSize: '0.7rem' }}>Date of Joining</label><div style={{ fontWeight: 600 }}>{data.join_date ? new Date(data.join_date).toLocaleDateString() : '—'}</div></div>
                 <div><label className="form-label" style={{ fontSize: '0.7rem' }}>Employment Type</label><div style={{ fontWeight: 600 }}>{data.employment_type || '—'}</div></div>
                 <div style={{ display: 'flex', gap: 20 }}>
                    <div><label className="form-label" style={{ fontSize: '0.7rem' }}>PF/Retirement</label><div style={{ color: data.pf_included ? 'var(--success)' : 'var(--text-muted)', fontWeight: 800 }}>{data.pf_included ? 'ENROLLED' : 'NO'}</div></div>
                    <div><label className="form-label" style={{ fontSize: '0.7rem' }}>Mediclaim</label><div style={{ color: data.mediclaim_included ? 'var(--success)' : 'var(--text-muted)', fontWeight: 800 }}>{data.mediclaim_included ? 'ENROLLED' : 'NO'}</div></div>
                 </div>
               </div>
            </SectionCard>

            <SectionCard title="Education History" icon={<GraduationCap size={15} />} action={editing && (
               <button className="btn btn-secondary btn-sm" onClick={() => {
                 const newEd = [...(editForm.education_details || []), { institution: '', degree: '', year: '' }];
                 setEditForm({ ...editForm, education_details: newEd });
               }}>
                 <Plus size={14} /> Add
               </button>
            )}>
               <div className="table-responsive">
                 <table className="table table-sm">
                   <thead>
                     <tr>
                       <th>Institution</th>
                       <th>Degree</th>
                       <th>Year</th>
                       {editing && <th></th>}
                     </tr>
                   </thead>
                   <tbody>
                     {(editing ? editForm.education_details : data.education_details || []).map((ed, i) => (
                       <tr key={i}>
                         <td>{editing ? <input className="form-control form-control-sm" value={ed.institution} onChange={e => {
                           const newEd = [...editForm.education_details];
                           newEd[i].institution = e.target.value;
                           setEditForm({ ...editForm, education_details: newEd });
                         }} /> : ed.institution}</td>
                         <td>{editing ? <input className="form-control form-control-sm" value={ed.degree} onChange={e => {
                           const newEd = [...editForm.education_details];
                           newEd[i].degree = e.target.value;
                           setEditForm({ ...editForm, education_details: newEd });
                         }} /> : ed.degree}</td>
                         <td>{editing ? <input className="form-control form-control-sm" value={ed.year} onChange={e => {
                           const newEd = [...editForm.education_details];
                           newEd[i].year = e.target.value;
                           setEditForm({ ...editForm, education_details: newEd });
                         }} /> : ed.year}</td>
                         {editing && <td><button className="btn btn-ghost btn-sm text-danger" onClick={() => {
                           const newEd = editForm.education_details.filter((_, idx) => idx !== i);
                           setEditForm({ ...editForm, education_details: newEd });
                         }}><X size={14} /></button></td>}
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </SectionCard>

            <SectionCard title="Address & Records" icon={<MapPin size={15} />} style={{ gridColumn: 'span 2' }}>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Current Address</label>
                    {editing ? <textarea className="form-control" rows={2} value={editForm.current_address} onChange={e => setEditForm({ ...editForm, current_address: e.target.value })} /> : <div style={{ fontSize: '0.85rem' }}>{data.current_address || '—'}</div>}
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Permanent Address</label>
                    {editing ? <textarea className="form-control" rows={2} value={editForm.permanent_address} onChange={e => setEditForm({ ...editForm, permanent_address: e.target.value })} /> : <div style={{ fontSize: '0.85rem' }}>{data.permanent_address || '—'}</div>}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>HR Remarks / Notes</label>
                    {editing ? <textarea className="form-control" rows={3} value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /> : <div style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 8, fontSize: '0.85rem' }}>{data.notes || 'No notes added'}</div>}
                  </div>
               </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'performance' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
            <SectionCard title="Key Result Areas (KRA)" icon={<TrendingUp size={15} />}>
               <div className="table-responsive">
                 <table className="table">
                   <thead>
                     <tr>
                       <th>Period</th>
                       <th>Status</th>
                       <th>Total Score</th>
                       <th>Action</th>
                     </tr>
                   </thead>
                   <tbody>
                     {(data.kra_assessments || []).map((ka, i) => (
                       <tr key={i}>
                         <td>{ka.period} {ka.year}</td>
                         <td><span className={`badge ${ka.status === 'finalized' ? 'badge-success' : 'badge-warning'}`}>{ka.status}</span></td>
                         <td><strong>{ka.score?.toFixed(1) || '—'}</strong></td>
                         <td><button className="btn btn-ghost btn-sm">View Details</button></td>
                       </tr>
                     ))}
                     {(data.kra_assessments || []).length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No performance reviews logged</td></tr>}
                   </tbody>
                 </table>
               </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'training' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
            <SectionCard title="Training & Certifications" icon={<GraduationCap size={15} />}>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
                  {(data.training_assignments || []).map((t, i) => (
                    <div key={i} className="card" style={{ padding: 20 }}>
                       <h5 style={{ margin: '0 0 8px' }}>{t.program_name}</h5>
                       <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>Assigned: {new Date(t.assigned_date).toLocaleDateString()}</p>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={`badge ${t.status === 'completed' ? 'badge-success' : 'badge-info'}`}>{t.status}</span>
                          {t.status === 'completed' && <button className="btn btn-ghost btn-sm"><Download size={14} /> Certificate</button>}
                       </div>
                    </div>
                  ))}
               </div>
               {(data.training_assignments || []).length === 0 && <p style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No training programs assigned</p>}
            </SectionCard>
          </div>
        )}

        {activeTab === 'assets' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
            <SectionCard title="Company Assets & Clearance" icon={<ShieldCheck size={15} />}>
               <div className="table-responsive">
                 <table className="table">
                   <thead>
                     <tr>
                       <th>Asset Category</th>
                       <th>Item Details</th>
                       <th>Status</th>
                       <th>Action</th>
                     </tr>
                   </thead>
                   <tbody>
                     {(data.asset_checklist || []).map((a, i) => (
                       <tr key={i}>
                         <td><strong>{a.category}</strong></td>
                         <td>{a.item_name}</td>
                         <td>
                           {a.issued ? (
                             <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                               <CheckCircle size={12} /> Issued
                             </span>
                           ) : (
                             <span className="badge badge-warning">Pending Issue</span>
                           )}
                         </td>
                         <td>
                            {canEdit && !a.issued && <button className="btn btn-primary btn-sm" onClick={() => handleIssueAsset(i)}>Mark Issued</button>}
                            {canEdit && a.issued && !a.returned && <button className="btn btn-secondary btn-sm" onClick={() => handleReturnAsset(i)}>Release / Return</button>}
                            {a.returned && <span className="badge badge-success">Returned</span>}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
            </SectionCard>
          </div>
        )}

        {activeTab === 'vault' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              { id: 'resume', label: 'CV / Resume', key: 'cv_path', icon: <FileText size={40} />, upload_key: 'cv' },
              { id: 'id', label: 'ID Proofs', key: 'id_proofs', icon: <ShieldCheck size={40} />, upload_key: 'id_proof' },
              { id: 'photo', label: 'Profile Photo', key: 'photo_path', icon: <User size={40} />, upload_key: 'photo' }
            ].map(doc => (
              <div key={doc.id} className="card animate-fade-in" style={{ textAlign: 'center', padding: 32 }}>
                <div style={{ color: 'var(--primary)', opacity: 0.5, marginBottom: 16 }}>{doc.icon}</div>
                <h4 style={{ marginBottom: 4 }}>{doc.label}</h4>
                <p style={{ fontSize: '0.8rem', marginBottom: 20 }}>{data[doc.key] ? 'Document Verified' : 'No document uploaded'}</p>
                
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {data[doc.key] ? (
                    <a href={`${API_BASE}/${data[doc.key]}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                       <ExternalLink size={14} /> View Document
                    </a>
                  ) : (
                    <span className="badge badge-warning">Missing</span>
                  )}
                  {canEdit && (
                    <button className="btn btn-primary btn-sm" onClick={() => { setUploadingDoc(doc.upload_key); docInputRef.current.click(); }}>
                       <Upload size={14} /> {data[doc.key] ? 'Update' : 'Upload'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'payroll' && (
          <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 24 }}>
            
            {loadingPayroll ? (
              <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" /></div>
            ) : (
              <>
                {/* Active Salary Summary Widget */}
                {payrollData.length > 0 && (
                  <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #6366F1 100%)', color: 'white' }}>
                    <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                       <div>
                         <h4 style={{ margin: '0 0 4px', color: 'rgba(255,255,255,0.9)' }}>Current Net Salary</h4>
                         <div style={{ fontSize: '2.5rem', fontWeight: 900 }}>${payrollData[0].net_payable.toFixed(2)}</div>
                         <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>Last Issued: {payrollData[0].month_year}</div>
                       </div>
                       <div style={{ display: 'flex', gap: 24, textAlign: 'right' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 800 }}>Basic</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>${payrollData[0].basic_salary.toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 800 }}>Allowances</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>${(payrollData[0].hra + payrollData[0].other_allowances).toFixed(2)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'rgba(255,255,255,0.7)', fontWeight: 800 }}>Deductions</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#ffecf0' }}>-${(payrollData[0].deductions_tax + payrollData[0].deductions_pf).toFixed(2)}</div>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
                
                <SectionCard title="Payslip History" icon={<DollarSign size={15} />} action={canEdit && (
                   <button className="btn btn-primary btn-sm" onClick={() => setIssuePayrollOpen(!issuePayrollOpen)}>
                     <Plus size={14} /> Issue New Payslip
                   </button>
                )}>
                   
                   {issuePayrollOpen && (
                      <div className="card" style={{ marginBottom: 24, background: 'var(--primary-lightest)', border: '1px solid var(--primary-lighter)' }}>
                         <div className="card-header"><h5 style={{ margin: 0 }}>Generate Payslip</h5></div>
                         <div className="card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
                               <div className="form-group">
                                  <label className="form-label">Month & Year</label>
                                  <input type="text" className="form-control" placeholder="e.g. April 2026" value={payrollForm.month_year} onChange={e => setPayrollForm(f => ({ ...f, month_year: e.target.value }))} />
                               </div>
                               <div className="form-group">
                                  <label className="form-label">Basic Salary ($)</label>
                                  <input type="number" className="form-control" value={payrollForm.basic_salary} onChange={e => setPayrollForm(f => ({ ...f, basic_salary: parseFloat(e.target.value) || 0 }))} />
                               </div>
                               <div className="form-group">
                                  <label className="form-label">HRA ($)</label>
                                  <input type="number" className="form-control" value={payrollForm.hra} onChange={e => setPayrollForm(f => ({ ...f, hra: parseFloat(e.target.value) || 0 }))} />
                               </div>
                               <div className="form-group">
                                  <label className="form-label">Other Allowances ($)</label>
                                  <input type="number" className="form-control" value={payrollForm.other_allowances} onChange={e => setPayrollForm(f => ({ ...f, other_allowances: parseFloat(e.target.value) || 0 }))} />
                               </div>
                               <div className="form-group">
                                  <label className="form-label">Tax Deduction ($)</label>
                                  <input type="number" className="form-control" value={payrollForm.deductions_tax} onChange={e => setPayrollForm(f => ({ ...f, deductions_tax: parseFloat(e.target.value) || 0 }))} />
                               </div>
                               <div className="form-group">
                                  <label className="form-label">PF Deduction ($)</label>
                                  <input type="number" className="form-control" value={payrollForm.deductions_pf} onChange={e => setPayrollForm(f => ({ ...f, deductions_pf: parseFloat(e.target.value) || 0 }))} />
                               </div>
                            </div>
                            
                            <div style={{ marginTop: 20, padding: 16, background: 'var(--bg-body)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                               <div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Calculated Net Payable</div>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                                    ${(payrollForm.basic_salary + payrollForm.hra + payrollForm.other_allowances - payrollForm.deductions_tax - payrollForm.deductions_pf).toFixed(2)}
                                  </div>
                               </div>
                               <div style={{ display: 'flex', gap: 12 }}>
                                  <button className="btn btn-ghost" onClick={() => setIssuePayrollOpen(false)}>Cancel</button>
                                  <button className="btn btn-primary" onClick={handleIssuePayroll}>Release Payslip</button>
                               </div>
                            </div>
                         </div>
                      </div>
                   )}

                   <div className="table-responsive">
                     <table className="table">
                       <thead>
                         <tr>
                           <th>Month</th>
                           <th>Net Salary</th>
                           <th>Status</th>
                           <th>Issued On</th>
                           <th>Action</th>
                         </tr>
                       </thead>
                       <tbody>
                         {payrollData.map((p, i) => (
                           <tr key={i}>
                             <td><strong>{p.month_year}</strong></td>
                             <td><strong style={{ color: 'var(--success)' }}>${p.net_payable.toFixed(2)}</strong></td>
                             <td><span className={`badge ${p.status === 'released' ? 'badge-success' : 'badge-warning'}`}>{p.status}</span></td>
                             <td>{new Date(p.created_at).toLocaleDateString()}</td>
                             <td>
                               <button className="btn btn-secondary btn-sm" disabled={!p.payslip_url} title={!p.payslip_url ? "Doc not available" : ""}>
                                 <Download size={14} /> {p.payslip_url ? "Download" : "Not Available"}
                               </button>
                             </td>
                           </tr>
                         ))}
                         {payrollData.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No records found in payroll ledger</td></tr>}
                       </tbody>
                     </table>
                   </div>
                </SectionCard>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
