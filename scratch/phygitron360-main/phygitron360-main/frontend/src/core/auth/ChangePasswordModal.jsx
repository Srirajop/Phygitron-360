import React, { useState } from 'react';
import { Lock, Zap, ArrowRight, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { validatePassword } from '../utils/validators';

export default function ChangePasswordModal({ onClose, forceUpdate = false }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from current password.');
      return;
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || data.detail || 'Failed to change password');
      
      toast.success('Password updated successfully.');
      if (onClose) onClose();
      else window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-100/80 backdrop-blur-md">
      <div className="relative z-10 w-full max-w-md animate-fade-in-up bg-white border border-[#CC97FF]/30 rounded-3xl p-8 shadow-[0_20px_60px_rgba(204,151,255,0.15)]">
        {!forceUpdate && (
          <button 
            onClick={onClose} 
            className="absolute top-6 right-6 p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        )}

        <div className="mb-8">
           <h2 className="text-2xl font-display font-extrabold text-black mb-2 uppercase">
              {forceUpdate ? 'Mandatory Reset' : 'Update Password'}
           </h2>
           <p className="text-[10px] font-bold uppercase tracking-widest text-[#B07CE8]">
              {forceUpdate ? 'You are required to set a new password.' : 'Enhance your account security.'}
           </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl bg-red-50 p-4 text-xs text-red-600 border border-red-200 flex gap-3 items-center animate-shake">
             <Zap size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 ml-1">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-4 pl-12 pr-4 text-black placeholder-gray-400 transition-all focus:border-[#CC97FF] focus:bg-white focus:ring-4 focus:ring-[#CC97FF]/10 outline-none font-medium text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 ml-1">New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-4 pl-12 pr-4 text-black placeholder-gray-400 transition-all focus:border-[#CC97FF] focus:bg-white focus:ring-4 focus:ring-[#CC97FF]/10 outline-none font-medium text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 ml-1">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-4 pl-12 pr-4 text-black placeholder-gray-400 transition-all focus:border-[#CC97FF] focus:bg-white focus:ring-4 focus:ring-[#CC97FF]/10 outline-none font-medium text-sm"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 bg-[#CC97FF] text-black font-extrabold text-[11px] uppercase tracking-[0.2em] py-5 rounded-2xl shadow-[0_10px_30px_rgba(204,151,255,0.4)] hover:bg-[#d6a8ff] hover:shadow-[0_10px_35px_rgba(204,151,255,0.6)] transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
          >
            {loading ? 'Processing...' : 'Update Password'}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      </div>
    </div>
  );
}
