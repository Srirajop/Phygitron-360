import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import TopHeader from './components/TopHeader';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#dc2626' }}>
          <h2>React Crash</h2>
          <p>{this.state.error?.toString()}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.errorInfo?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Sidebar from './components/Sidebar';

// Source (HR)
import SourceDashboard from './pages/source/SourceDashboard';
import ActiveCandidates from './pages/source/ActiveCandidates';
import ResumeUpload from './pages/source/ResumeUpload';
import CandidateProfile from './pages/source/CandidateProfile';
import InviteStatus from './pages/source/InviteStatus';
import OfferApprovals from './pages/source/OfferApprovals';

// Verify
import CandidateDashboard from './pages/verify/CandidateDashboard';
import AssessmentTaker from './pages/verify/AssessmentTaker';
import ResultScreen from './pages/verify/ResultScreen';
import Leaderboard from './pages/verify/Leaderboard';
import AssessmentBuilder from './pages/verify/AssessmentBuilder';
import ManageAssessments from './pages/verify/ManageAssessments';
import AssessmentAnalytics from './pages/verify/AssessmentAnalytics';

// Forge
import ForgeDashboard from './pages/forge/ForgeDashboard';
import CoursePlayer from './pages/forge/CoursePlayer';
import CourseBuilder from './pages/forge/CourseBuilder';
import CourseLibrary from './pages/forge/CourseLibrary';
import MyCourses from './pages/forge/MyCourses';
import Transcript from './pages/forge/Transcript';
import TeamAnalytics from './pages/forge/TeamAnalytics';

// Deploy
import EmployeeList from './pages/deploy/EmployeeList';
import EmployeeProfile from './pages/deploy/EmployeeProfile';
import AddEmployee from './pages/deploy/AddEmployee';
import SkillMap from './pages/deploy/SkillMap';
import ProjectMatching from './pages/deploy/ProjectMatching';
import WorkforceAnalytics from './pages/deploy/WorkforceAnalytics';
import MyProfile from './pages/deploy/MyProfile';
import Attendance from './pages/deploy/Attendance';
import SelfOnboarding from './pages/deploy/SelfOnboarding';

// Admin
import UserManagement from './pages/admin/UserManagement';
import OrgSettings from './pages/admin/OrgSettings';
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard';
import OrgManagement from './pages/admin/OrgManagement';
import RoleManagement from './pages/admin/RoleManagement';

// Journey
import AdminJourneys from './pages/journey/AdminJourneys';
import UserJourney from './pages/journey/UserJourney';

const ROLE_HOME = {
  super_admin: '/platform/dashboard',
  candidate: '/verify/dashboard',
  employee: '/forge',
  hr: '/source',
  instructor: '/forge/my-courses',
  manager: '/deploy',
  org_admin: '/source',
};

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner spinner-lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  // Super admin bypasses all role checks
  if (user.role === 'super_admin') return children;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  return children;
}

function ModuleGate({ children, module }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  // Super admin and org admin bypass module gates as they need to manage things
  if (['super_admin', 'org_admin'].includes(user.role)) return children;
  if (!user.modules?.includes(module)) {
    return <Navigate to={ROLE_HOME[user.role] || '/'} replace />;
  }
  return children;
}

