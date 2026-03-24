import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { UserPlus, Shield, UserX, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = ['candidate', 'employee', 'hr', 'instructor', 'manager', 'admin'];
const ROLE_BADGE = { admin: 'badge-danger', hr: 'badge-primary', manager: 'badge-info', instructor: 'badge-warning', employee: 'badge-success', candidate: 'badge-muted' };

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', role: 'candidate', password: 'ChangeMe@123' });

  const load = () => {
    setLoading(true);
    adminApi.listUsers().then(r => setUsers(r.data.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await adminApi.createUser(form);
      toast.success('User created!');
      setShowAdd(false); load();
      setForm({ full_name: '', email: '', role: 'candidate', password: 'ChangeMe@123' });
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed to create'); }
  };

  const updateRole = async (id, role) => {
    try {
      await adminApi.updateRole(id, role);
      setUsers(u => u.map(x => x.id === id ? { ...x, role } : x));
      toast.success('Role updated');
    } catch { toast.error('Update failed'); }
  };

  const toggleActive = async (id) => {
    try {
      await adminApi.toggleActive(id);
      setUsers(u => u.map(x => x.id === id ? { ...x, is_active: !x.is_active } : x));
      toast.success('Status toggled');
    } catch { toast.error('Toggle failed'); }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><h1>User Management</h1><p>Control access, roles, and platform permissions</p></div>
        <button className="btn btn-shimmer" onClick={() => setShowAdd(true)}><UserPlus size={16} /> Add User</button>
      </div>
      <div className="page-body">
        <div className="card animate-fade-in">
          <div className="table-container">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr> : (
                  users.map((u, i) => (
                    <tr key={u.id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                      <td><strong>{u.full_name}</strong></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{u.email}</td>
                      <td>
                        <select className={`badge ${ROLE_BADGE[u.role]}`} value={u.role} onChange={e => updateRole(u.id, e.target.value)} style={{ border: 'none', appearance: 'none', cursor: 'pointer', textAlign: 'center' }}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td><span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                      <td>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(u.id)} title={u.is_active ? 'Disable' : 'Enable'}>
                          {u.is_active ? <UserX size={14} color="var(--danger)" /> : <CheckCircle size={14} color="var(--success)" />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h4>Add New User</h4><button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>✕</button></div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Full Name *</label><input className="form-control" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
                <div className="form-group"><label className="form-label">Role</label>
                  <select className="form-control" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">Temporary Password</label><input className="form-control" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button><button type="submit" className="btn btn-primary">Create User</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
