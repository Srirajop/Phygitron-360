import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/login.css';
import loginImg from "../../../assets/login.png";
import { isEmail } from '../../../core/utils/validators';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
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

  const handleReset = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          workspace_id: workspaceId,
          action: "Dispatch Reset" // ✅ backend requirement
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Reset failed.');
      } else {
        alert("Reset link sent (if email exists)");
      }

    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">

      {/* LEFT IMAGE (UNCHANGED) */}
      <div className="login-left">
        <img src={loginImg} alt="login visual" />
      </div>

      {/* RIGHT FORM (MODIFIED ONLY THIS) */}
      <div className="login-right">
        <div className="login-box">

          {/* BACK */}
          <div className="back" onClick={() => navigate("/login")}>
            ←
          </div>

          <h2>Reset your account</h2>

          {error && (
            <div className="error-box">{error}</div>
          )}

          <form onSubmit={handleReset}>

            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Reset"}
            </button>

          </form>

        </div>
      </div>

    </div>
  );
}
