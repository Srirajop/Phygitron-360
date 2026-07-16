import React from 'react';
import { Routes, Route, Navigate } from "react-router-dom"; // ✅ added Navigate
import { AuthProvider, useAuth } from './core/auth/AuthContext';
import { Toaster } from 'react-hot-toast';

import Layout from './components/Layout';
import LandingPage from "./modules/landing/pages/LandingPage";
import LoginPage from './modules/landing/pages/LoginPage';
import ForgotPasswordPage from './modules/landing/pages/ForgotPasswordPage';
import ResetPasswordPage from './modules/landing/pages/ResetPasswordPage';
import OnboardPage from './modules/landing/pages/OnboardPage';

import ForceChangePasswordPage from './modules/landing/pages/ForceChangePasswordPage';

import MasterConsole from './modules/admin/pages/MasterConsole';
import OrgDashboard from './modules/admin/pages/OrgDashboard';
import SuperadminDashboard from './modules/admin/pages/SuperadminDashboard';

import SourceDashboard from './modules/source/pages/SourceDashboard';
import DeployDashboard from './modules/deploy/pages/DeployDashboard';
import VerifyDashboard from './modules/verify/pages/VerifyDashboard';
import ForgeDashboard from './modules/forge/pages/ForgeDashboard';
import TraineeDashboard from './modules/trainee/pages/TraineeDashboard';

function ProtectedRoute({ children, requiredPermission, requiredModule }) {
  const { user, loading, hasPermission } = useAuth();
  
  if (loading) {
  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#f5f5f5]">
      <div className="w-12 h-12 border-4 border-[#7c5cff] border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-[3px]">
        Loading Workspace...
      </p>
    </div>
  );
}
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Force password change check
  if (user.password_must_change) {
    return <Navigate to="/force-change-password" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/" replace />;
  }

  if (requiredModule && !hasPermission(`module.${requiredModule}.access`)) {
    return <Navigate to="/admin" replace />;
  }
  
  return children;
}

function AdminGate() {
  const { hasRole, hasPermission } = useAuth();
  
  if (hasPermission('admin.users.manage') || hasRole(['org_admin'])) {
    return <OrgDashboard />;
  }
  
  if (hasRole(['super_admin'])) {
    return <MasterConsole />;
  }

  // Fallback for managers or others who shouldn't be in the admin workspace
  return <Navigate to="/deploy" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" />

      <Routes>
        {/* Landing & Auth */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/force-change-password" element={<ForceChangePasswordPage />} />
        <Route path="/onboard" element={<OnboardPage />} />

        {/* Dashboards */}
        <Route 
          path="/superadmin" 
          element={
            <ProtectedRoute requiredPermission="manage_system">
              <Layout><SuperadminDashboard /></Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/admin" 
          element={
            <ProtectedRoute>
              <Layout><AdminGate /></Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/source" 
          element={
            <ProtectedRoute requiredModule="source">
              <Layout><SourceDashboard /></Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/verify" 
          element={
            <ProtectedRoute requiredModule="verify">
              <Layout><VerifyDashboard /></Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/forge" 
          element={
            <ProtectedRoute requiredModule="forge">
              <Layout><ForgeDashboard /></Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/deploy" 
          element={
            <ProtectedRoute requiredModule="deploy">
              <Layout><DeployDashboard /></Layout>
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/trainee" 
          element={
            <ProtectedRoute>
              <TraineeDashboard />
            </ProtectedRoute>
          } 
        />

        {/* Fallbacks */}
        <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
