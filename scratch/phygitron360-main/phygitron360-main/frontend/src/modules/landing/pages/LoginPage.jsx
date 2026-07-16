import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import '../styles/login.css';
import loginImg from "../../../assets/login.png";
import hideIcon from "../../../assets/hide.png";
import viewIcon from "../../../assets/view.png";
export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const detectSubdomain = () => {
    const hostname = window.location.hostname;
    
    // Ignore IP addresses
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
      return 'public';
    }

    const parts = hostname.split('.');
    
    if (hostname.includes('localhost')) {
      if (parts.length >= 2 && parts[0] !== 'www') {
        return parts[0]; 
      }
      return 'public';
    }

    if (parts.length > 2 && parts[0] !== 'www') return parts[0];
    return 'public';
  };

  const [workspaceId] = useState(detectSubdomain());

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workspace_id: workspaceId,
          username,
          password
        }),
      });

      const data = await res.json();

      if (res.ok) {
        login(data.user);

        const uRoles = (data.user.roles || [data.user.role])
          .map(r => r ? r.toLowerCase() : '');

        if (uRoles.includes('super_admin')) {
          navigate('/superadmin');
        } else if (uRoles.includes('org_admin')) {
          navigate('/admin');
        } else if (uRoles.includes('manager')) {
          navigate('/deploy?tab=team');
        } else if (uRoles.includes('candidate')) {
          navigate('/source?tab=my-application');
        } else if (uRoles.includes('trainee')) {
          navigate('/trainee');
        } else {
          navigate('/deploy');
        }
      } else {
        setError(data.detail || 'Access Denied: Invalid Credentials.');
      }
    } catch (err) {
      setError('Phygitron 360 Network Interrupted: Check Connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* LEFT IMAGE */}
      <div className="login-left">
        <img src={loginImg} alt="login visual" />
      </div>

      {/* RIGHT FORM */}
      <div className="login-right">
        <div className="login-box">

          {/* BACK */}
          <div className="back" onClick={() => navigate("/")}>
            ←
          </div>

          <h2>Log in to your account</h2>

          {error && (
            <div className="error-box">{error}</div>
          )}

          <form onSubmit={handleLogin}>

            <label>Email</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              
              required
            />

            <div className="password-row">
              <label>Password</label>
              <span onClick={() => navigate('/forgot-password')}>
                Forgotten Password?
              </span>
            </div>

            <div
  style={{
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  }}
>
  <input
    type={showPassword ? 'text' : 'password'}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    required
    style={{
      width: '100%',
      paddingRight: '45px'
    }}
  />

  <img
    src={showPassword ? hideIcon : viewIcon}
    alt="toggle password"
    onClick={() => setShowPassword(!showPassword)}
    style={{
      position: 'absolute',
      top: '24%',
      right: '14px',
      width: '20px',
      height: '20px',
      cursor: 'pointer',
      
      transition: '0.2s'
    }}
  />
</div>

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Log in"}
            </button>

          </form>
        </div>
      </div>

    </div>
  );
}
