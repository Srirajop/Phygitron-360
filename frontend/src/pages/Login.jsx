import React, { useState } from 'react';
import { Eye, EyeOff, Zap, Shield, Brain, Star, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import BorderGlow from '../components/BorderGlow';
import Orb from '../components/Orb';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: <Brain size={20} />, text: 'AI-Powered Resume Analysis' },
  { icon: <Shield size={20} />, text: 'Smart Assessment Engine' },
  { icon: <Star size={20} />, text: 'Personalised Learning Paths' },
  { icon: <Zap size={20} />, text: 'Real-time Skill Intelligence' },
];

export default function Login() {
  const { login } = useAuth();
  const { theme } = useTheme();
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

  const isDark = theme === 'dark';
  const glowHsl = isDark ? '280 80 80' : '260 60 50'; // Purple for dark, Deep Indigo for light
  const accentColor = isDark ? '#7df9ff' : '#5227FF'; 
  const orbBg = isDark ? '#080510' : '#F3F4F6';

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', backgroundColor: 'var(--bg-page)', overflow: 'hidden' }}>
      {/* Dynamic Background */}
      <div className="page-bg" />

      {/* Left side — Premium Branding */}
      <div style={{
        background: isDark ? 'var(--bg-page)' : '#ffffff',
        padding: '64px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
        borderRight: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
      }}>
        {/* Orb Background */}
        <div style={{ position: 'absolute', inset: 0, opacity: isDark ? 0.5 : 0.3, pointerEvents: 'none', filter: 'blur(40px)' }}>
           <Orb 
              hue={isDark ? 280 : 250} 
              hoverIntensity={0.2} 
              backgroundColor={orbBg}
              forceHoverState={true}
           />
        </div>

        <div className="animate-fade-in" style={{ position: 'relative', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '80px' }}>
            <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ 
                width: 54, height: 54, 
                background: isDark ? 'rgba(124,58,237,0.15)' : 'rgba(124,58,237,0.1)', 
                borderRadius: 18, 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                backdropFilter: 'blur(10px)', 
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(124,58,237,0.2)'}`, 
                fontWeight: 900, fontSize: '1.25rem', color: isDark ? '#C4B5FD' : '#5B21B6' 
              }}>P3</div>
              <div>
                <div style={{ color: 'var(--text-primary)', fontWeight: 900, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>PHYGITRON 360</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>PREMIUM SAAS ENGINE</div>
              </div>
            </Link>
          </div>

          <h1 style={{ color: 'var(--text-primary)', fontSize: '3.8rem', lineHeight: 1.05, fontWeight: 900, marginBottom: '28px', letterSpacing: '-0.04em' }}>
            Shape the <br />
            <span style={{ 
              background: isDark 
                ? 'linear-gradient(90deg, #7df9ff, #C4B5FD)' 
                : 'linear-gradient(90deg, #5B21B6, #2563EB)', 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text' 
            }}>
              Future Workforce
            </span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.15rem', lineHeight: 1.6, marginBottom: '60px', maxWidth: '520px' }}>
            A hyper-isolated SaaS ecosystem designed to verify, forge, and deploy elite organizational talent with AI-driven precision.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', maxWidth: '600px' }}>
            {FEATURES.map((f, i) => (
              <div key={i} className={`animate-fade-in stagger-${i + 1}`} style={{ 
                display: 'flex', alignItems: 'center', gap: '14px', 
                color: 'var(--text-secondary)', fontSize: '0.95rem',
                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                padding: '16px', borderRadius: '16px',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                backdropFilter: 'blur(4px)'
              }}>
                <div style={{ 
                  color: isDark ? '#7df9ff' : '#5B21B6',
                  opacity: 0.9
                }}>
                  {f.icon}
                </div>
                {f.text}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
            © 2025 PHYGITRON 360 · EwandZDigital
          </p>
          <Link to="/" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }} className="hover-primary">
            <ArrowLeft size={14} /> Back to Landing
          </Link>
        </div>
      </div>

      {/* Right side — Login form with BorderGlow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <BorderGlow
            glowColor={glowHsl}
            glowRadius={40}
            glowIntensity={1.0}
            edgeSensitivity={30}
            borderRadius={32}
            backgroundColor={isDark ? 'rgba(15, 12, 25, 0.8)' : 'rgba(255, 255, 255, 0.9)'}
            animated={true}
            colors={isDark ? ['#c084fc', '#f472b6', '#38bdf8'] : ['#7C3AED', '#EC4899', '#2563EB']}
          >
            <div style={{ 
              background: isDark ? 'rgba(15, 12, 25, 0.8)' : 'rgba(255, 255, 255, 0.9)', 
              backdropFilter: 'blur(30px)', 
              padding: '56px 48px', 
              borderRadius: 'inherit',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(91, 33, 182, 0.1)'}`,
              boxShadow: isDark ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 20px 40px -10px rgba(91, 33, 182, 0.15)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                <h2 style={{ fontSize: '2.2rem', fontWeight: 900, marginBottom: '12px', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Welcome Back</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>
                  Securely access your organization's hub
                </p>
              </div>

              <div style={{ 
                background: isDark ? 'rgba(125, 249, 255, 0.05)' : 'rgba(82, 39, 255, 0.05)', 
                border: `1px solid ${isDark ? 'rgba(125, 249, 255, 0.1)' : 'rgba(82, 39, 255, 0.1)'}`, 
                borderRadius: '16px', padding: '16px', marginBottom: '32px', fontSize: '0.85rem', color: isDark ? '#7df9ff' : '#5B21B6',
                display: 'flex', flexDirection: 'column', gap: '4px'
              }}>
                <span style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', opacity: 0.8 }}>System Credentials (Demo)</span>
                <code style={{ fontSize: '0.8rem', opacity: 0.9 }}>admin@ewandz.com / Demo@1234</code>
              </div>

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>BUSINESS EMAIL</label>
                  <input 
                    type="email" 
                    className="form-control" 
                    placeholder="you@company.com" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    style={{ 
                      borderRadius: '14px', 
                      height: '52px', 
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      fontSize: '1rem'
                    }} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>PASSWORD</label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type={showPwd ? 'text' : 'password'} 
                      className="form-control" 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={e => setPassword(e.target.value)} 
                      style={{ 
                        borderRadius: '14px', 
                        height: '52px', 
                        paddingRight: 48,
                        background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                        fontSize: '1rem'
                      }} 
                    />
                    <button type="button" onClick={() => setShowPwd(s => !s)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={loading} style={{ 
                  height: '56px', 
                  borderRadius: '16px', 
                  marginTop: '12px',
                  background: isDark ? `linear-gradient(135deg, ${accentColor} 0%, #2563EB 100%)` : `linear-gradient(135deg, #5B21B6 0%, #7C3AED 100%)`,
                  color: isDark ? '#000' : '#fff',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  border: 'none',
                  boxShadow: `0 8px 24px -6px ${isDark ? 'rgba(125, 249, 255, 0.4)' : 'rgba(91, 33, 182, 0.4)'}`
                }}>
                  {loading ? 'AUTHENTICATING...' : 'SIGN IN TO PORTAL'}
                </button>
              </form>

              <div style={{ marginTop: '32px', textAlign: 'center' }}>
                <Link to="/#contact" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem', fontWeight: 500 }} className="hover-primary">
                  New organization? <span style={{ color: isDark ? '#7df9ff' : '#5B21B6' }}>Register interest →</span>
                </Link>
              </div>
            </div>
          </BorderGlow>
        </div>
      </div>
    </div>
  );
}
