import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, Zap, Shield, Brain, Star } from 'lucide-react';
import toast from 'react-hot-toast';

const FEATURES = [
  { icon: <Brain size={20} />, text: 'AI-Powered Resume Analysis' },
  { icon: <Shield size={20} />, text: 'Smart Assessment Engine' },
  { icon: <Star size={20} />, text: 'Personalised Learning Paths' },
  { icon: <Zap size={20} />, text: 'Real-time Skill Intelligence' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Please fill all fields'); return; }
    setLoading(true);
    try {
      const { first_login, role } = await login(email, password);
      toast.success('Welcome back! 🎉');
      if (first_login) {
        navigate('/change-password');
      } else {
        const homeMap = { candidate: '/verify/dashboard', employee: '/forge', hr: '/source', instructor: '/forge', manager: '/deploy', admin: '/admin/users' };
        navigate(homeMap[role] || '/');
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
      <div className="page-bg" />

      {/* Left side — Branding */}
      <div style={{
        background: 'linear-gradient(145deg, #5B21B6, #7C3AED, #4C1D95)',
        padding: '48px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative orbs */}
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '-60px', width: '250px', height: '250px', borderRadius: '50%', background: 'rgba(236,72,153,0.12)', filter: 'blur(50px)' }} />

        <div className="animate-fade-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '48px' }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', fontWeight: 900, fontSize: '1.1rem', color: 'white' }}>P3</div>
            <div>
              <div style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>PHYGITRON 360</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>EwandZDigital</div>
            </div>
          </div>

          <h1 style={{ color: 'white', fontSize: '2.8rem', lineHeight: 1.15, marginBottom: '20px' }}>
            The Talent<br />
            <span style={{ background: 'linear-gradient(90deg, #F9A8D4, #C4B5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Intelligence
            </span><br />
            Platform
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', lineHeight: 1.7, marginBottom: '40px' }}>
            One unified AI system covering the full talent lifecycle — from recruitment to deployment.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {FEATURES.map((f, i) => (
              <div key={i} className={`animate-fade-in stagger-${i + 1}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>
                <div style={{ width: 36, height: 36, background: 'rgba(255,255,255,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                  {f.icon}
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
          © 2025 PHYGITRON 360 · Powered by EwandZDigital · Built with AI 🤖
        </p>
      </div>

      {/* Right side — Login form */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }}>
        <div className="animate-slide-up" style={{ width: '100%', maxWidth: 420 }}>
          <h2 style={{ marginBottom: 8 }}>Welcome back 👋</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '36px', fontSize: '0.95rem' }}>
            Sign in to your PHYGITRON 360 account
          </p>

          <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: '24px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--primary)' }}>Demo Accounts</strong> (password: <code>Demo@1234</code>)<br />
            admin@ewandz.com · hr@ewandz.com · candidate@ewandz.com
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-control" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} className="form-control" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: 44 }} autoComplete="current-password" />
                <button type="button" onClick={() => setShowPwd(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-shimmer btn-lg btn-block" disabled={loading} style={{ marginTop: '8px' }}>
              {loading ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} /> Signing in…</> : '🚀 Sign In'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Facing issues? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
