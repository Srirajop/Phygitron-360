import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { deployApi, adminApi, onboardingApi } from '../../api';
import { 
  ArrowLeft, UserPlus, Calendar, Save, Phone, MapPin, 
  Briefcase, GraduationCap, ClipboardList, CheckCircle2 
} from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = ['employee', 'hr', 'manager', 'org_admin'];
const EMP_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'];

export default function AddEmployee() {
  const nav = useNavigate();
  const [mode, setMode] = useState('direct'); // 'direct' or 'invite'
  const [inviteForm, setInviteForm] = useState({
    full_name: '',
    email: '',
    department: '',
    designation: ''
  });

  const [form, setForm] = useState({
    user_id: '',
// ... (rest of form)
    emp_id: '',
    department: '',
    designation: '',
    dob: '',
    contact_number: '',
    emergency_contact: '',
    join_date: '',
    employment_type: 'Full-time',
    location: '',
    current_address: '',
    permanent_address: '',
    pf_included: false,
    mediclaim_included: false,
    notes: '',
    manager_id: '',
  });

  const [customDept, setCustomDept] = useState('');
  const [useCustomDept, setUseCustomDept] = useState(false);
  const [step, setStep] = useState(1);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    adminApi.listUsers({}).then(r => setUsers(r.data.data || [])).catch(() => {});
    deployApi.departments().then(r => setDepartments(r.data.data || [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!form.user_id) { toast.error('Select a platform user first'); setStep(1); return; }
    
    setLoading(true);
    try {
      const dept = useCustomDept ? customDept : form.department;
      const payload = {
        ...form,
        user_id: parseInt(form.user_id),
        department: dept || undefined,
        manager_id: form.manager_id ? parseInt(form.manager_id) : undefined,
        education_details: [], // For now empty, can be added in profile
      };
      
      const res = await deployApi.createEmployee(payload);
      toast.success('Employee successfully onboarded!');
      nav(`/deploy/employee/${res.data.data.id || res.data.data.employee_id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to onboard employee');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onboardingApi.sendInvite(inviteForm);
      toast.success('Onboarding invite sent via email');
      nav('/deploy');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <Link to="/deploy" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
          <ArrowLeft size={15} /> Employee Directory
        </Link>
        <h1>Onboard Personnel</h1>
        <p>Integrate an existing user or invite a new hire to the system</p>
        
        <div style={{ display: 'flex', gap: 4, marginTop: 20, background: 'var(--bg-card)', borderRadius: 12, padding: 4, border: '1px solid var(--border)', width: 'fit-content' }}>
          <button onClick={() => setMode('direct')} className="btn btn-sm" style={{ background: mode === 'direct' ? 'var(--primary)' : 'transparent', color: mode === 'direct' ? 'white' : 'var(--text-secondary)', border: 'none', padding: '8px 20px', borderRadius: 10, fontWeight: 700 }}>Direct Onboard</button>
          <button onClick={() => setMode('invite')} className="btn btn-sm" style={{ background: mode === 'invite' ? 'var(--primary)' : 'transparent', color: mode === 'invite' ? 'white' : 'var(--text-secondary)', border: 'none', padding: '8px 20px', borderRadius: 10, fontWeight: 700 }}>Send Invite</button>
        </div>
      </div>

      <div className="page-body">
        <div style={{ maxWidth: 800 }}>
          {/* Step Progress */}
          <div className="card" style={{ marginBottom: 24, padding: '20px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 12, left: '5%', right: '5%', height: 2, background: 'var(--border)', zIndex: 0 }} />
              <div style={{ position: 'absolute', top: 12, left: '5%', width: `${(step-1)*45}%`, height: 2, background: 'var(--primary)', zIndex: 1, transition: 'width 0.4s ease' }} />
              
              {[
                { s: 1, label: 'Core Identity', icon: <UserPlus size={14} /> },
                { s: 2, label: 'Assignment', icon: <Briefcase size={14} /> },
                { s: 3, label: 'Benefits & Config', icon: <ClipboardList size={14} /> }
              ].map(item => (
                <div key={item.s} style={{ zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: step >= item.s ? 'var(--primary)' : 'var(--bg-card)',
                    border: '2px solid', borderColor: step >= item.s ? 'var(--primary)' : 'var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: step >= item.s ? 'white' : 'var(--text-muted)',
                    fontSize: '0.75rem', fontWeight: 800, transition: 'all 0.3s ease'
                  }}>
                    {step > item.s ? <CheckCircle2 size={14} /> : item.s}
                  </div>
                  <span style={{ 
                    fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: step >= item.s ? 'var(--text-primary)' : 'var(--text-muted)'
                  }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {mode === 'direct' ? (
            <div className="card animate-scale-in">
              <div className="card-header">
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                  {step === 1 && <><UserPlus size={18} color="var(--primary)" /> Basic Information</>}
                  {step === 2 && <><Briefcase size={18} color="var(--primary)" /> Assignment & Role</>}
                  {step === 3 && <><ClipboardList size={18} color="var(--primary)" /> Extras & Benefits</>}
                </h4>
              </div>

              <div className="card-body">
                {/* ... (step content remains same) ... */}
                {step === 1 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Platform User *</label>
                      <select className="form-control" value={form.user_id} onChange={e => set('user_id', e.target.value)} required>
                        <option value="">Select a platform user…</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>
                        ))}
                      </select>
                      <small style={{ color: 'var(--text-muted)', marginTop: 4 }}>This links the employee record to a system login.</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Employee Code</label>
                      <input className="form-control" placeholder="e.g. EMP-001" value={form.emp_id} onChange={e => set('emp_id', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Date of Birth</label>
                      <div className="form-date-group">
                        <Calendar size={16} className="calendar-icon" />
                        <input type="date" className="form-control" value={form.dob} onChange={e => set('dob', e.target.value)} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Phone Number</label>
                      <div style={{ position: 'relative' }}>
                        <Phone size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                        <input className="form-control" style={{ paddingLeft: 40 }} placeholder="10-digit mobile" value={form.contact_number} onChange={e => set('contact_number', e.target.value)} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Emergency Contact</label>
                      <input className="form-control" placeholder="Name & Number" value={form.emergency_contact} onChange={e => set('emergency_contact', e.target.value)} />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="form-group">
                      <label className="form-label">Designation</label>
                      <input className="form-control" placeholder="e.g. Senior Developer" value={form.designation} onChange={e => set('designation', e.target.value)} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Joining Date</label>
                      <div className="form-date-group">
                        <Calendar size={16} className="calendar-icon" />
                        <input type="date" className="form-control" value={form.join_date} onChange={e => set('join_date', e.target.value)} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Department</label>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                        <button type="button" className={`btn btn-sm ${!useCustomDept ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setUseCustomDept(false)}>Existing</button>
                        <button type="button" className={`btn btn-sm ${useCustomDept ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setUseCustomDept(true)}>New</button>
                      </div>
                      {useCustomDept ? (
                        <input className="form-control" placeholder="New department name" value={customDept} onChange={e => setCustomDept(e.target.value)} />
                      ) : (
                        <select className="form-control" value={form.department} onChange={e => set('department', e.target.value)}>
                          <option value="">No department</option>
                          {departments.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      )}
                    </div>

                    <div className="form-group">
                      <label className="form-label">Location</label>
                      <div style={{ position: 'relative' }}>
                        <MapPin size={16} style={{ position: 'absolute', left: 12, top: 14, color: 'var(--text-muted)' }} />
                        <input className="form-control" style={{ paddingLeft: 40 }} placeholder="Hub / City" value={form.location} onChange={e => set('location', e.target.value)} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Employment Type</label>
                      <select className="form-control" value={form.employment_type} onChange={e => set('employment_type', e.target.value)}>
                        {EMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Reporting Manager</label>
                      <select className="form-control" value={form.manager_id} onChange={e => set('manager_id', e.target.value)}>
                        <option value="">No manager</option>
                        {users.filter(u => ['manager', 'org_admin', 'hr'].includes(u.role)).map(u => (
                          <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Benefits Enrollment</label>
                      <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={form.pf_included} onChange={e => set('pf_included', e.target.checked)} />
                          <span style={{ fontSize: '0.9rem' }}>PF / Retirement Fund</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                          <input type="checkbox" checked={form.mediclaim_included} onChange={e => set('mediclaim_included', e.target.checked)} />
                          <span style={{ fontSize: '0.9rem' }}>Mediclaim / Insurance</span>
                        </label>
                      </div>
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Current Address</label>
                      <textarea className="form-control" rows={2} value={form.current_address} onChange={e => set('current_address', e.target.value)} />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Notes / HR Remarks</label>
                      <textarea className="form-control" rows={3} placeholder="Special instructions or background check notes…" value={form.notes} onChange={e => set('notes', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 24px' }}>
                <button className="btn btn-ghost" onClick={() => step === 1 ? nav('/deploy') : prevStep()}>
                  {step === 1 ? 'Cancel' : 'Back'}
                </button>
                <div style={{ display: 'flex', gap: 12 }}>
                  {step < 3 ? (
                    <button className="btn btn-primary" onClick={nextStep}>Continue</button>
                  ) : (
                    <button className="btn btn-primary btn-shimmer" onClick={handleSubmit} disabled={loading}>
                      {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : <><Save size={16} /> Finish Onboarding</>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card animate-scale-in">
              <div className="card-header"><h4 style={{ margin: 0 }}>Send Onboarding Invite</h4></div>
              <form onSubmit={handleSendInvite}>
                <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div className="form-group">
                    <label className="form-label">Candidate Full Name *</label>
                    <input className="form-control" required placeholder="John Doe" value={inviteForm.full_name} onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Personal Email *</label>
                    <input type="email" className="form-control" required placeholder="john@example.com" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Role / Designation *</label>
                    <input className="form-control" required placeholder="e.g. SDE-1" value={inviteForm.designation} onChange={e => setInviteForm(f => ({ ...f, designation: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select className="form-control" required value={inviteForm.department} onChange={e => setInviteForm(f => ({ ...f, department: e.target.value }))}>
                      <option value="">Select Dept…</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '20px 24px' }}>
                  <button type="submit" className="btn btn-primary" disabled={loading}>
                    {loading ? <div className="spinner" style={{ width: 16, height: 16 }} /> : "Send Welcome Email →"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
