import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/auth/AuthContext';
import PerformancePanel from '../components/PerformancePanel';
import AssetsPanel from '../components/AssetsPanel';
import OnboardingPanel from '../components/OnboardingPanel';
import EmployeeDashboard from '../components/EmployeeDashboard';
import AttendancePanel from '../components/AttendancePanel';
import DeployAnalytics from '../components/DeployAnalytics';
import EmployeeDirectory from '../components/EmployeeDirectory';
import MyProfile from '../components/MyProfile';
import EmployeeProfileFull from '../components/EmployeeProfileFull';
import PayrollPanel from '../components/PayrollPanel';
import MyPayrollPanel from '../components/MyPayrollPanel';
import InternalOpportunitiesPanel from '../components/InternalOpportunitiesPanel';
import "../styles/deploy.css";

import logo from "../../../assets/phy360.png";
import bellIcon from "../../../assets/bell.png";
import logoutIcon from "../../../assets/exit.png";

import { getHubTabs } from "../../../core/navigation/hubTabs";

export default function DeployDashboard() {

  const { user, hasPermission, hasRole, logout } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);

  /* =========================================
     ROLE / VIEW CONTROL
  ========================================= */

  const isOrgAdmin =
    hasPermission?.('deploy.dashboard.view_admin');

  const [deployView, setDeployView] = useState(
    isOrgAdmin ? 'management' : 'employee'
  );

  const panelMode =
  deployView === 'management'
    ? 'admin'
    : 'employee';

  /* =========================================
     MODULES
  ========================================= */

  const modules = getHubTabs({ hasPermission, hasRole });

  /* =========================================
     PERMISSIONS
  ========================================= */

  const canViewDashboard =
    hasPermission?.('deploy.dashboard.view_admin') ||
    hasPermission?.('module.deploy.access');

  const canViewProfile =
    hasPermission?.('deploy.employees.view') ||
    hasPermission?.('module.deploy.access');

  const canViewAttendance =
    hasPermission?.('deploy.attendance.view_team') ||
    hasPermission?.('module.deploy.access');

  const canManagePayroll =
    hasPermission?.('deploy.payroll.manage');

  const canViewPayroll =
    hasPermission?.('deploy.payroll.view') ||
    hasPermission?.('module.deploy.access');

  /* =========================================
     NAVIGATION
  ========================================= */

  const currentTab =
    params.get('tab') || 'dashboard';

  const setTab = (tab) =>
    navigate(`/deploy?tab=${tab}`);

  const displayName =
    user?.name ||
    user?.email?.split('@')[0] ||
    "User";

  // Dynamic role display based on current view
  const getRoleDisplay = () => {
    // In employee/personal view, always show Employee Workspace
    if (deployView === 'employee') {
      return 'Employee Workspace';
    }
    
    // In management view, show actual management role
    if (deployView === 'management') {
      if (hasRole?.('super_admin')) return 'Super Admin';
      if (hasRole?.('org_admin')) return 'Organisation Admin';
      if (hasRole?.('manager')) return 'Manager';
      return 'Employee Workspace';
    }
    
    // Fallback
    return hasRole?.('super_admin')
      ? 'Super Admin'
      : hasRole?.('org_admin')
      ? 'Organisation Admin'
      : hasRole?.('manager')
      ? 'Manager Workspace'
      : 'Employee Workspace';
  };

  useEffect(() => {
    if (
      deployView === 'employee' &&
      (currentTab === 'assets' || currentTab === 'onboard')
    ) {
      navigate('/deploy?tab=dashboard');
    }
  }, [deployView, currentTab, navigate]);

  return (

    <div className="dashboard-page">

      {/* =========================================
          TOPBAR
      ========================================= */}

      <div className="topbar">

        <div className="top-left">
          <img
            src={logo}
            className="logo"
            alt="logo"
          />
        </div>

        <div className="top-center">

          <div className="hub-tabs">

            {modules.map((m) => (

              <button
                key={m.id}
                className={`hub-tab ${
                  location.pathname.startsWith(m.path)
                    ? "active"
                    : ""
                }`}
                onClick={() => navigate(m.path)}
              >
                {m.name}
              </button>

            ))}

          </div>

        </div>

        <div className="top-right">

          <img
            src={bellIcon}
            className="icon"
            alt="bell"
          />

          <img
            src={logoutIcon}
            className="icon logout-icon"
            alt="logout"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          />

          <div className="profile-wrap">

            <div className="avatar">
              {displayName?.charAt(0)?.toUpperCase()}
            </div>

            <div className="profile-text">

              <h4>{displayName}</h4>

              <p>
                {getRoleDisplay()}
              </p>

            </div>

          </div>

        </div>

      </div>

      {/* =========================================
          BODY
      ========================================= */}

      <div className="dashboard-body">

        {/* =========================================
            SIDEBAR
        ========================================= */}

        <div className="sidebar">

          {/* VIEW TOGGLE */}

          {isOrgAdmin && (

            <div
              className="
                w-full
                flex
                bg-[#f3f0ff]
                p-1
                rounded-2xl
                border
                border-[#ebe4ff]
                mb-6
                overflow-hidden
              "
            >

              <button
                className={`
                  flex-1
                  py-2.5
                  rounded-xl
                  text-[13px]
                  font-bold
                  transition-all
                  ${
                    deployView === 'management'
                      ? '!bg-black !text-white shadow-md'
                      : 'text-black/60 hover:bg-white'
                  }
                `}
                onClick={() =>
                  setDeployView('management')
                }
              >
                Management
              </button>

              <button
                className={`
                  flex-1
                  py-2.5
                  rounded-xl
                  text-[13px]
                  font-bold
                  transition-all
                  ${
                    deployView === 'employee'
                      ? '!bg-black !text-white shadow-md'
                      : 'text-black/60 hover:bg-white'
                  }
                `}
                onClick={() =>
                  setDeployView('employee')
                }
              >
                Personal
              </button>

            </div>

          )}

          {/* MANAGEMENT NAV */}

          {deployView === 'management' ? (

            <>

              <button
                className={currentTab === 'dashboard' ? 'active' : ''}
                onClick={() => setTab('dashboard')}
              >
                Analytics
              </button>

              <button
                className={currentTab === 'personnel' ? 'active' : ''}
                onClick={() => setTab('personnel')}
              >
                Personnel
              </button>

              <button
                className={currentTab === 'attendance' ? 'active' : ''}
                onClick={() => setTab('attendance')}
              >
                Attendance
              </button>

              <button
                className={currentTab === 'performance' ? 'active' : ''}
                onClick={() => setTab('performance')}
              >
                Performance
              </button>

              <button
                className={currentTab === 'assets' ? 'active' : ''}
                onClick={() => setTab('assets')}
              >
                Assets
              </button>

              <button
                className={currentTab === 'onboard' ? 'active' : ''}
                onClick={() => setTab('onboard')}
              >
                Onboarding
              </button>

              {canManagePayroll && (
                <button
                  className={currentTab === 'payroll' ? 'active' : ''}
                  onClick={() => setTab('payroll')}
                >
                  Payroll
                </button>
              )}

            </>

          ) : (

            <>
              {/* EMPLOYEE NAV */}

              <button
                className={currentTab === 'dashboard' ? 'active' : ''}
                onClick={() => setTab('dashboard')}
              >
                Dashboard
              </button>

              <button
                className={currentTab === 'profile' ? 'active' : ''}
                onClick={() => setTab('profile')}
              >
                My Profile
              </button>

              <button
                className={currentTab === 'attendance' ? 'active' : ''}
                onClick={() => setTab('attendance')}
              >
                My Attendance
              </button>

              <button
                className={currentTab === 'performance' ? 'active' : ''}
                onClick={() => setTab('performance')}
              >
                My Performance
              </button>
              
              <button
                className={currentTab === 'opportunities' ? 'active' : ''}
                onClick={() => setTab('opportunities')}
              >
                My Opportunities
              </button>

              {canViewPayroll && (
                <button
                  className={currentTab === 'payroll' ? 'active' : ''}
                  onClick={() => setTab('payroll')}
                >
                  My Payroll
                </button>
              )}

            </>

          )}

        </div>

        {/* =========================================
            CONTENT
        ========================================= */}

        <div className="content">

  {/* =========================================
    DASHBOARD
========================================= */}

{deployView === 'management' &&
  currentTab === 'dashboard' &&
  canViewDashboard && (

  <DeployAnalytics
    key="management-dashboard"
    mode={panelMode}
    user={user}
  />

)}

{deployView === 'employee' &&
  currentTab === 'dashboard' &&
  canViewDashboard && (

  <EmployeeDashboard
    key="employee-dashboard"
    mode="employee"
    user={user}
  />

)}


{/* =========================================
    MANAGEMENT PERSONNEL
========================================= */}

{deployView === 'management' &&
  currentTab === 'personnel' &&
  canViewProfile && (

  <EmployeeDirectory
    key="management-personnel"
  />

)}


{/* =========================================
    EMPLOYEE PROFILE
========================================= */}

{deployView === 'employee' &&
  currentTab === 'profile' && (

  <MyProfile
    key="employee-profile"
    mode="employee"
    user={user}
  />

)}

{/* =========================================
    MANAGEMENT PROFILE (Full View)
========================================= */}

{deployView === 'management' &&
  currentTab === 'profile' &&
  canViewProfile && (

  <EmployeeProfileFull
    key="management-profile-full"
    employeeCode={params.get('code')}
    onBack={() => setTab('personnel')}
  />

)}


{/* =========================================
    ATTENDANCE
========================================= */}

{currentTab === 'attendance' &&
  canViewAttendance && (

  <AttendancePanel
    key={`${deployView}-attendance`}
    mode={
      deployView === 'management'
        ? panelMode
        : 'employee'
    }
    user={user}
  />

)}


{/* =========================================
    PERFORMANCE
========================================= */}

{currentTab === 'performance' && (

  <PerformancePanel
    key={`${deployView}-performance`}
    isAdmin={deployView === 'management'}
    mode={
      deployView === 'management'
        ? panelMode
        : 'employee'
    }
    user={user}
  />

)}

          {/* ASSETS */}

          {currentTab === 'assets' && deployView === 'management' && (

            <AssetsPanel
              mode={panelMode}
              user={user}
            />

          )}

          {/* ONBOARDING */}

          {currentTab === 'onboard' && deployView === 'management' && (

            <OnboardingPanel
              mode={panelMode}
              user={user}
              isAdmin={panelMode === 'admin'}
            />

          )}

          {/* PAYROLL — ADMIN/MANAGER */}
          {currentTab === 'payroll' && deployView === 'management' && canManagePayroll && (
            <PayrollPanel
              key="management-payroll"
              mode={panelMode}
              user={user}
            />
          )}

          {/* PAYROLL — EMPLOYEE */}
          {currentTab === 'payroll' && deployView === 'employee' && canViewPayroll && (
            <MyPayrollPanel
              key="employee-payroll"
              user={user}
            />
          )}

          {/* OPPORTUNITIES — EMPLOYEE */}
          {currentTab === 'opportunities' && deployView === 'employee' && (
            <InternalOpportunitiesPanel
              key="employee-opportunities"
              user={user}
            />
          )}

        </div>

      </div>
</div>
    
  );
}
