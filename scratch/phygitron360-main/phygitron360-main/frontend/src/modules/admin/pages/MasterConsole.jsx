import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Database, School, ShieldCheck, Rocket, ArrowRight, 
  Activity, Plus, Users, LayoutDashboard, Globe, Zap, Clock 
} from 'lucide-react';
import { useAuth } from '../../../core/auth/AuthContext';
import { toast } from 'react-hot-toast';

export default function MasterConsole() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/dashboard/stats', { credentials: 'include' });
        const data = await res.json();
        setStats(data);
      } catch (err) {
        toast.error("Failed to load system data.");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const appWorkspaces = [
    {
      name: 'Source',
      path: '/source',
      desc: 'Candidate Sourcing Hub',
      icon: <Database size={24} />,
      color: '#CC97FF', // Luminous Purple
      stats: `${stats?.counts?.candidates || 0} Candidates Active`
    },
    {
      name: 'Forge',
      path: '/forge',
      desc: 'Learning Platform',
      icon: <School size={24} />,
      color: '#10B981', // Emerald
      stats: `89 Learning Paths`
    },
    {
      name: 'Verify',
      path: '/verify',
      desc: 'Assessment Hub',
      icon: <ShieldCheck size={24} />,
      color: '#F59E0B', // Amber
      stats: `${stats?.counts?.jobs || 0} Open Requisitions`
    },
    {
      name: 'Deploy',
      path: '/deploy',
      desc: 'Employee Management System',
      icon: <Rocket size={24} />,
      color: '#6366F1', // Indigo
      stats: `${stats?.counts?.active || 0} Deployed Users`
    },
  ].filter(app => {
    if (user?.role === 'super_admin') return true;
    return user?.modules_enabled?.includes(app.name.toLowerCase());
  });

  return (
    <div className="space-y-12 animate-fade-in-up">
      {/* Platform Hero Section */}
      <section className="relative">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-5xl font-display font-extrabold text-white tracking-tight mb-4">
              Intelligence <span className="text-primary">Console</span>
            </h1>
            <p className="text-lg text-on-surface-variant font-medium max-w-2xl leading-relaxed opacity-80">
              Phygitron 360 is operating normally. All systems are active across the {user?.username} domain.
            </p>
          </div>
          <div className="flex gap-4">
             <div className="px-6 py-4 glass-panel border-primary/20 flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-white">System 100% Healthy</span>
             </div>
          </div>
        </div>
      </section>

      {/* Cross-Platform Telemetry */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Candidates', value: stats?.counts?.candidates || 0, sub: 'Total Records', icon: Users, color: '#CC97FF' },
          { label: 'Active Users', value: stats?.counts?.active || 0, sub: 'Active Personnel', icon: Zap, color: '#10B981' },
          { label: 'Positions', value: stats?.counts?.designations || 0, sub: 'Designations', icon: ShieldCheck, color: '#F59E0B' },
          { label: 'Uptime', value: '99.9%', sub: 'SLA Active', icon: Clock, color: '#6366F1' },
        ].map((m, i) => (
          <div key={i} className="glass-panel p-8 flex flex-col justify-between h-40 group hover:border-white/20 transition-all">
            <div className="flex justify-between items-start">
               <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">{m.label}</span>
               <m.icon size={20} style={{ color: m.color }} className="group-hover:scale-110 transition-transform" />
            </div>
            <div>
               <p className="text-3xl font-display font-extrabold text-white mb-1 tracking-tight">{m.value}</p>
               <p className="text-[9px] font-extrabold text-on-surface-variant uppercase tracking-tighter opacity-60">{m.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Module Workspace Node Portals */}
      <section>
        <div className="flex items-center gap-3 mb-8">
           <LayoutDashboard className="text-primary" size={24} />
           <h2 className="text-2xl font-display font-bold text-white uppercase tracking-tight">Workspaces</h2>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {appWorkspaces.map((app, i) => (
            <div 
              key={i} 
              className="glass-panel p-10 group hover:border-primary/20 hover:-translate-y-0.5 transition-transform duration-200 flex flex-col justify-between aspect-square cursor-pointer overflow-hidden relative transform-gpu"
              onClick={() => navigate(app.path)}
            >
              <div className="relative z-10">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center mb-8 transition-all group-hover:scale-110" 
                  style={{ background: `${app.color}15`, color: app.color, border: `1px solid ${app.color}25` }}
                >
                  {app.icon}
                </div>
                <h3 className="text-2xl font-display font-extrabold text-white mb-3 uppercase tracking-tight">{app.name}</h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed mb-6 opacity-70">
                  {app.desc}
                </p>
              </div>
              
              <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant opacity-60">{app.stats}</span>
                </div>
                <div className="flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-2">
                  Synchronize <ArrowRight size={14} />
                </div>
              </div>
              
              <div className="absolute top-[-30px] right-[-30px] w-40 h-40 opacity-0 group-hover:opacity-100 transition-opacity blur-[32px] rounded-full pointer-events-none will-change-transform" style={{ background: `${app.color}15` }} />
            </div>
          ))}
        </div>
      </section>

      <div className="pb-12 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant opacity-20">
         Phygitron 360 Platform // Standard Mission Hub
      </div>
    </div>
  );
}
