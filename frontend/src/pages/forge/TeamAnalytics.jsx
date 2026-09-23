import React, { useEffect, useState, useCallback } from 'react';
import { forgeApi } from '../../api';
import {
  Users, Award, TrendingUp, BookOpen, CheckCircle, Target,
  AlertTriangle, Clock, Download, Printer, Search, Filter,
  ChevronRight, ArrowUpRight, Bell, Sparkles, X, Check, FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function TeamAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('courses'); // 'courses' or 'leaderboard'

  // Course Roster Drilldown Modal State
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [drilldownData, setDrilldownData] = useState(null);
  const [loadingDrilldown, setLoadingDrilldown] = useState(false);
  const [nudgingId, setNudgingId] = useState(null);

  // Search filter for course breakdown
  const [courseSearch, setCourseSearch] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await forgeApi.analyticsOverview();
      setData(res.data.data);
    } catch (err) {
      toast.error('Failed to load executive learning analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Open Course Roster Drilldown
  const openDrilldown = async (courseId) => {
    setSelectedCourseId(courseId);
    setLoadingDrilldown(true);
    try {
      const res = await forgeApi.courseAnalytics(courseId);
      setDrilldownData(res.data.data);
    } catch (err) {
      toast.error('Failed to load course roster drilldown');
    } finally {
      setLoadingDrilldown(false);
    }
  };

  // Nudge employee on overdue/pending deadline
  const handleNudge = async (enrollmentId, employeeName) => {
    setNudgingId(enrollmentId);
    try {
      const res = await forgeApi.nudge(enrollmentId);
      toast.success(res.data.message || `Reminder email dispatched to ${employeeName}!`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send reminder nudge');
    } finally {
      setNudgingId(null);
    }
  };

  // Export full learning roster CSV spreadsheet
  const handleExportCsv = async () => {
    if (!data?.courses_breakdown) return;
    toast.loading('Generating CSV report...');

    try {
      // Gather all rosters across courses
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Course Title,Domain,Difficulty,Employee Code,Employee Name,Email,Department,Designation,Progress (%),Score (%),Status,Due Date,Overdue,Last Active\n";

      for (const course of data.courses_breakdown) {
        try {
          const res = await forgeApi.courseAnalytics(course.id);
          const roster = res.data.data?.roster || [];
          for (const r of roster) {
            const row = [
              `"${course.title.replace(/"/g, '""')}"`,
              `"${(course.domain_name || 'General').replace(/"/g, '""')}"`,
              `"${course.difficulty || 'beginner'}"`,
              `"${r.employee_code || ''}"`,
              `"${(r.name || '').replace(/"/g, '""')}"`,
              `"${r.email || ''}"`,
              `"${(r.department || '').replace(/"/g, '""')}"`,
              `"${(r.designation || '').replace(/"/g, '""')}"`,
              r.progress_percent,
              r.score !== null ? r.score : '',
              r.status,
              r.deadline ? r.deadline.split('T')[0] : '',
              r.is_overdue ? 'YES' : 'NO',
              r.last_accessed_at ? r.last_accessed_at.split('T')[0] : '',
            ].join(',');
            csvContent += row + "\n";
          }
        } catch (e) {
          // ignore individual course error
        }
      }

      toast.dismiss();
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Forge_LMS_Executive_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV Report downloaded successfully!');
    } catch (err) {
      toast.dismiss();
      toast.error('Failed to export CSV report');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const kpis = data?.kpis || {};
  const coursesBreakdown = data?.courses_breakdown || [];
  const topLearners = data?.top_learners || [];

  const filteredCourses = coursesBreakdown.filter(c =>
    !courseSearch ||
    c.title.toLowerCase().includes(courseSearch.toLowerCase()) ||
    (c.domain_name && c.domain_name.toLowerCase().includes(courseSearch.toLowerCase()))
  );

  return (
    <div style={{ padding: '0 40px 80px' }}>
      {/* ── Page Header & Download Actions ─────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '36px 0 28px', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Executive Portal
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.03em' }}>
            Learning Analytics & Executive Oversight
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>
            Comprehensive tracking of employee training completion, competencies, and deadlines
          </p>
        </div>

        {/* Export / Print Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={handleExportCsv}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 12, fontWeight: 700 }}
          >
            <FileSpreadsheet size={16} /> Export CSV Spreadsheet
          </button>
          <button
            onClick={handlePrint}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, fontWeight: 800 }}
          >
            <Printer size={16} /> Print / Save PDF
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ─────────────────────────────────────────────────── */}
      <div className="stats-grid animate-fade-in" style={{ marginBottom: 32 }}>
        {[
          { label: 'Published Courses', value: kpis.total_courses || 0, icon: <BookOpen size={20} />, color: '#7C3AED' },
          { label: 'Total Course Assignments', value: kpis.total_enrollments || 0, icon: <Users size={20} />, color: '#3B82F6' },
          { label: 'Completions', value: kpis.completed_enrollments || 0, icon: <CheckCircle size={20} />, color: '#10B981' },
          { label: 'Org Completion Rate', value: `${kpis.completion_rate || 0}%`, icon: <TrendingUp size={20} />, color: '#F59E0B' },
          { label: 'Average Score', value: `${kpis.avg_score || 0}%`, icon: <Award size={20} />, color: '#EC4899' },
          { label: 'Overdue Deadlines', value: kpis.overdue_enrollments || 0, icon: <AlertTriangle size={20} />, color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ borderRadius: 18, padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <span className="stat-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{s.label}</span>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}18`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: '1.9rem', fontWeight: 900, color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Navigation Tab Bar ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        <button
          onClick={() => setActiveTab('courses')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'courses' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'courses' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <BookOpen size={17} /> Course Breakdown & Rosters ({coursesBreakdown.length})
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          style={{
            padding: '12px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'leaderboard' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'leaderboard' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '0.95rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Award size={17} /> Top Learners Leaderboard ({topLearners.length})
        </button>
      </div>

      {/* ── TAB 1: Course Breakdown ────────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <div>
          {/* Search bar */}
          <div style={{ maxWidth: 360, position: 'relative', marginBottom: 20 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Filter courses by name or domain..."
              value={courseSearch}
              onChange={(e) => setCourseSearch(e.target.value)}
              style={{ paddingLeft: 40, height: 42, borderRadius: 12 }}
            />
          </div>

          <div className="card" style={{ borderRadius: 18, overflow: 'hidden' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Course Title</th>
                    <th>Domain</th>
                    <th>Difficulty</th>
                    <th style={{ textAlign: 'center' }}>Assigned</th>
                    <th style={{ textAlign: 'center' }}>Completed</th>
                    <th style={{ textAlign: 'center' }}>In Progress</th>
                    <th style={{ textAlign: 'center' }}>Overdue</th>
                    <th style={{ textAlign: 'center' }}>Avg Score</th>
                    <th style={{ minWidth: 160 }}>Completion Rate</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                        No courses found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredCourses.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{c.title}</div>
                          {c.estimated_hours && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              Est. {c.estimated_hours} hrs
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              background: c.domain_color ? `${c.domain_color}18` : 'rgba(124, 58, 237, 0.1)',
                              color: c.domain_color || '#7C3AED',
                              padding: '3px 9px',
                              borderRadius: 6,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                            }}
                          >
                            {c.domain_name || 'General'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-${c.difficulty === 'advanced' ? 'danger' : c.difficulty === 'intermediate' ? 'info' : 'success'}`} style={{ fontSize: '0.72rem' }}>
                            {c.difficulty || 'beginner'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.assigned_count}</td>
                        <td style={{ textAlign: 'center', color: '#10B981', fontWeight: 800 }}>{c.completed_count}</td>
                        <td style={{ textAlign: 'center', color: '#3B82F6', fontWeight: 700 }}>{c.in_progress_count}</td>
                        <td style={{ textAlign: 'center', color: c.overdue_count > 0 ? '#EF4444' : 'var(--text-muted)', fontWeight: c.overdue_count > 0 ? 800 : 500 }}>
                          {c.overdue_count}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>
                          {c.avg_score !== null ? `${c.avg_score}%` : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', marginBottom: 4 }}>
                            <span>{c.completion_rate}%</span>
                            <span style={{ color: 'var(--text-muted)' }}>{c.completed_count}/{c.assigned_count}</span>
                          </div>
                          <div className="progress-bar" style={{ height: 6 }}>
                            <div className="progress-fill" style={{ width: `${c.completion_rate}%`, background: '#10B981' }} />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => openDrilldown(c.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700 }}
                          >
                            View Roster →
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Top Learners Leaderboard ─────────────────────────────────── */}
      {activeTab === 'leaderboard' && (
        <div className="card" style={{ borderRadius: 18, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 60, textAlign: 'center' }}>Rank</th>
                  <th>Employee</th>
                  <th>Department & Designation</th>
                  <th style={{ textAlign: 'center' }}>Assigned Courses</th>
                  <th style={{ textAlign: 'center' }}>Completed</th>
                  <th style={{ textAlign: 'center' }}>Avg Score</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {topLearners.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 36, color: 'var(--text-muted)' }}>
                      No learner activity recorded yet.
                    </td>
                  </tr>
                ) : (
                  topLearners.map((learner, idx) => {
                    const isGold = idx === 0 && learner.completed_count > 0;
                    const isSilver = idx === 1 && learner.completed_count > 0;
                    const isBronze = idx === 2 && learner.completed_count > 0;

                    return (
                      <tr key={learner.user_id}>
                        <td style={{ textAlign: 'center' }}>
                          {isGold ? (
                            <span style={{ fontSize: '1.4rem' }}>🥇</span>
                          ) : isSilver ? (
                            <span style={{ fontSize: '1.4rem' }}>🥈</span>
                          ) : isBronze ? (
                            <span style={{ fontSize: '1.4rem' }}>🥉</span>
                          ) : (
                            <span style={{ fontWeight: 800, color: 'var(--text-muted)' }}>#{idx + 1}</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: isGold ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, var(--primary), #9333EA)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                              }}
                            >
                              {(learner.name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{learner.name}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {learner.email} · {learner.employee_code}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{learner.department || 'General'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{learner.designation || 'Employee'}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{learner.enrolled_count}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10B981',
                              padding: '4px 12px',
                              borderRadius: 999,
                              fontWeight: 800,
                              fontSize: '0.82rem',
                            }}
                          >
                            {learner.completed_count} Finished
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 800, color: learner.avg_score >= 80 ? '#10B981' : 'var(--text-main)' }}>
                          {learner.avg_score !== null ? `${learner.avg_score}%` : '—'}
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {learner.last_active ? new Date(learner.last_active).toLocaleDateString() : 'Never'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: Course-by-Course Roster Drilldown ───────────────────────── */}
      <AnimatePresence>
        {selectedCourseId && (
          <div className="modal-backdrop" onClick={() => setSelectedCourseId(null)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-box"
              style={{ maxWidth: 860, width: '100%', background: 'var(--bg-card)', borderRadius: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 800, textTransform: 'uppercase' }}>
                    Course Roster Drilldown
                  </div>
                  <h3 style={{ margin: '4px 0 0', fontSize: '1.25rem', fontWeight: 900 }}>
                    {drilldownData?.course?.title || 'Loading Course...'}
                  </h3>
                </div>
                <button className="btn-icon" onClick={() => setSelectedCourseId(null)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: 24 }}>
                {loadingDrilldown ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
                    <div className="spinner" />
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Enrolled Employees: <strong>{drilldownData?.total_enrolled || 0}</strong>
                      </span>
                    </div>

                    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', maxHeight: 400, overflowY: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Employee</th>
                            <th>Department</th>
                            <th style={{ minWidth: 120 }}>Progress</th>
                            <th style={{ textAlign: 'center' }}>Score</th>
                            <th>Bookmark</th>
                            <th>Deadline</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(drilldownData?.roster || []).length === 0 ? (
                            <tr>
                              <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                                No employees assigned to this course yet.
                              </td>
                            </tr>
                          ) : (
                            drilldownData.roster.map((r) => (
                              <tr key={r.enrollment_id}>
                                <td>
                                  <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>{r.name}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.email} ({r.employee_code})</div>
                                </td>
                                <td style={{ fontSize: '0.8rem' }}>{r.department}</td>
                                <td>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginBottom: 2 }}>
                                    <span style={{ fontWeight: 700 }}>{Math.round(r.progress_percent)}%</span>
                                    <span style={{ color: r.status === 'completed' ? '#10B981' : 'var(--text-muted)' }}>
                                      {r.status}
                                    </span>
                                  </div>
                                  <div className="progress-bar" style={{ height: 4 }}>
                                    <div className="progress-fill" style={{ width: `${r.progress_percent}%`, background: r.status === 'completed' ? '#10B981' : 'var(--primary)' }} />
                                  </div>
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: 700 }}>
                                  {r.score !== null ? `${r.score}%` : '—'}
                                </td>
                                <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {r.scorm_location || 'Not started'}
                                </td>
                                <td>
                                  {r.deadline ? (
                                    <div style={{ fontSize: '0.78rem', color: r.is_overdue ? '#EF4444' : 'var(--text-main)', fontWeight: r.is_overdue ? 800 : 500 }}>
                                      {new Date(r.deadline).toLocaleDateString()}
                                      {r.is_overdue && <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 800 }}>[OVERDUE]</span>}
                                    </div>
                                  ) : (
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No deadline</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  {r.status !== 'completed' ? (
                                    <button
                                      onClick={() => handleNudge(r.enrollment_id, r.name)}
                                      disabled={nudgingId === r.enrollment_id}
                                      className="btn btn-secondary btn-sm"
                                      style={{
                                        padding: '4px 10px',
                                        borderRadius: 8,
                                        fontSize: '0.72rem',
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        color: r.is_overdue ? '#EF4444' : 'var(--primary)',
                                      }}
                                    >
                                      {nudgingId === r.enrollment_id ? (
                                        <div className="spinner" style={{ width: 12, height: 12 }} />
                                      ) : (
                                        <>
                                          <Bell size={12} /> Nudge
                                        </>
                                      )}
                                    </button>
                                  ) : (
                                    <span style={{ fontSize: '0.72rem', color: '#10B981', fontWeight: 700 }}>
                                      Finished
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
