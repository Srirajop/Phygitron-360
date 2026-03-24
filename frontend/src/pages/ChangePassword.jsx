import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import { Lock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChangePassword() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const rules = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'At least one number', ok: /\d/.test(password) },
    { label: 'At least one special character', ok: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    { label: 'Passwords match', ok: password === confirm && password.length > 0 },
  ];

  const allOk = rules.every(r => r.ok);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allOk) { toast.error('Please meet all requirements'); return; }
    setLoading(true);
    try {
      await authApi.changePassword(password);
      updateUser({ first_login: false });
      toast.success('Password changed! Welcome to PHYGITRON 360 🎉');
      const homeMap = { candidate: '/verify/dashboard', employee: '/forge', hr: '/source', instructor: '/forge', manager: '/deploy', admin: '/admin/users' };
      navigate(homeMap[user?.role] || '/');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="page-bg" />
      <div className="card animate-scale-in" style={{ maxWidth: 440, width: '100%' }}>
        <div className="card-header" style={{ textAlign: 'center', background: 'linear-gradient(135deg, var(--primary-lightest), white)' }}>
          <div style={{ width: 56, height: 56, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: '0 4px 16px rgba(124,58,237,0.4)' }}>
            <Lock size={24} color="white" />
          </div>
          <h3>Set Your Password</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>This is your first login — please set a secure password.</p>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input type="password" className="form-control" placeholder="Choose a strong password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-control" placeholder="Repeat your password" value={confirm} onChange={e => setConfirm(e.target.value)} />
            </div>
            <div style={{ marginBottom: 24 }}>
              {rules.map((rule, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem', color: rule.ok ? 'var(--success)' : 'var(--text-muted)', marginBottom: 6, transition: 'color 0.2s' }}>
                  <CheckCircle size={14} style={{ opacity: rule.ok ? 1 : 0.3 }} />
                  {rule.label}
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!allOk || loading}>
              {loading ? 'Saving…' : 'Set Password & Continue →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
