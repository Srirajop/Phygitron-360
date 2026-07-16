import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";

import "../styles/admin.css";

import logo from "../../../assets/phy360.png";
import bellIcon from "../../../assets/bell.png";
import logoutIcon from "../../../assets/exit.png";

import { useAuth } from "../../../core/auth/AuthContext";
import { MODULE_CONFIG } from "../../../core/config/modules";

import AdminPanel from "../components/AdminPanel";

axios.defaults.withCredentials = true;

const hubNameMap = {
  source: "Talent Central",
  forge: "Learning Central",
  verify: "Assessment Central",
  deploy: "Employee Central",
};

// Standardized palette for the Funnel Chart based on requested colors
const PIE_PALETTE = ["#CC97FF", "#10B981", "#F59E0B", "#6366F1", "#8b5cf6"];

export default function OrgDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const { logout, user, hasPermission, hasRole } = useAuth();

  const [activeSideTab, setActiveSideTab] = useState("overview");

  const [stats, setStats] = useState({});
  const [funnel, setFunnel] = useState([]);
  const [activity, setActivity] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [journeys, setJourneys] = useState([]);
  const [team, setTeam] = useState([]);

  const modules = Object.entries(MODULE_CONFIG)
    .filter(([_, config]) => hasPermission?.(config.permission))
    .map(([key, config]) => ({
      id: key,
      name: config.label,
      path: config.route,
    }));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [
        statsRes,
        funnelRes,
        activityRes,
        alertsRes,
        journeysRes,
        teamRes,
      ] = await Promise.all([
        axios.get("/api/org/dashboard-stats"),
        axios.get("/api/org/pipeline-funnel"),
        axios.get("/api/org/recent-activity"),
        axios.get("/api/org/alerts"),
        axios.get("/api/org/journey-overview"),
        axios.get("/api/org/team-overview"),
      ]);

      setStats(statsRes.data || {});

      setFunnel(
        funnelRes.data?.length
          ? funnelRes.data
          : [
              { stage: "Sourced", count: 0 },
              { stage: "Screening", count: 0 },
              { stage: "Training", count: 0 },
              { stage: "Verified", count: 0 },
              { stage: "Deployed", count: 0 },
            ]
      );

      setActivity(Array.isArray(activityRes.data) ? activityRes.data : []);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      setJourneys(Array.isArray(journeysRes.data) ? journeysRes.data : []);
      setTeam(Array.isArray(teamRes.data) ? teamRes.data : []);
    } catch (err) {
      console.error("Dashboard error:", err);
    }
  };

  const displayName =
    user?.name || user?.username || user?.email?.split("@")[0] || "User";

  const getRoleDisplay = () => {
    if (hasRole?.("super_admin")) return "Super Admin";
    if (hasRole?.("org_admin")) return "Organisation Admin";
    if (hasRole?.("manager")) return "Manager";
    return "Organisation Admin";
  };

  // Funnel Pie Chart Logic
  const totalFunnel = funnel.reduce((acc, f) => acc + f.count, 0);
  let currentAngle = 0;
  const conicStops = funnel
    .map((f, i) => {
      const percentage = totalFunnel > 0 ? (f.count / totalFunnel) * 100 : 0;
      const start = currentAngle;
      const end = currentAngle + percentage;
      currentAngle = end;
      return `${PIE_PALETTE[i % PIE_PALETTE.length]} ${start}% ${end}%`;
    })
    .join(", ");

  const pieBg = totalFunnel > 0 ? `conic-gradient(${conicStops})` : "#e5e7eb";

  // New design setup for top cards containing local layout configurations 
  const kpiItems = [
    {
      label: "Candidates",
      value: stats.total_candidates || 0,
      subtitle: "Total Candidates",
      accent: "#8b5cf6",
      bgIcon: "#f4ecff",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      )
    },
    {
      label: "Training",
      value: stats.currently_training || 0,
      subtitle: "In Training",
      accent: "#F59E0B",
      bgIcon: "#f5f3ff",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"></path>
          <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5"></path>
        </svg>
      )
    },
    {
      label: "Verified",
      value: stats.verified_ready || 0,
      subtitle: "Verified & Ready",
      accent: "#10B981",
      bgIcon: "#e6f4ea",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
          <path d="m9 11 2 2 4-4"></path>
        </svg>
      )
    },
    {
      label: "Employees",
      value: stats.active_employees || 0,
      subtitle: "Active Employees",
      accent: "#e731ad",
      bgIcon: "#e8f0fe",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e731ad" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      )
    },
    {
      label: "Alerts",
      value: stats.skill_decay_alerts || 0,
      subtitle: "Needs Attention",
      accent: "#e81f1f",
      bgIcon: "#fdf2f8",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e81f1f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      )
    }
  ];

  return (
    <div className="dashboard-page">
      {/* TOPBAR */}
      <div className="topbar">
        <div className="top-left">
          <img src={logo} className="logo" alt="logo" />
        </div>
        <div className="top-center">
          <div className="hub-tabs">
            <button
              className={`hub-tab ${
                location.pathname === "/admin" ? "active" : ""
              }`}
              onClick={() => navigate("/admin")}
            >
              Dashboard
            </button>
            {modules.map((m) => (
              <button
                key={m.id}
                className={`hub-tab ${
                  location.pathname.startsWith(m.path) ? "active" : ""
                }`}
                onClick={() => navigate(m.path)}
              >
                {hubNameMap[m.id] || m.name}
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
            onClick={() => {
              logout();
              navigate("/login");
            }}
          />
          <div className="profile-wrap">
            <div className="avatar">
              {displayName?.charAt(0)?.toUpperCase()}
            </div>
            <div className="profile-text">
              <h4>{displayName}</h4>
              <p>{getRoleDisplay()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="dashboard-body">
        {/* SIDEBAR */}
        <div className="sidebar">
          <button
            className={activeSideTab === "overview" ? "active" : ""}
            onClick={() => setActiveSideTab("overview")}
          >
            Overview
          </button>
          {hasPermission?.("admin.users.manage") && (
            <button
              className={activeSideTab === "users" ? "active" : ""}
              onClick={() => setActiveSideTab("users")}
            >
              Users
            </button>
          )}
        </div>

        {/* CONTENT */}
        <div className="content">
          {/* OVERVIEW */}
          {activeSideTab === "overview" && (
            <>
              <h2>Welcome, {displayName}</h2>

              {/* NEW COMMAND-CENTER STYLE KPI CARDS */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(5, 1fr)",
                  gap: "20px",
                  marginBottom: "28px",
                }}
              >
                {kpiItems.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #ece4ff",
                      borderTop: `4px solid ${item.accent}`,
                      borderRadius: "20px",
                      padding: "24px",
                      minHeight: "135px",
                      color: "#111827",
                      transition: "all .25s cubic-bezier(0.4, 0, 0.2, 1)",
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(124,58,237,0.08)",
                      position: "relative",
                      display: "flex",
                      flexDirection: "column"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-4px)";
                      e.currentTarget.style.boxShadow = "0 12px 24px rgba(124,58,237,0.12)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 14px rgba(124,58,237,0.08)";
                    }}
                  >
                    {/* Left Icon Circle Container */}
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: item.bgIcon,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      {item.icon}
                    </div>

                    {/* Decorative Dot Matrix Style 3 */}
                    <div 
                      className="card-dots"
                      style={{ 
                        position: "absolute", 
                        top: "18px", 
                        right: "18px", 
                        opacity: 0.12, 
                        fontSize: "10px", 
                        lineHeight: "10px",
                        whiteSpace: "pre",
                        letterSpacing: "1.5px"
                      }}
                    >
                      {"• • •\n• • •\n• • •"}
                    </div>

                    {/* Typography Hierarchy Content */}
                    <p
                      style={{
                        fontSize: "11px",
                        fontWeight: 800,
                        letterSpacing: ".08em",
                        textTransform: "uppercase",
                        color: "rgba(0,0,0,.55)",
                        marginTop: "16px",
                        marginBottom: "4px"
                      }}
                    >
                      {item.label}
                    </p>
                    
                    <h2
                      style={{
                        fontSize: "42px",
                        fontWeight: 900,
                        color: "#111827",
                        margin: "0 0 4px 0",
                        lineHeight: "1"
                      }}
                    >
                      {item.value}
                    </h2>

                    <p
                      style={{
                        fontSize: "12px",
                        color: "rgba(0,0,0,.45)",
                        margin: 0
                      }}
                    >
                      {item.subtitle}
                    </p>
                  </div>
                ))}
              </div>

              {/* ROW 1: FUNNEL & ACTIVITY */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 1fr",
                  gap: "20px",
                  marginBottom: "20px",
                }}
              >
                {/* TALENT INTELLIGENCE FUNNEL (PIE CHART) */}
                <div className="section boxed" style={{ margin: 0, display: "flex", flexDirection: "column" }}>
                  <h3 style={{ marginBottom: "24px" }}>Talent Pipeline</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "40px", flex: 1 }}>
                    <div
                      style={{
                        width: "180px",
                        height: "180px",
                        borderRadius: "50%",
                        background: pieBg,
                        flexShrink: 0,
                        boxShadow: "inset 0 0 20px rgba(0,0,0,0.05)"
                      }}
                    />
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                      {funnel.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div
                            style={{
                              width: "12px",
                              height: "12px",
                              borderRadius: "50%",
                              background: PIE_PALETTE[i % PIE_PALETTE.length],
                            }}
                          />
                          <span style={{ fontWeight: 600, flex: 1 }}>{f.stage}</span>
                          <span style={{ fontWeight: 800 }}>{f.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RECENT ACTIVITY TIMELINE */}
                <div className="section boxed" style={{ margin: 0 }}>
                  <h3 style={{ marginBottom: "20px" }}>Recent Activity</h3>
                  {activity.length === 0 ? (
                    <p>No recent activity</p>
                  ) : (
                    <div style={{ position: "relative", paddingLeft: "24px" }}>
                      <div
                        style={{
                          position: "absolute",
                          left: "4px",
                          top: "8px",
                          bottom: "16px",
                          width: "2px",
                          background: "#e5e7eb",
                        }}
                      />
                      {activity.slice(0, 5).map((a, index) => (
                        <div
                          key={index}
                          style={{ position: "relative", marginBottom: "20px" }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              left: "-24px",
                              top: "4px",
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              background: "#8b5cf6",
                              border: "2px solid #fff",
                            }}
                          />
                          <p style={{ fontWeight: 700, margin: "0 0 4px 0", fontSize: "14px" }}>
                            {a.details || a.message}
                          </p>
                          <span style={{ fontSize: "12px", color: "#888", fontWeight: 500 }}>
                            Activity Event
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ROW 2: CORE TEAM OVERVIEW (HORIZONTALLY ELONGATED) */}
              <div className="section boxed" style={{ margin: 0, width: "100%" }}>
                <h3 style={{ marginBottom: "20px" }}>Core Team Overview</h3>
                <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #eaeaea" }}>
                      <th style={{ paddingBottom: "12px" }}>User</th>
                      <th style={{ paddingBottom: "12px" }}>Role</th>
                      <th style={{ paddingBottom: "12px" }}>Last Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((u, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ padding: "12px 0" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "50%",
                                background: "#CC97FF",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 900,
                                color: "#000",
                              }}
                            >
                              {(u.username || u.email)?.charAt(0)?.toUpperCase()}
                            </div>
                            <div style={{ fontWeight: 600 }}>
                              {u.username || u.name || u.email}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "12px 0" }}>
                          <span
                            style={{
                              background: "#f4ecff",
                              color: "#7c3aed",
                              padding: "6px 12px",
                              borderRadius: "999px",
                              fontSize: "12px",
                              fontWeight: 700,
                            }}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td style={{ padding: "12px 0", color: "#666", fontSize: "14px" }}>
                          {u.last_active ? new Date(u.last_active).toLocaleDateString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* USERS */}
          {activeSideTab === "users" && hasPermission?.("admin.users.manage") && (
            <AdminPanel />
          )}

          {/* ANALYTICS */}
          {activeSideTab === "analytics" && (
            <div className="section boxed">
              <h2>Analytics</h2>
              <p>Workforce analytics dashboard coming next.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}