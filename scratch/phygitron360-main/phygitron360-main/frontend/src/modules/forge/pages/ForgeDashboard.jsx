import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TrainingPanel from '../../deploy/components/TrainingPanel';
import { 
  Zap, BookOpen, Cpu, Sparkles, GraduationCap, Users, Award, 
  TrendingUp, Clock, CheckCircle, Plus, Search, Filter,
  ChevronRight, FileText, Briefcase
} from 'lucide-react';
import { useAuth } from '../../../core/auth/AuthContext';
import logo from "../../../assets/phy360.png";
import bellIcon from "../../../assets/bell.png";
import logoutIcon from "../../../assets/exit.png";
import { getHubTabs } from "../../../core/navigation/hubTabs";

export default function ForgeDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { hasRole, hasPermission, user, logout } = useAuth();
  const isAdmin = hasRole(['org_admin', 'manager', 'trainer']);
  
  const displayName = user?.name || user?.email?.split('@')[0] || "User";
  const appModules = getHubTabs({ hasPermission, hasRole });
  const currentTab = new URLSearchParams(location.search).get('tab') || 'home';

  // Get role display
  const getRoleDisplay = () => {
    if (hasRole?.('super_admin')) return 'Super Admin';
    if (hasRole?.('org_admin')) return 'Organisation Admin';
    if (hasRole?.('manager')) return 'Manager';
    if (hasRole?.('recruiter')) return 'Recruiter';
    if (hasRole?.('trainer')) return 'Trainer';
    return 'Employee';
  };

  const setTab = (tab) => navigate(`/forge?tab=${tab}`);

  // Sample data - used directly without API calls
  const stats = {
    activeModules: 48,
    enrolledEmployees: 156,
    certifications: 87,
    completionRate: 92,
    pendingAssignments: 23,
    totalTutorials: 24
  };

  const assignments = [
    { id: 1, employee: 'Sarah Johnson', program: 'Leadership Development', date: '2026-06-15', duration: '4 weeks', status: 'In Progress' },
    { id: 2, employee: 'Michael Chen', program: 'Technical Excellence', date: '2026-06-10', duration: '6 weeks', status: 'Not Started' },
    { id: 3, employee: 'Emma Williams', program: 'Project Management', date: '2026-06-05', duration: '8 weeks', status: 'Completed' },
  ];

  return (
    <div className="dashboard-page light-theme-override" style={{ backgroundColor: '#FFFFFF' }}>
      {/* Top Bar - Same as Talent Central */}
      <div className="topbar">
        <div className="top-left">
          <img src={logo} className="logo" alt="logo" />
        </div>
        <div className="top-center">
          <div className="hub-tabs">
            {appModules.map((m) => (
              <button
                key={m.id}
                className={`hub-tab ${location.pathname.startsWith(m.path) ? "active" : ""}`}
                onClick={() => navigate(m.path)}
              >
                {m.name}
              </button>
            ))}
          </div>
        </div>
        <div className="top-right">
          <img src={bellIcon} className="icon" alt="bell" />
          <img
            src={logoutIcon}
            className="icon logout-icon"
            alt="logout"
            onClick={() => { logout(); navigate('/login'); }}
          />
          <div className="profile-wrap">
            <div className="avatar">{displayName?.charAt(0)?.toUpperCase()}</div>
            <div className="profile-text">
              <h4>{displayName}</h4>
              <p>{getRoleDisplay()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-body" style={{ position: 'relative' }}>
        {/* Hide the old sidebar that appears from parent layout */}
        <style>{`
          /* Hide the old sidebar that appears from parent layout */
          .dashboard-body > .sidebar:not(:has(button)) {
            display: none !important;
          }
          /* If the old sidebar has a specific class, hide it */
          .old-sidebar, 
          .sidebar-old,
          .sidebar:not(.forge-sidebar) {
            display: none !important;
          }
          /* Make content take full width */
          .dashboard-body > .content {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            padding-left: 24px !important;
          }
          /* Reduce purple glow effect */
          .fixed.inset-0.pointer-events-none {
            opacity: 0.15 !important;
          }
        `}</style>

        {/* New Sidebar - Without Icons */}
        <div className="sidebar forge-sidebar">
          <button className={currentTab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>
            Dashboard
          </button>
          <button className={currentTab === 'courses' ? 'active' : ''} onClick={() => setTab('courses')}>
            Courses
          </button>
          <button className={currentTab === 'my-learning' ? 'active' : ''} onClick={() => setTab('my-learning')}>
            My Learning
          </button>
        </div>

        {/* Main Content */}
        <div className="content" style={{ backgroundColor: '#FFFFFF', padding: '24px', flex: 1 }}>
          <div className="flex flex-col gap-6">
            {/* Header */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7c3aed] mb-3">LEARNING CENTRAL</p>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                    Learning Forge
                  </h1>
                  <p className="text-sm text-gray-500 mt-1">
                    Create and manage learning paths, track employee progress, and build workforce capabilities.
                  </p>
                </div>
                {isAdmin && (
                  <button className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors duration-150 shadow-sm">
                    <Plus size={16} /> Assign Training
                  </button>
                )}
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 overflow-visible pt-2">
              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-200 border-t-4 border-t-purple-600 max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <GraduationCap size={20} className="text-purple-600" />
                  <span className="text-xs font-medium text-purple-600">Total</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-800">{stats.activeModules}</h2>
                <p className="text-sm text-gray-500 mt-1">Active Modules</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-200 border-t-4 border-t-amber-500 max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <Users size={20} className="text-amber-500" />
                  <span className="text-xs font-medium text-amber-500">Active</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-800">{stats.enrolledEmployees}</h2>
                <p className="text-sm text-gray-500 mt-1">Enrolled Employees</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-200 border-t-4 border-t-emerald-500 max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <Award size={20} className="text-emerald-500" />
                  <span className="text-xs font-medium text-emerald-500">Completed</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-800">{stats.certifications}</h2>
                <p className="text-sm text-gray-500 mt-1">Certifications</p>
              </div>

              <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-200 border-t-4 border-t-[#e731ad] max-w-xs">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp size={20} className="text-[#e731ad]" />
                  <span className="text-xs font-medium text-[#e731ad]">Progress</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-800">{stats.completionRate}%</h2>
                <p className="text-sm text-gray-500 mt-1">Completion Rate</p>
              </div>
            </div>

            {/* Main Content */}
            {isAdmin ? (
              <>
                {/* Admin View - Active Assignments Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                      <Briefcase size={16} className="text-purple-600" />
                      Active Assignments
                    </h3>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                          <Search size={14} />
                        </span>
                        <input
                          type="text"
                          placeholder="Search assignments..."
                          className="bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-1.5 text-sm text-gray-700 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                        />
                      </div>
                      <button className="p-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors">
                        <Filter size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Program</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {assignments.map((assignment) => (
                          <tr key={assignment.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-800">{assignment.employee}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{assignment.program}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{assignment.date}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">{assignment.duration}</td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1 rounded-lg text-xs font-medium border ${
                                assignment.status === 'Completed' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : assignment.status === 'In Progress'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                              }`}>
                                {assignment.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button className="text-purple-600 hover:text-purple-800 text-sm font-medium">
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Quick Action Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-purple-100 text-purple-600">
                        <FileText size={20} />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-700">Tutorials</h4>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.totalTutorials}</p>
                    <p className="text-sm text-gray-500 mt-1">Available tutorials</p>
                    <button className="mt-4 text-purple-600 text-sm font-medium hover:text-purple-700 flex items-center gap-1">
                      Browse all <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                        <Clock size={20} />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-700">Pending</h4>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.pendingAssignments}</p>
                    <p className="text-sm text-gray-500 mt-1">Awaiting completion</p>
                    <button className="mt-4 text-purple-600 text-sm font-medium hover:text-purple-700 flex items-center gap-1">
                      Review <ChevronRight size={14} />
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-lg transition-shadow duration-200">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                        <CheckCircle size={20} />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-700">Completed</h4>
                    </div>
                    <p className="text-2xl font-bold text-gray-800">{stats.certifications}</p>
                    <p className="text-sm text-gray-500 mt-1">Certifications earned</p>
                    <button className="mt-4 text-purple-600 text-sm font-medium hover:text-purple-700 flex items-center gap-1">
                      View all <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* Employee View */
              <div className="bg-white rounded-2xl p-16 border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 border border-purple-200">
                  <BookOpen size={40} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">Learning Portal</h2>
                  <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                    Your assigned learning paths are ready in the learning hub. 
                    Check back soon for new training content.
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="px-5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-2">
                    <Cpu size={14} className="text-purple-600" />
                    <span className="text-xs font-medium text-gray-600">AI-Curated Paths</span>
                  </div>
                  <div className="px-5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-600" />
                    <span className="text-xs font-medium text-gray-600">Zero-Latency Upload</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}