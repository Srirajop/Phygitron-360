import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users, Upload, CheckSquare, BookOpen, Briefcase, Settings,
  LogOut, BarChart2, PlusCircle, FileText, Award, Map, Target,
  Layers, UserCheck, Home, Cpu, Milestone, Clock, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';

const roleNavItems = {
  super_admin: [
    { section: 'Platform', module: 'platform', items: [
      { to: '/platform/dashboard', label: 'Platform Stats', icon: BarChart2 },
      { to: '/platform/orgs', label: 'Organisations', icon: Layers },
      { to: '/platform/settings', label: 'Global Settings', icon: Settings },
    ]}
  ],
  hr: [
    { section: 'Source', module: 'source', items: [
      { to: '/source/upload', label: 'Upload Resumes', icon: Upload },
      { to: '/source', label: 'Talent Vault', icon: Users },
      { to: '/source/active', label: 'Active Candidates', icon: UserCheck },
      { to: '/source/offers', label: 'Offer Approvals', icon: FileText },
    ]},
    { section: 'Verify', module: 'verify', items: [
      { to: '/verify/manage', label: 'Assessments', icon: CheckSquare },
    ]},
    { section: 'Employees', module: 'deploy', items: [
      { to: '/deploy', label: 'Directory', icon: Briefcase },
      { to: '/deploy/attendance', label: 'Attendance', icon: Clock },
      { to: '/deploy/skill-map', label: 'Skills', icon: Map },
      { to: '/deploy/analytics', label: 'Analytics', icon: BarChart2 },
    ]},
    { section: 'Learning', module: 'forge', items: [
      { to: '/forge', label: 'Dashboard', icon: BookOpen },
      { to: '/forge/library', label: 'Learning Paths', icon: Layers },
      { to: '/forge/my-courses', label: 'Course Builder', icon: FileText },
      { to: '/forge/build', label: 'Studio', icon: PlusCircle },
    ]},
  ],
  org_admin: [
    { section: 'Source', module: 'source', items: [
      { to: '/source/upload', label: 'Upload Resumes', icon: Upload },
      { to: '/source', label: 'Talent Vault', icon: Users },
      { to: '/source/active', label: 'Active Candidates', icon: UserCheck },
      { to: '/source/offers', label: 'Offer Approvals', icon: FileText },
    ]},
    { section: 'Verify', module: 'verify', items: [
      { to: '/verify/manage', label: 'Assessments', icon: CheckSquare },
    ]},
    { section: 'Employees', module: 'deploy', items: [
      { to: '/deploy', label: 'Directory', icon: Briefcase },
      { to: '/deploy/attendance', label: 'Attendance', icon: Clock },
      { to: '/admin/users', label: 'Users', icon: Users },
      { to: '/deploy/skill-map', label: 'Skills', icon: Map },
      { to: '/admin/roles', label: 'Role Management', icon: Shield },
      { to: '/admin/org-settings', label: 'Settings', icon: Settings },
      { to: '/deploy/analytics', label: 'Analytics', icon: BarChart2 },
    ]},
    { section: 'Learning', module: 'forge', items: [
      { to: '/forge', label: 'Dashboard', icon: BookOpen },
      { to: '/forge/library', label: 'Learning Paths', icon: Layers },
      { to: '/forge/my-courses', label: 'Course Builder', icon: FileText },
      { to: '/forge/build', label: 'Studio', icon: PlusCircle },
    ]},
  ],
  candidate: [
    { section: 'Verify', module: 'verify', items: [
      { to: '/verify/dashboard', label: 'My Assessments', icon: CheckSquare },
    ]},
    { section: 'Learning', module: 'forge', items: [
      { to: '/forge', label: 'Dashboard', icon: BookOpen },
      { to: '/forge/transcript', label: 'My Transcript', icon: Award },
    ]},
  ],
  employee: [
    { section: 'Employees', module: 'deploy', items: [
      { to: '/deploy/my-profile', label: 'My Profile', icon: UserCheck },
      { to: '/deploy/attendance', label: 'Attendance', icon: Clock },
    ]},
    { section: 'Verify', module: 'verify', items: [
      { to: '/verify/dashboard', label: 'My Assessments', icon: CheckSquare },
    ]},
    { section: 'Learning', module: 'forge', items: [
      { to: '/forge', label: 'Dashboard', icon: BookOpen },
      { to: '/forge/transcript', label: 'My Transcript', icon: Award },
    ]},
  ],
  manager: [
    { section: 'Source', module: 'source', items: [
      { to: '/source', label: 'Talent Vault', icon: Users },
      { to: '/source/active', label: 'Active Candidates', icon: UserCheck },
      { to: '/source/offers', label: 'Offer Approvals', icon: FileText },
    ]},
    { section: 'Verify', module: 'verify', items: [
      { to: '/verify/manage', label: 'Assessments', icon: CheckSquare },
    ]},
    { section: 'Employees', module: 'deploy', items: [
      { to: '/deploy', label: 'My Team', icon: Users },
      { to: '/source/offers', label: 'Offer Approvals', icon: FileText },
      { to: '/deploy/attendance', label: 'Attendance', icon: Clock },
      { to: '/deploy/analytics', label: 'Analytics', icon: BarChart2 },
    ]},
    { section: 'Learning', module: 'forge', items: [
      { to: '/forge/team', label: 'Team Learning', icon: BookOpen },
      { to: '/forge/library', label: 'Course Library', icon: Layers },
    ]},
  ],
  instructor: [
    { section: 'Learning', module: 'forge', items: [
      { to: '/forge', label: 'Dashboard', icon: BookOpen },
      { to: '/forge/library', label: 'Learning Paths', icon: Layers },
      { to: '/forge/my-courses', label: 'Course Builder', icon: FileText },
      { to: '/forge/build', label: 'Studio', icon: PlusCircle },
    ]},
  ],
};

const roleLabel = {
  super_admin: 'Super Admin', hr: 'HR / Recruiter', org_admin: 'Organisation Admin', candidate: 'Candidate',
  employee: 'Employee', manager: 'Manager', instructor: 'Instructor',
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const rawNavItems = roleNavItems[user?.role] || [];
  
  // Conditionally render nav sections based on user.modules
  // Super admin and org admin bypass module gates
  const bypassModuleGate = ['super_admin', 'org_admin'].includes(user?.role);
  const navItems = rawNavItems.filter(group => {
    if (!group.module) return true;
    if (bypassModuleGate) return true;
    return user?.modules?.includes(group.module);
  });

  const initials = (user?.full_name || user?.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">P3</div>
        <div>
          <div className="sidebar-logo-text">PHYGITRON 360</div>
          <div className="sidebar-logo-sub">{user?.org_name || 'Multi-Tenant'}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((group) => (
          <div className="sidebar-section" key={group.section}>
            <div className="sidebar-section-label">{group.section}</div>
            {group.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/source' || item.to === '/deploy' || item.to === '/forge'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} className="nav-icon" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-pill">
          <div className="user-avatar">{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name || user?.email}
            </div>
            <div className="user-role">{roleLabel[user?.role]}</div>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
