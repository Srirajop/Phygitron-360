import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import { Bell, LogOut, ChevronRight, MessageSquare, Briefcase } from 'lucide-react';
import logo from '../../../assets/logo.png';
import InternalOpportunitiesPanel from '../../deploy/components/InternalOpportunitiesPanel';

// Simple URL to Link parser
function Linkify({ text }) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-bold">
              {part}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
}

export default function TraineeDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      const r = await fetch('/api/notifications', { credentials: 'include' });
      const d = await r.json();
      if (Array.isArray(d)) {
        setNotifications(d);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-primary/30 selection:text-primary">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-primary/20 blur-[120px] mix-blend-screen opacity-50 animate-pulse-slow"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-indigo/20 blur-[150px] mix-blend-screen opacity-50"></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Phygitron 360" className="h-8 object-contain drop-shadow-lg" />
          <div className="h-4 w-px bg-white/20 mx-2"></div>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Trainee Portal</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs">
              {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'T'}
            </div>
            <div className="hidden md:block text-right">
              <p className="text-xs font-bold text-white">{user?.full_name || user?.username || 'Trainee'}</p>
              <p className="text-[10px] uppercase tracking-widest text-primary/80">{user?.company_name || 'Phygitron 360'}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-white/40 hover:text-rose-400 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Welcome Banner */}
        <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tighter mb-4">
            Welcome, <span className="text-primary italic pr-2">{user?.full_name?.split(' ')[0] || user?.username || 'Trainee'}</span>
          </h1>
          <p className="text-white/60 text-sm max-w-xl leading-relaxed">
            Your candidate journey is now active. Check below for any assignments, interview links, or updates from the Talent Acquisition team.
          </p>
        </div>

        {/* Notifications Panel */}
        <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <Bell size={120} />
          </div>

          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-indigo/20 text-indigo flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Latest Updates</h2>
              <p className="text-xs text-white/40 font-bold uppercase tracking-widest">From HR & Management</p>
            </div>
          </div>

          <div className="space-y-4">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-white/40">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-xs font-bold uppercase tracking-widest">Syncing Dashboard...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-black/20 rounded-2xl border border-white/5">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-4">
                  <Bell size={24} />
                </div>
                <p className="text-sm font-bold text-white mb-2">You're all caught up!</p>
                <p className="text-xs text-white/40 max-w-xs leading-relaxed">
                  Your assigned courses, assessments, and interview updates will appear here soon.
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div key={notif.id} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-white/10 transition-all duration-300">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="text-base font-bold text-white">{notif.title}</h3>
                    <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest whitespace-nowrap bg-black/50 px-3 py-1 rounded-full">
                      {new Date(notif.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed font-medium">
                    <Linkify text={notif.message || ''} />
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Applications / Opportunities Panel */}
        <div className="mt-8">
          <InternalOpportunitiesPanel user={user} />
        </div>
      </main>
    </div>
  );
}
