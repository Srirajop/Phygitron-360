import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import {
  Zap, Shield, Database, Send,
  Terminal, Layout as LayoutIcon,
  LogOut, Bell, Settings,
  ChevronRight, Command, Briefcase,
  Rocket, Layers, Activity, User, Globe,
  Cpu, Star, Home, Upload, Users,
  LayoutDashboard, BarChart3, Clock, Package
} from 'lucide-react';

import { useAuth } from '../core/auth/AuthContext';
import OrgAdminSetupModal from '../modules/deploy/components/OrgAdminSetupModal';
import { MODULE_CONFIG } from '../core/config/modules';


export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole, hasPermission, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [deployView, setDeployView] = useState('employee');

  // ✅ Detect admin dashboard (LIGHT MODE)
  const isAdminDashboard =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/deploy') ||
    location.pathname.startsWith('/source') ||
    location.pathname.startsWith('/verify') ||
    location.pathname.startsWith('/superadmin');

  // ✅ NEW: Check if we're on the Forge page - hide sidebar for Learning Central
  const isForgePage = location.pathname.startsWith('/forge');

  const canSwitchView = hasRole(['org_admin', 'manager', 'super_admin']);
  const hasAdminClearance = hasPermission('deploy.dashboard.view_admin');

  useEffect(() => {
    if (user) {
      setDeployView(hasAdminClearance ? 'admin' : 'employee');

      const fetchNotifs = async () => {
        try {
          const res = await fetch('/api/notifications', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json();
            setNotifications(data || []);
          }
        } catch { }
      };

      fetchNotifs();
    }
  }, [user, hasAdminClearance]);

  const markRead = async (id) => {
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch { }
  };

  const markAllRead = async () => {
    try {
      await fetch(`/api/notifications/read-all`, {
        method: 'POST',
        credentials: 'include',
      });
      setNotifications([]);
    } catch { }
  };



  // ===== MODULE CONFIG (UNCHANGED LOGIC) =====
  const allModules = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      path: '/admin',
      icon: LayoutDashboard,
      perm: 'admin.users.manage',
      options: [
        { label: 'Overview', icon: Home, search: '', default: true },
        { label: 'Users', icon: Shield, search: '?tab=users' },
        { label: 'Analytics', icon: BarChart3, search: '?tab=stats' },
      ],
    },
    {
      id: 'source',
      name: 'Source',
      path: '/source',
      icon: Database,
      perm: 'module.source.access',
      options: [
        { label: 'Home', icon: Home, search: '?tab=home', default: true },
        { label: 'Jobs', icon: Briefcase, search: '?tab=jobs' },
        { label: 'Directory', icon: Users, search: '?tab=directory' },
        { label: 'Upload Resume', icon: Upload, search: '?tab=upload' },
      ],
    },
    {
      id: 'forge',
      name: 'Forge',
      path: '/forge',
      icon: Zap,
      perm: 'module.forge.access',
      options: [
        { label: 'Academy', icon: Home, search: '?tab=academy', default: true },
        { label: 'Courses', icon: Layers, search: '?tab=courses' },
        { label: 'My Learning', icon: Star, search: '?tab=my-learning' },
      ],
    },
    {
      id: 'verify',
      name: 'Verify',
      path: '/verify',
      icon: Shield,
      perm: 'module.verify.access',
      options: [
        { label: 'Skill Check', icon: Home, search: '?tab=home', default: true },
        { label: 'Builder', icon: Cpu, search: '?tab=builder' },
        { label: 'Results', icon: Activity, search: '?tab=results' },
      ],
    },
    {
      id: 'deploy',
      name: 'Deploy',
      path: '/deploy',
      icon: Rocket,
      perm: 'module.deploy.access',
      options:
        deployView === 'admin'
          ? [
            { label: 'Analytics', icon: LayoutDashboard, search: '?tab=dashboard', default: true },
            { label: 'Personnel', icon: Users, search: '?tab=team' },
            { label: 'Assets', icon: Package, search: '?tab=allocations' },
          ]
          : [
            { label: 'Dashboard', icon: LayoutDashboard, search: '?tab=my-dashboard', default: true },
            { label: 'My Profile', icon: User, search: '?tab=my-profile' },
            { label: 'Attendance', icon: Clock, search: '?tab=my-attendance' },
          ],
    },
  ];

  const modules = [
    ...(hasPermission('admin.users.manage') ? [{
      id: 'dashboard',
      name: 'Dashboard',
      path: '/admin',
      icon: LayoutDashboard,
      options: allModules.find(m => m.id === 'dashboard').options,
    }] : []),

    ...allModules
      .filter(m => m.id !== 'dashboard' && hasPermission(m.perm))
      .map(m => ({
        id: m.id,

        name:
          m.id === 'source'
            ? 'Talent Central'
            : m.id === 'forge'
              ? 'Learning Central'
              : m.id === 'verify'
                ? 'Assessment Central'
                : m.id === 'deploy'
                  ? 'Employee Central'
                  : m.name,

        path: m.path,

        // THIS WAS MISSING
        icon: m.icon,

        options: m.options,
      })),
  ];

  const activeModule =
    modules.find(m => location.pathname.startsWith(m.path)) || modules[0];

  const filteredOptions = activeModule?.options || [];

  // ===================== RENDER =====================

  return (
    <div
      className={`flex h-screen w-full ${isAdminDashboard ? 'bg-white text-black' : 'bg-[#040812] text-white'
        }`}
    >
      {/* ================= DARK SIDEBARS (DISABLED FOR ADMIN AND FORGE) ================= */}
      {!isAdminDashboard && !isForgePage && (
        <>
          {/* PRIMARY SIDEBAR */}
          <aside className="w-[88px] flex flex-col items-center py-8 bg-[#060E20] border-r border-white/5">
            <div
              onClick={() => navigate('/')}
              className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mb-10 cursor-pointer"
            >
              <Command size={24} />
            </div>

            <nav className="flex-1 flex flex-col gap-6">
              {modules.map((m) => (
                <Link
                  key={m.id}
                  to={m.path}
                  className="w-14 h-14 flex items-center justify-center rounded-xl hover:bg-white/10"
                >
                  <m.icon size={20} />
                </Link>
              ))}
            </nav>

            <button onClick={logout} className="mt-auto mb-6">
              <LogOut size={20} />
            </button>
          </aside>

          {/* SECOND SIDEBAR */}
          <aside className="w-[260px] bg-[#060E20]/60 border-r border-white/5 p-6">
            <h2 className="text-lg font-bold mb-6">{activeModule?.name}</h2>

            {filteredOptions.map((opt, i) => (
              <div
                key={i}
                onClick={() => navigate(`${activeModule.path}${opt.search}`)}
                className="p-3 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                {opt.label}
              </div>
            ))}
          </aside>
        </>
      )}

      {/* ================= MAIN CONTENT ================= */}
      <main className={`flex-1 overflow-auto ${isForgePage ? 'w-full' : ''}`}>
        {children}
      </main>

      {/* ================= BACKGROUND GLOW (DISABLED FOR ADMIN) ================= */}
      {!isAdminDashboard && (
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-purple-500/10 blur-3xl rounded-full" />
        </div>
      )}

      {/* ================= MODAL ================= */}
      {user?.role === 'org_admin' && !user?.employee_code && (
        <OrgAdminSetupModal user={user} onComplete={() => refreshUser()} />
      )}
    </div>
  );
}