import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { deployApi, adminApi } from '../../api';
import { ArrowLeft, UserPlus, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AddEmployee() {
  const nav = useNavigate();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    user_id: '', emp_id: '', department: '', join_date: '', manager_id: '',
  });
  const [customDept, setCustomDept] = useState('');
  const [useCustomDept, setUseCustomDept] = useState(false);

  useEffect(() => {
    adminApi.listUsers({}).then(r => setUsers(r.data.data || [])).catch(() => {});
    deployApi.departments().then(r => setDepartments(r.data.data || [])).catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.user_id) { toast.error('Select a user'); return; }
    setLoading(true);
    try {
      const dept = useCustomDept ? customDept : form.department;
      const payload = {
        user_id: parseInt(form.user_id),
        emp_id: form.emp_id || undefined,
        department: dept || undefined,
        join_date: form.join_date || undefined,
        manager_id: form.manager_id ? parseInt(form.manager_id) : undefined,
      };
      const res = await deployApi.createEmployee(payload);
      toast.success('Employee created!');
      nav(`/deploy/employee/${res.data.data.id}`);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <Link to="/deploy" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
          <ArrowLeft size={15} /> Back to Employee Database
        </Link>
        <h1>Add Employee</h1>
        <p>Create a new employee record from an existing platform user</p>
      </div>
      <div className="page-body">
        <div style={{ maxWidth: 640 }}>
          <form onSubmit={handleSubmit} className="card animate-fade-in">
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
                }}><UserPlus size={18} /></div>
                <h4 style={{ margin: 0 }}>Employee Details</h4>
              </div>
            </div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label" htmlFor="user-select">Platform User *</label>
                <select id="user-select" className="form-control" value={form.user_id} onChange={e => set('user_id', e.target.value)} required>
                  <option value="">Select a user…</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>
                  ))}
                </select>
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Only existing platform users can be added as employees</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="emp-id">Employee ID</label>
                  <input id="emp-id" className="form-control" placeholder="e.g., EMP-001" value={form.emp_id} onChange={e => set('emp_id', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="join-date">Join Date</label>
                  <input id="join-date" type="date" className="form-control" value={form.join_date} onChange={e => set('join_date', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                  <button type="button" className={`btn btn-sm ${!useCustomDept ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setUseCustomDept(false)}>Existing</button>
                  <button type="button" className={`btn btn-sm ${useCustomDept ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setUseCustomDept(true)}>New</button>
                </div>
                {useCustomDept ? (
                  <input id="dept-custom" className="form-control" placeholder="Enter department name" value={customDept} onChange={e => setCustomDept(e.target.value)} />
                ) : (
                  <select id="dept-select" className="form-control" value={form.department} onChange={e => set('department', e.target.value)}>
                    <option value="">No department</option>
                    {departments.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                )}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="manager-select">Manager (optional)</label>
                <select id="manager-select" className="form-control" value={form.manager_id} onChange={e => set('manager_id', e.target.value)}>
                  <option value="">No direct manager</option>
                  {users.filter(u => u.role === 'manager' || u.role === 'admin').map(u => (
                    <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <Link to="/deploy" className="btn btn-ghost">Cancel</Link>
              <button type="submit" className="btn btn-primary btn-shimmer" disabled={loading}>
                {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Save size={15} /> Create Employee</>}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
