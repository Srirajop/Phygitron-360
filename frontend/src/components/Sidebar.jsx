import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Users, Upload, CheckSquare, BookOpen, Briefcase, Settings,
  LogOut, BarChart2, PlusCircle, FileText, Award, Map, Target,
  Layers, UserCheck, Home, Cpu
} from 'lucide-react';
import toast from 'react-hot-toast';

const roleNavItems = {
  hr: [
    { section: 'Source', items: [
      { to: '/source', label: 'Talent Vault', icon: Users },
      { to: '/source/active', label: 'Active Candidates', icon: UserCheck },
      { to: '/source/upload', label: 'Upload Resumes', icon: Upload },
    ]},
    { section: 'Verify', items: [
      { to: '/verify/manage', label: 'Assessments', icon: CheckSquare },
      { to: '/verify/build', label: 'Build Assessment', icon: PlusCircle },
    ]},
    { section: 'Deploy', items: [
      { to: '/deploy', label: 'Employees', icon: Briefcase },
      { to: '/deploy/skill-map', label: 'Skill Map', icon: Map },
      { to: '/deploy/projects', label: 'Project Match', icon: Target },
      { to: '/deploy/analytics', label: 'Analytics', icon: BarChart2 },
    ]},
    { section: 'Forge', items: [
      { to: '/forge', label: 'Learning Hub', icon: BookOpen },
    ]},
  ],
  admin: [
    { section: 'Platform', items: [
      { to: '/admin/users', label: 'User Management', icon: Users },
      { to: '/admin/org-settings', label: 'Org Settings', icon: Settings },
    ]},
    { section: 'Source', items: [
      { to: '/source', label: 'Talent Vault', icon: Users },
      { to: '/source/active', label: 'Active Candidates', icon: UserCheck },
      { to: '/source/upload', label: 'Upload Resumes', icon: Upload },
    ]},
    { section: 'Verify', items: [
      { to: '/verify/manage', label: 'Assessments', icon: CheckSquare },
    ]},
    { section: 'Deploy', items: [
      { to: '/deploy', label: 'Employees', icon: Briefcase },
      { to: '/deploy/skill-map', label: 'Skill Map', icon: Map },
      { to: '/deploy/analytics', label: 'Analytics', icon: BarChart2 },
    ]},
    { section: 'Forge', items: [
      { to: '/forge', label: 'Courses', icon: BookOpen },
    ]},
  ],
  candidate: [
    { section: 'My Account', items: [
      { to: '/verify/dashboard', label: 'My Assessments', icon: CheckSquare },
      { to: '/forge', label: 'Learning', icon: BookOpen },
      { to: '/forge/transcript', label: 'My Transcript', icon: Award },
    ]},
  ],
  employee: [
    { section: 'My Account', items: [
      { to: '/forge', label: 'Learning Hub', icon: BookOpen },
      { to: '/forge/transcript', label: 'My Transcript', icon: Award },
      { to: '/deploy/my-profile', label: 'My Profile', icon: UserCheck },
      { to: '/verify/dashboard', label: 'Assessments', icon: CheckSquare },
    ]},
  ],
  manager: [
    { section: 'Team', items: [
      { to: '/deploy', label: 'My Team', icon: Users },
      { to: '/forge/team', label: 'Team Learning', icon: BookOpen },
      { to: '/deploy/analytics', label: 'Analytics', icon: BarChart2 },
    ]},
  ],
  instructor: [
    { section: 'Forge', items: [
      { to: '/forge', label: 'My Courses', icon: BookOpen },
      { to: '/forge/build', label: 'Build Course', icon: PlusCircle },
    ]},
  ],
};

const roleLabel = {
  hr: 'HR / Recruiter', admin: 'Platform Admin', candidate: 'Candidate',
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

  const navItems = roleNavItems[user?.role] || [];
  const initials = (user?.full_name || user?.email || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">P3</div>
        <div>
          <div className="sidebar-logo-text">PHYGITRON 360</div>
          <div className="sidebar-logo-sub">EwandZDigital</div>
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
