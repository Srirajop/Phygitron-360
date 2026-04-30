import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { onboardingApi } from '../../api';
import { 
  User, MapPin, Calendar, ShieldCheck, Mail, Briefcase, 
  ArrowRight, CheckCircle, Info, Lock, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SelfOnboarding() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [step, setStep] = useState(1); // 1: Verify, 2: Details, 3: Account, 4: Success
  
  const [formData, setFormData] = useState({
    dob: '',
    contact_number: '',
    current_address: '',
    password: '',
    confirm_password: ''
  });

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const res = await onboardingApi.verifyInvite(token);
      setInvite(res.data.data);
      setStep(2);
    } catch (err) {
      toast.error('Invalid or expired onboarding link.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 2) {
      if (!formData.dob || !formData.contact_number) {
        toast.error("Please fill in basic details.");
        return;
      }
      setStep(3);
    }
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    const tid = toast.loading("Finalizing your profile...");
    try {
      await onboardingApi.completeSetup({
        token,
        ...formData
      });
      toast.success("Welcome aboard!", { id: tid });
      setStep(4);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Setup failed", { id: tid });
    }
  };

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)' }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  if (!token || (!invite && step < 4)) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-main)', padding: 20 }}>
      <div className="card" style={{ maxWidth: 500, textAlign: 'center', padding: 40 }}>
        <div style={{ color: 'var(--danger)', marginBottom: 20 }}><Shield size={64} /></div>
        <h2>Invalid Access</h2>
        <p style={{ color: 'var(--text-muted)' }}>This onboarding link is either invalid, already used, or has expired.</p>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: 24 }}>Go to Login</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 640 }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ 
            width: 80, height: 80, borderRadius: 24, background: 'var(--primary)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            margin: '0 auto 24px', color: 'white',
            boxShadow: '0 8px 32px rgba(124,58,237,0.3)'
          }}>
            <User size={40} />
          </div>
          <h1>Welcome to {invite?.company_name || 'Your New Organization'}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>Let's get your professional profile ready.</p>
        </div>

        {/* Progress Tracker */}
        {step < 4 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
            {[2, 3].map(s => (
              <div key={s} style={{ 
                width: step === s ? 40 : 12, height: 12, borderRadius: 6, 
                background: step === s ? 'var(--primary)' : 'var(--border)', 
                transition: 'all 0.3s' 
              }} />
            ))}
          </div>
        )}

        {/* Step 2: Personal Details */}
        {step === 2 && (
          <div className="card animate-scale-in" style={{ padding: 32 }}>
            <h3 style={{ marginBottom: 24 }}>Step 1: Personal Dossier</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-control" value={invite.full_name} disabled style={{ background: 'var(--bg-main)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-control" value={invite.email} disabled style={{ background: 'var(--bg-main)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Date of Birth *</label>
                <input 
                  type="date" className="form-control" required
                  value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value})} 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Number *</label>
                <input 
                  type="tel" className="form-control" placeholder="+1 234 567 890" required
                  value={formData.contact_number} onChange={e => setFormData({...formData, contact_number: e.target.value})} 
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label">Current Residential Address</label>
                <textarea 
                  className="form-control" rows={3} placeholder="Full street address..."
                  value={formData.current_address} onChange={e => setFormData({...formData, current_address: e.target.value})}
                />
              </div>
            </div>

            <div style={{ marginTop: 32, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleNext} style={{ gap: 10, padding: '12px 32px' }}>
                Next: Security Setup <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Account Setup */}
        {step === 3 && (
          <form className="card animate-scale-in" style={{ padding: 32 }} onSubmit={handleFinalSubmit}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
               <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--primary-lightest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                 <Lock size={20} />
               </div>
               <h3 style={{ margin: 0 }}>Step 2: Secure Your Account</h3>
            </div>
            
            <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>Create a strong password to access your employee portal.</p>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password" required className="form-control" style={{ paddingLeft: 40 }}
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                />
                <ShieldCheck size={18} style={{ position: 'absolute', left: 12, top: 12, opacity: 0.5 }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 32 }}>
              <label className="form-label">Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type="password" required className="form-control" style={{ paddingLeft: 40 }}
                  value={formData.confirm_password} onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                />
                <ShieldCheck size={18} style={{ position: 'absolute', left: 12, top: 12, opacity: 0.5 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
               <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>Back</button>
               <button type="submit" className="btn btn-primary" style={{ padding: '12px 32px' }}>Complete Registration</button>
            </div>
          </form>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="card animate-fade-in" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ 
              width: 80, height: 80, borderRadius: '50%', background: 'var(--success)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              margin: '0 auto 24px', color: 'white',
              boxShadow: '0 8px 32px rgba(16,185,129,0.3)'
            }}>
              <CheckCircle size={48} />
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: 12 }}>You're all set!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginBottom: 40 }}>
              Your professional profile has been activated. You can now log in to the 360 portal.
            </p>
            <button className="btn btn-primary" style={{ width: '100%', padding: 16, fontSize: '1.1rem' }} onClick={() => navigate('/login')}>
              Go to Login Page
            </button>
          </div>
        )}

        {/* Help Footer */}
        {step < 4 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 40, padding: 20, background: 'rgba(59,130,246,0.05)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.1)' }}>
            <Info size={18} style={{ color: '#3B82F6' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#1E40AF' }}>
              <strong>Need Help?</strong> Contact your HR representative if you face any issues during the onboarding process.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
