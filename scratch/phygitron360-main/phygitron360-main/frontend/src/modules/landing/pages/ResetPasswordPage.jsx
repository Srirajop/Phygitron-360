import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Lock, Command, ArrowRight, Zap, CheckCircle } from 'lucide-react';
import hideIcon from "../../../assets/hide.png";
import viewIcon from "../../../assets/view.png";
import { validatePassword } from '../../../core/utils/validators';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenChecking, setTokenChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const queryParams = new URLSearchParams(location.search);
  const token = queryParams.get('token');

  useEffect(() => {
    if (!token) {
        setError('No access token provided.');
        setTokenChecking(false);
        return;
    }
    
    // Check token validity
    fetch('/api/auth/verify-reset-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
    })
    .then(res => res.json())
    .then(data => {
        if (data.valid) {
            setTokenValid(true);
        } else {
            setError('Invalid or expired token.');
        }
    })
    .catch(() => setError('Connection failed.'))
    .finally(() => setTokenChecking(false));

  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
        setError('Key mismatch.');
        return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
        setError(passwordError);
        return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.detail || 'Reset failed');
      setSuccess(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#040812] text-white flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 z-0 h-full w-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-[#CC97FF]/10 blur-[150px] rounded-full animate-pulse opacity-40 will-change-transform" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Portal Branding */}
        <div className="mb-12 flex flex-col items-center">
          <div onClick={() => navigate('/')} className="cursor-pointer w-16 h-16 bg-primary flex items-center justify-center rounded-2xl shadow-[0_0_40px_rgba(204,151,255,0.4)] mb-6 transition-all hover:scale-110">
             <Command className="text-black" size={32} />
          </div>
          <h1 className="text-3xl font-display font-extrabold tracking-tighter uppercase mb-2">Phygitron <span className="text-primary">360</span></h1>
        </div>

        <div className="glass-panel p-1 border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
          <div className="bg-[#0B1326]/60 backdrop-blur-3xl rounded-[22px] p-10">
            {tokenChecking ? (
                 <div className="text-center py-8">
                     <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                     <p className="text-[10px] text-white/50 uppercase tracking-widest">Verifying Link...</p>
                 </div>
            ) : !tokenValid && !success ? (
               <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-error/10 text-error border border-error/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Zap size={32} />
                  </div>
                  <h2 className="text-2xl font-display font-extrabold text-white mb-2 uppercase">Access Denied</h2>
                  <p className="text-[12px] text-white/50 pb-6 uppercase tracking-widest leading-relaxed">
                     {error}
                  </p>
                  <button onClick={() => navigate('/login')} className="w-full bg-white/5 text-white font-extrabold text-[11px] uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-white/10 transition-all border border-white/5">
                    Return to Matrix
                  </button>
               </div>
            ) : success ? (
               <div className="text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={32} />
                  </div>
                  <h2 className="text-2xl font-display font-extrabold text-white mb-2 uppercase">Key Updated</h2>
                  <p className="text-[12px] text-white/50 pb-6 uppercase tracking-widest leading-relaxed">
                     Your security matrix has been updated.
                  </p>
                  <button onClick={() => navigate('/login')} className="w-full bg-primary text-black font-extrabold text-[11px] uppercase tracking-[0.2em] py-5 rounded-2xl hover:bg-primary/80 transition-all">
                    Initialize Login
                  </button>
               </div>
            ) : (
               <>
                 <div className="mb-10">
                    <h2 className="text-2xl font-display font-extrabold text-white mb-2 uppercase">Update Matrix</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#CC97FF] opacity-70">Enter New Security Key</p>
                 </div>

                 {error && (
                   <div className="mb-8 rounded-2xl bg-error/10 p-4 text-xs text-[#FFB4AB] border border-error/20 flex gap-3 items-center animate-shake">
                      <Zap size={16} /> {error}
                   </div>
                 )}

                 <form onSubmit={handleSubmit} className="space-y-6">
                   <div>
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">New Key</label>
                     <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" size={18} />
                       <input
                         type={showPassword ? 'text' : 'password'}
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         className="w-full rounded-2xl border border-white/5 bg-white/5 py-4 pl-12 pr-4 text-white placeholder-white/20 transition-all focus:border-primary/40 focus:bg-white/10 outline-none font-medium text-sm"
                         placeholder="••••••••"
                         required
                       />
                       <img
  src={showPassword ? hideIcon : viewIcon}
  alt=""
  onClick={() => setShowPassword(!showPassword)}
  style={{
    position: 'absolute',
    right: '16px',
    top: '45%',
    transform: 'translateY(-50%)',
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    opacity: 0.7
  }}
/>
                     </div>
                   </div>

                   <div>
                     <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3 ml-1">Confirm Key</label>
                     <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant opacity-40" size={18} />
                       <input
                         type={showConfirmPassword ? 'text' : 'password'}
                         value={confirmPassword}
                         onChange={(e) => setConfirmPassword(e.target.value)}
                         className="w-full rounded-2xl border border-white/5 bg-white/5 py-4 pl-12 pr-4 text-white placeholder-white/20 transition-all focus:border-primary/40 focus:bg-white/10 outline-none font-medium text-sm"
                         placeholder="••••••••"
                         required
                       />
                       <img
  src={showConfirmPassword ? hideIcon : viewIcon}
  alt=""
  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
  style={{
    position: 'absolute',
    right: '16px',
    top: '45%',
    transform: 'translateY(-50%)',
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    opacity: 0.7
  }}
/>
                     </div>
                   </div>

                   <button
                     type="submit"
                     disabled={loading}
                     className="w-full bg-primary text-black font-extrabold text-[11px] uppercase tracking-[0.2em] py-5 rounded-2xl shadow-[0_10px_30px_rgba(204,151,255,0.3)] hover:bg-white hover:shadow-white/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                   >
                     {loading ? 'Processing...' : 'Reset Password'}
                     <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                   </button>
                 </form>
               </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
