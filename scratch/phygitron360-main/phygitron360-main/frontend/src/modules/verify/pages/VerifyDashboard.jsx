import React from 'react';
import { Shield, Activity, CheckCircle } from 'lucide-react';
import { useAuth } from '../../../core/auth/AuthContext';
import { useLocation } from 'react-router-dom';

import ManageAssessments from './ManageAssessments';
import AssessmentBuilder from './AssessmentBuilder';
import AssessmentTaker from './AssessmentTaker';
import ResultScreen from './ResultScreen';
import AssessmentAnalytics from './AssessmentAnalytics';
import CandidateDashboard from './CandidateDashboard';
import QuestionBank from './QuestionBank';
import LiveMonitor from './LiveMonitor';
import { useNavigate } from 'react-router-dom';

import "../../../styles/light-theme-override.css";
import logo from "../../../assets/phy360.png";
import bellIcon from "../../../assets/bell.png";
import logoutIcon from "../../../assets/exit.png";
import { getHubTabs } from "../../../core/navigation/hubTabs";

export default function VerifyDashboard() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole(['org_admin', 'manager', 'assessor']);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasPermission, logout } = useAuth();
  const params = new URLSearchParams(location.search);
  const tab = params.get('tab') || (isAdmin ? 'manage' : 'candidate');
  const asmId = params.get('id');

  const setTab = (t) => navigate(`/verify?tab=${t}`);
  const displayName = user?.name || user?.email?.split('@')[0] || "User";

  const appModules = getHubTabs({ hasPermission, hasRole });

  // Dynamic role display based on actual user roles
  const getRoleDisplay = () => {
    if (hasRole?.('super_admin')) return 'Super Admin';
    if (hasRole?.('org_admin')) return 'Organisation Admin';
    if (hasRole?.('manager')) return 'Manager';
    if (hasRole?.('assessor')) return 'Assessor';
    return 'Employee';
  };

  const renderContent = () => {
    switch (tab) {
      case 'manage': return <ManageAssessments />;
      case 'builder': return <AssessmentBuilder />;
      case 'take': return <AssessmentTaker />;
      case 'result': return <ResultScreen />;
      case 'analytics': return <AssessmentAnalytics assessmentId={asmId} />;
      case 'bank': return <QuestionBank />;
      case 'live': return <LiveMonitor />;
      case 'candidate': return <CandidateDashboard />;
      default: return isAdmin ? <ManageAssessments /> : <CandidateDashboard />;
    }
  };

  // Check if we should show the header (only for manage tab)
  const showHeader = tab === 'manage' || (tab === 'candidate' && !isAdmin);

  return (
    <div className="dashboard-page light-theme-override" style={{ backgroundColor: '#FFFFFF' }}>
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
          .dashboard-body > .sidebar:not(:has(button)) {
            display: none !important;
          }
          .old-sidebar, 
          .sidebar-old,
          .sidebar:not(.verify-sidebar) {
            display: none !important;
          }
          .dashboard-body > .content {
            width: 100% !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            padding-left: 24px !important;
          }
          .fixed.inset-0.pointer-events-none {
            opacity: 0.15 !important;
          }
        `}</style>

        {/* New Sidebar */}
        <div className="sidebar verify-sidebar">
          {isAdmin && <button className={tab === 'manage' ? 'active' : ''} onClick={() => setTab('manage')}>Manage</button>}
          {isAdmin && <button className={tab === 'builder' ? 'active' : ''} onClick={() => setTab('builder')}>Builder</button>}
          {isAdmin && <button className={tab === 'bank' ? 'active' : ''} onClick={() => setTab('bank')}>Question Bank</button>}
          {isAdmin && <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Analytics</button>}
          {!isAdmin && <button className={tab === 'candidate' ? 'active' : ''} onClick={() => setTab('candidate')}>My Assessments</button>}
        </div>
        
        <div className="content" style={{ backgroundColor: '#FFFFFF', padding: '24px', flex: 1 }}>
          <div className="flex flex-col gap-6">
            {/* Header - Only shown in manage tab (or candidate tab for non-admin) */}
            {showHeader && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7c3aed] mb-3">ASSESSMENT CENTRAL</p>
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                      Skills Assessment
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                      Create, manage, and evaluate skills assessments for candidates and employees.
                    </p>
                  </div>
                  {isAdmin && (
                    <button 
                      onClick={() => setTab('builder')}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-colors duration-150 shadow-sm"
                    >
                      <Shield size={16} /> New Assessment
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="animate-fade-in-up transition-all delay-200">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}