function AppLayout({ children }) {
  return (
    <ErrorBoundary>
      <div className="layout">
        <div className="page-bg" />
        <Sidebar />
        <div className="main-content-wrapper">
          <TopHeader />
          <div className="main-content">{children}</div>
        </div>
      </div>
    </ErrorBoundary>
  );
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><div className="spinner" /></div>;
  if (!user) return <Landing />;
  return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster 
            position="top-right" 
            toastOptions={{ 
              duration: 3500, 
              style: { 
                fontFamily: 'Inter', 
                fontWeight: 600,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(10px)',
                borderRadius: '12px'
              } 
            }} 
          />
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/onboarding/setup" element={<SelfOnboarding />} />
            <Route path="/change-password" element={<PrivateRoute><AppLayout><ChangePassword /></AppLayout></PrivateRoute>} />

            {/* Platform / Super Admin */}
            <Route path="/platform/dashboard" element={<PrivateRoute roles={['super_admin']}><AppLayout><SuperAdminDashboard /></AppLayout></PrivateRoute>} />
            <Route path="/platform/orgs" element={<PrivateRoute roles={['super_admin']}><AppLayout><OrgManagement /></AppLayout></PrivateRoute>} />
            <Route path="/platform/settings" element={<PrivateRoute roles={['super_admin']}><AppLayout><div className="page-content center">Global Settings UI (Coming Soon)</div></AppLayout></PrivateRoute>} />

            {/* Source */}
            <Route path="/source" element={<ModuleGate module="source"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><SourceDashboard /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/source/active" element={<ModuleGate module="source"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><ActiveCandidates /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/source/upload" element={<ModuleGate module="source"><PrivateRoute roles={['hr','org_admin']}><AppLayout><ResumeUpload /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/source/candidates/:id" element={<ModuleGate module="source"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><CandidateProfile /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/source/invite-status/:roleId" element={<ModuleGate module="source"><PrivateRoute roles={['hr','org_admin']}><AppLayout><InviteStatus /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/source/offers" element={<ModuleGate module="source"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><OfferApprovals /></AppLayout></PrivateRoute></ModuleGate>} />

            {/* Verify */}
            <Route path="/verify/dashboard" element={<ModuleGate module="verify"><PrivateRoute><AppLayout><CandidateDashboard /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/verify/assessment/:id" element={<ModuleGate module="verify"><PrivateRoute><AssessmentTaker /></PrivateRoute></ModuleGate>} />
            <Route path="/verify/result/:id" element={<ModuleGate module="verify"><PrivateRoute><AppLayout><ResultScreen /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/verify/leaderboard/:id" element={<ModuleGate module="verify"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><Leaderboard /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/verify/build" element={<ModuleGate module="verify"><PrivateRoute roles={['hr','org_admin','instructor']}><AppLayout><AssessmentBuilder /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/verify/manage" element={<ModuleGate module="verify"><PrivateRoute roles={['hr','org_admin','instructor','manager']}><AppLayout><ManageAssessments /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/verify/analytics/:id" element={<ModuleGate module="verify"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><AssessmentAnalytics /></AppLayout></PrivateRoute></ModuleGate>} />

            {/* Forge */}
            <Route path="/forge" element={<ModuleGate module="forge"><PrivateRoute><AppLayout><ForgeDashboard /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/forge/library" element={<ModuleGate module="forge"><PrivateRoute><AppLayout><CourseLibrary /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/forge/course/:id" element={<ModuleGate module="forge"><PrivateRoute><CoursePlayer /></PrivateRoute></ModuleGate>} />
            <Route path="/forge/build" element={<ModuleGate module="forge"><PrivateRoute roles={['instructor','org_admin','hr']}><AppLayout><CourseBuilder /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/forge/my-courses" element={<ModuleGate module="forge"><PrivateRoute roles={['instructor','org_admin','hr']}><AppLayout><MyCourses /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/forge/transcript" element={<ModuleGate module="forge"><PrivateRoute><AppLayout><Transcript /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/forge/team" element={<ModuleGate module="forge"><PrivateRoute roles={['manager','hr','org_admin']}><AppLayout><TeamAnalytics /></AppLayout></PrivateRoute></ModuleGate>} />

            {/* Deploy */}
            <Route path="/deploy" element={<ModuleGate module="deploy"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><EmployeeList /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/deploy/add" element={<ModuleGate module="deploy"><PrivateRoute roles={['hr','org_admin']}><AppLayout><AddEmployee /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/deploy/employee/:id" element={<ModuleGate module="deploy"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><EmployeeProfile /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/deploy/skill-map" element={<ModuleGate module="deploy"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><SkillMap /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/deploy/projects" element={<ModuleGate module="deploy"><PrivateRoute roles={['hr','org_admin']}><AppLayout><ProjectMatching /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/deploy/analytics" element={<ModuleGate module="deploy"><PrivateRoute roles={['hr','org_admin','manager']}><AppLayout><WorkforceAnalytics /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/deploy/my-profile" element={<ModuleGate module="deploy"><PrivateRoute roles={['employee']}><AppLayout><MyProfile /></AppLayout></PrivateRoute></ModuleGate>} />
            <Route path="/deploy/attendance" element={<ModuleGate module="deploy"><PrivateRoute><AppLayout><Attendance /></AppLayout></PrivateRoute></ModuleGate>} />

            {/* Admin */}
            <Route path="/admin/users" element={<PrivateRoute roles={['org_admin']}><AppLayout><UserManagement /></AppLayout></PrivateRoute>} />
            <Route path="/admin/org-settings" element={<PrivateRoute roles={['org_admin']}><AppLayout><OrgSettings /></AppLayout></PrivateRoute>} />
            <Route path="/admin/roles" element={<PrivateRoute roles={['org_admin']}><AppLayout><RoleManagement /></AppLayout></PrivateRoute>} />

            {/* Journey */}
            <Route path="/admin/journeys" element={<PrivateRoute roles={['hr','org_admin']}><AppLayout><AdminJourneys /></AppLayout></PrivateRoute>} />
            <Route path="/journey/my-path" element={<PrivateRoute><AppLayout><UserJourney /></AppLayout></PrivateRoute>} />
            
            {/* Fallback */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
