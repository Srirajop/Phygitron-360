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

// Admin
import UserManagement from './pages/admin/UserManagement';
import OrgSettings from './pages/admin/OrgSettings';

// Journey
import AdminJourneys from './pages/journey/AdminJourneys';
import UserJourney from './pages/journey/UserJourney';

const ROLE_HOME = {
  candidate: '/verify/dashboard',
  employee: '/forge',
  hr: '/source',
  instructor: '/forge/my-courses',
  manager: '/deploy',
  admin: '/admin/users',
};

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner spinner-lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
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
            <Route path="/change-password" element={<PrivateRoute><AppLayout><ChangePassword /></AppLayout></PrivateRoute>} />

            {/* Source */}
            <Route path="/source" element={<PrivateRoute roles={['hr','admin']}><AppLayout><SourceDashboard /></AppLayout></PrivateRoute>} />
            <Route path="/source/active" element={<PrivateRoute roles={['hr','admin']}><AppLayout><ActiveCandidates /></AppLayout></PrivateRoute>} />
            <Route path="/source/upload" element={<PrivateRoute roles={['hr','admin']}><AppLayout><ResumeUpload /></AppLayout></PrivateRoute>} />
            <Route path="/source/candidates/:id" element={<PrivateRoute roles={['hr','admin','manager']}><AppLayout><CandidateProfile /></AppLayout></PrivateRoute>} />
            <Route path="/source/invite-status/:roleId" element={<PrivateRoute roles={['hr','admin']}><AppLayout><InviteStatus /></AppLayout></PrivateRoute>} />

            {/* Verify */}
            <Route path="/verify/dashboard" element={<PrivateRoute><AppLayout><CandidateDashboard /></AppLayout></PrivateRoute>} />
            <Route path="/verify/assessment/:id" element={<PrivateRoute><AssessmentTaker /></PrivateRoute>} />
            <Route path="/verify/result/:id" element={<PrivateRoute><AppLayout><ResultScreen /></AppLayout></PrivateRoute>} />
            <Route path="/verify/leaderboard/:id" element={<PrivateRoute><AppLayout><Leaderboard /></AppLayout></PrivateRoute>} />
            <Route path="/verify/build" element={<PrivateRoute roles={['hr','admin','instructor']}><AppLayout><AssessmentBuilder /></AppLayout></PrivateRoute>} />
            <Route path="/verify/manage" element={<PrivateRoute roles={['hr','admin','instructor']}><AppLayout><ManageAssessments /></AppLayout></PrivateRoute>} />
            <Route path="/verify/analytics/:id" element={<PrivateRoute roles={['hr','admin','manager']}><AppLayout><AssessmentAnalytics /></AppLayout></PrivateRoute>} />

            {/* Forge */}
            <Route path="/forge" element={<PrivateRoute><AppLayout><ForgeDashboard /></AppLayout></PrivateRoute>} />
            <Route path="/forge/library" element={<PrivateRoute><AppLayout><CourseLibrary /></AppLayout></PrivateRoute>} />
            <Route path="/forge/course/:id" element={<PrivateRoute><CoursePlayer /></PrivateRoute>} />
            <Route path="/forge/build" element={<PrivateRoute roles={['instructor','admin','hr']}><AppLayout><CourseBuilder /></AppLayout></PrivateRoute>} />
            <Route path="/forge/my-courses" element={<PrivateRoute roles={['instructor','admin','hr']}><AppLayout><MyCourses /></AppLayout></PrivateRoute>} />
            <Route path="/forge/transcript" element={<PrivateRoute><AppLayout><Transcript /></AppLayout></PrivateRoute>} />
            <Route path="/forge/team" element={<PrivateRoute roles={['manager','hr','admin']}><AppLayout><TeamAnalytics /></AppLayout></PrivateRoute>} />

            {/* Deploy */}
            <Route path="/deploy" element={<PrivateRoute roles={['hr','admin','manager']}><AppLayout><EmployeeList /></AppLayout></PrivateRoute>} />
            <Route path="/deploy/add" element={<PrivateRoute roles={['hr','admin']}><AppLayout><AddEmployee /></AppLayout></PrivateRoute>} />
            <Route path="/deploy/employee/:id" element={<PrivateRoute roles={['hr','admin','manager']}><AppLayout><EmployeeProfile /></AppLayout></PrivateRoute>} />
            <Route path="/deploy/skill-map" element={<PrivateRoute roles={['hr','admin','manager']}><AppLayout><SkillMap /></AppLayout></PrivateRoute>} />
            <Route path="/deploy/projects" element={<PrivateRoute roles={['hr','admin']}><AppLayout><ProjectMatching /></AppLayout></PrivateRoute>} />
            <Route path="/deploy/analytics" element={<PrivateRoute roles={['hr','admin','manager']}><AppLayout><WorkforceAnalytics /></AppLayout></PrivateRoute>} />
            <Route path="/deploy/my-profile" element={<PrivateRoute roles={['employee']}><AppLayout><MyProfile /></AppLayout></PrivateRoute>} />

            {/* Admin */}
            <Route path="/admin/users" element={<PrivateRoute roles={['admin']}><AppLayout><UserManagement /></AppLayout></PrivateRoute>} />
            <Route path="/admin/org-settings" element={<PrivateRoute roles={['admin']}><AppLayout><OrgSettings /></AppLayout></PrivateRoute>} />

            {/* Journey */}
            <Route path="/admin/journeys" element={<PrivateRoute roles={['hr','admin']}><AppLayout><AdminJourneys /></AppLayout></PrivateRoute>} />
            <Route path="/journey/my-path" element={<PrivateRoute><AppLayout><UserJourney /></AppLayout></PrivateRoute>} />
            
            {/* Fallback */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
