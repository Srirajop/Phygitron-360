import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import { Lock, CheckCircle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import BorderGlow from '../components/BorderGlow';
import { useTheme } from '../context/ThemeContext';

export default function ChangePassword() {
  const { user, updateUser } = useAuth();
  const { theme } = useTheme();
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
      const homeMap = {
        super_admin: '/platform/dashboard',
        candidate: '/verify/dashboard',
        employee: '/forge',
        hr: '/source',
        instructor: '/forge/my-courses',
        manager: '/deploy',
        org_admin: '/source',
      };
      navigate(homeMap[user?.role] || '/');
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';
  const glowHsl = isDark ? '280 80 80' : '260 60 50';
  const accentColor = isDark ? '#7df9ff' : '#5227FF';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: 'var(--bg-page)', position: 'relative', overflow: 'hidden' }}>
      <div className="page-bg" />
      
      {/* Subtle Background Glows */}
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: '400px', height: '400px', borderRadius: '50%', background: isDark ? 'rgba(124,58,237,0.05)' : 'rgba(124,58,237,0.03)', filter: 'blur(100px)', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '400px', height: '400px', borderRadius: '50%', background: isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.03)', filter: 'blur(100px)', zIndex: 0 }} />

      <div style={{ width: '100%', maxWidth: 480, position: 'relative', zIndex: 10 }}>
        <BorderGlow
          glowColor={glowHsl}
          glowRadius={40}
          glowIntensity={1.0}
          edgeSensitivity={30}
          borderRadius={32}
          backgroundColor={isDark ? 'rgba(15, 12, 25, 0.85)' : 'rgba(255, 255, 255, 0.95)'}
          animated={true}
          colors={isDark ? ['#c084fc', '#f472b6', '#38bdf8'] : ['#7C3AED', '#EC4899', '#2563EB']}
          style={{ width: '100%' }}
        >
          <div style={{ 
            background: isDark ? 'rgba(15, 12, 25, 0.85)' : 'rgba(255, 255, 255, 0.95)', 
            backdropFilter: 'blur(30px)', 
            padding: '56px 48px', 
            borderRadius: 'inherit',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(91, 33, 182, 0.12)'}`,
            position: 'relative',
            zIndex: 10
          }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div style={{ 
                width: 64, height: 64, 
                background: `linear-gradient(135deg, ${accentColor} 0%, ${isDark ? '#2563EB' : '#7C3AED'} 100%)`, 
                borderRadius: '20px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                margin: '0 auto 20px', 
                boxShadow: `0 8px 16px ${isDark ? 'rgba(125,249,255,0.3)' : 'rgba(91,33,182,0.3)'}`,
                color: isDark ? '#000' : '#fff'
              }}>
                <Lock size={28} />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '12px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Initialize Account</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Please set a secure password for your first login to the platform.
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>NEW PASSWORD</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="At least 8 characters..." 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  autoFocus 
                  style={{ 
                    borderRadius: '14px', 
                    height: '52px', 
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    fontSize: '1rem'
                  }} 
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>CONFIRM PASSWORD</label>
                <input 
                  type="password" 
                  className="form-control" 
                  placeholder="Repeat your password" 
                  value={confirm} 
                  onChange={e => setConfirm(e.target.value)} 
                  style={{ 
                    borderRadius: '14px', 
                    height: '52px', 
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    fontSize: '1rem'
                  }} 
                />
              </div>

              <div style={{ 
                background: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)', 
                borderRadius: '16px', 
                padding: '20px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`
              }}>
                <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '0.05em' }}>Security Requirements</div>
                {rules.map((rule, i) => (
                  <div key={i} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    fontSize: '0.875rem', 
                    color: rule.ok ? (isDark ? '#10b981' : '#059669') : 'var(--text-muted)', 
                    marginBottom: i === rules.length - 1 ? 0 : '10px', 
                    transition: 'all 0.3s ease',
                    opacity: rule.ok ? 1 : 0.6
                  }}>
                    {rule.ok ? <ShieldCheck size={16} /> : <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid currentColor', opacity: 0.3 }} />}
                    {rule.label}
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={!allOk || loading} style={{ 
                height: '56px', 
                borderRadius: '16px', 
                marginTop: '8px',
                background: isDark ? `linear-gradient(135deg, ${accentColor} 0%, #2563EB 100%)` : `linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)`,
                color: isDark ? '#000' : '#fff',
                fontWeight: 800,
                fontSize: '1.1rem',
                border: 'none',
                boxShadow: allOk ? `0 8px 24px -6px ${isDark ? 'rgba(125,249,255,0.4)' : 'rgba(91, 33, 182, 0.4)'}` : 'none',
                opacity: allOk ? 1 : 0.5
              }}>
                {loading ? 'SECURING ACCOUNT...' : 'SET PASSWORD & CONTINUE'}
              </button>
            </form>
          </div>
        </BorderGlow>
      </div>
    </div>
  );
}
