import React, { useState, useMemo, useEffect } from 'react';
import { Download, Printer, FileText, X, Check, Award, AlertTriangle, BookOpen, Clock, Users, ShieldCheck, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { forgeApi } from '../../api';

function escapeCsvCell(cell) {
  if (cell == null) return '""';
  const str = String(cell);
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

export default function ForgeReportModal({
  isOpen,
  onClose,
  overviewData = null,
  currentUser = null,
  initialCourseId = null,
}) {
  const [reportScope, setReportScope] = useState(() => (initialCourseId ? 'course' : 'all'));
  const [selectedCourseId, setSelectedCourseId] = useState(() => initialCourseId || '');
  const [managerNotes, setManagerNotes] = useState('');
  
  // Section toggle options
  const [includeKpis, setIncludeKpis] = useState(true);
  const [includeCourses, setIncludeCourses] = useState(true);
  const [includeRosters, setIncludeRosters] = useState(true);
  const [includeLeaderboard, setIncludeLeaderboard] = useState(true);

  // Roster caching for full learner breakdown
  const [rosterMap, setRosterMap] = useState({});
  const [loadingRosters, setLoadingRosters] = useState(false);

  const coursesList = useMemo(() => overviewData?.courses_breakdown || [], [overviewData]);
  const kpis = useMemo(() => overviewData?.kpis || {}, [overviewData]);
  const topLearners = useMemo(() => overviewData?.top_learners || [], [overviewData]);

  // Set default selected course if in 'course' scope and none selected
  useEffect(() => {
    if (reportScope === 'course' && !selectedCourseId && coursesList.length > 0) {
      setSelectedCourseId(coursesList[0].id);
    }
  }, [reportScope, selectedCourseId, coursesList]);

  // Sync initialCourseId prop
  useEffect(() => {
    if (initialCourseId) {
      setReportScope('course');
      setSelectedCourseId(initialCourseId);
    }
  }, [initialCourseId]);

  // Fetch rosters needed for the report
  const ensureRostersLoaded = async () => {
    const coursesToFetch = reportScope === 'course'
      ? coursesList.filter(c => c.id === parseInt(selectedCourseId, 10))
      : coursesList;

    const missingCourses = coursesToFetch.filter(c => !rosterMap[c.id]);
    if (missingCourses.length === 0) return rosterMap;

    setLoadingRosters(true);
    const updatedMap = { ...rosterMap };

    try {
      await Promise.all(
        missingCourses.map(async (c) => {
          try {
            const res = await forgeApi.courseAnalytics(c.id);
            updatedMap[c.id] = res.data.data?.roster || [];
          } catch (e) {
            updatedMap[c.id] = [];
          }
        })
      );
      setRosterMap(updatedMap);
      return updatedMap;
    } catch (err) {
      console.error('Error loading rosters for report', err);
      return updatedMap;
    } finally {
      setLoadingRosters(false);
    }
  };

  if (!isOpen) return null;

  const currentCourse = coursesList.find(c => c.id === parseInt(selectedCourseId, 10)) || null;

  /* ── Publication-Grade HTML / PDF Report Builder ── */
  const buildReportHtml = (activeRosters) => {
    const now = new Date();
    const dateFormatted = now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userName = currentUser?.full_name || currentUser?.name || currentUser?.email || 'Executive Administrator';
    const userRole = (currentUser?.role?.value || currentUser?.role || 'Administrator').toUpperCase();

    // Determine target courses to report on
    let targetCourses = coursesList;
    let scopeTitle = "Enterprise-Wide Learning & Compliance Overview";
    if (reportScope === 'course' && currentCourse) {
      targetCourses = [currentCourse];
      scopeTitle = `Course Focus: ${currentCourse.title}`;
    } else if (reportScope === 'overdue') {
      scopeTitle = "At-Risk & Overdue Deadlines Compliance Audit";
    }

    // Aggregate summary statistics across target courses
    let totalAssignments = 0;
    let totalCompleted = 0;
    let totalInProgress = 0;
    let totalOverdue = 0;
    let allScores = [];

    targetCourses.forEach(c => {
      totalAssignments += c.assigned_count || 0;
      totalCompleted += c.completed_count || 0;
      totalInProgress += c.in_progress_count || 0;
      totalOverdue += c.overdue_count || 0;
      if (c.avg_score != null) allScores.push(c.avg_score);
    });

    const completionRate = totalAssignments > 0 ? Math.round((totalCompleted / totalAssignments) * 100) : 0;
    const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Forge LMS Executive Report - Phygitron 360</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      line-height: 1.45;
      font-size: 12px;
    }
    @page {
      size: A4 portrait;
      margin: 12mm 10mm;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
      tr { page-break-inside: avoid; }
    }
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #7c3aed;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 900;
      color: #7c3aed;
      letter-spacing: -0.5px;
    }
    .brand-sub {
      font-size: 10.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: 700;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #475569;
    }
    .meta-box strong { color: #0f172a; }

    /* KPI Summary Cards Grid */
    .grid-summary {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 8px;
      text-align: center;
    }
    .stat-num {
      font-size: 18px;
      font-weight: 900;
      color: #7c3aed;
    }
    .stat-label {
      font-size: 9.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }

    /* Executive Notes Banner */
    .manager-notes-box {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 10px 14px;
      border-radius: 0 8px 8px 0;
      margin-bottom: 16px;
      font-size: 11.5px;
      color: #78350f;
    }

    .section-title {
      font-size: 12px;
      font-weight: 800;
      color: #1e293b;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 18px 0 8px;
      display: flex;
      align-items: center;
      gap: 6px;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 4px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      margin-bottom: 16px;
      font-size: 11px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 7px 8px;
      border-bottom: 2px solid #cbd5e1;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }
    td {
      padding: 7px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: middle;
    }
    tr:nth-child(even) td {
      background: #fafafa;
    }

    /* Badges & Indicators */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 9.5px;
      text-transform: uppercase;
    }
    .badge-completed { background: #dcfce7; color: #166534; }
    .badge-inprogress { background: #dbeafe; color: #1e40af; }
    .badge-notstarted { background: #f1f5f9; color: #475569; }
    .badge-overdue { background: #fee2e2; color: #991b1b; font-weight: 800; }
    .badge-domain { background: #ede9fe; color: #6d28d9; border: 1px solid #ddd6fe; }

    .progress-bar-container {
      width: 80px;
      height: 6px;
      background: #e2e8f0;
      border-radius: 999px;
      overflow: hidden;
      display: inline-block;
      vertical-align: middle;
      margin-left: 6px;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 999px;
    }

    .footer {
      margin-top: 24px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="report-header">
    <div>
      <div class="brand-title">PHYGITRON 360 &bull; FORGE LMS</div>
      <div class="brand-sub">Executive Workforce Learning & Compliance Audit Report</div>
    </div>
    <div class="meta-box">
      <div><strong>Date:</strong> ${dateFormatted} &bull; ${timeFormatted}</div>
      <div><strong>Generated By:</strong> ${userName} (${userRole})</div>
      <div><strong>Scope:</strong> ${scopeTitle}</div>
    </div>
  </div>

  ${includeKpis ? `
  <!-- KPI Metrics Grid -->
  <div class="grid-summary">
    <div class="stat-card">
      <div class="stat-num">${targetCourses.length}</div>
      <div class="stat-label">Courses Covered</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${totalAssignments}</div>
      <div class="stat-label">Assigned Learners</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color: #10B981;">${completionRate}%</div>
      <div class="stat-label">Completion Rate</div>
    </div>
    <div class="stat-card">
      <div class="stat-num">${totalCompleted}</div>
      <div class="stat-label">Completions</div>
    </div>
    <div class="stat-card">
      <div class="stat-num" style="color: #3B82F6;">${totalInProgress}</div>
      <div class="stat-label">In Progress</div>
    </div>
    <div class="stat-card" style="border-color: ${totalOverdue > 0 ? '#FCA5A5' : '#E2E8F0'}; background: ${totalOverdue > 0 ? '#FEF2F2' : '#F8FAFC'};">
      <div class="stat-num" style="color: ${totalOverdue > 0 ? '#DC2626' : '#64748B'};">${totalOverdue}</div>
      <div class="stat-label" style="color: ${totalOverdue > 0 ? '#B91C1C' : '#64748B'};">Overdue Deadlines</div>
    </div>
  </div>
  ` : ''}

  ${managerNotes ? `
  <!-- Executive Commentary -->
  <div class="manager-notes-box">
    <strong>Executive Commentary & Directives:</strong><br>
    ${managerNotes.replace(/\n/g, '<br>')}
  </div>
  ` : ''}

  ${includeCourses ? `
  <!-- Course Performance Matrix -->
  <div class="section-title">1. Course Catalog & Performance Matrix</div>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Course Title</th>
        <th>Domain</th>
        <th>Level</th>
        <th style="text-align: center;">Assigned</th>
        <th style="text-align: center;">Completed</th>
        <th style="text-align: center;">In Progress</th>
        <th style="text-align: center;">Overdue</th>
        <th style="text-align: center;">Avg Score</th>
        <th style="text-align: right; width: 18%;">Completion Rate</th>
      </tr>
    </thead>
    <tbody>
      ${targetCourses.map(c => `
      <tr>
        <td>
          <strong>${c.title}</strong>
          ${c.estimated_hours ? `<div style="font-size: 9.5px; color: #64748B;">Est. ${c.estimated_hours} hrs</div>` : ''}
        </td>
        <td>
          <span class="badge badge-domain">${c.domain_name || 'General'}</span>
        </td>
        <td><span style="text-transform: capitalize; font-weight: 600;">${c.difficulty || 'beginner'}</span></td>
        <td style="text-align: center; font-weight: 700;">${c.assigned_count}</td>
        <td style="text-align: center; color: #166534; font-weight: 800;">${c.completed_count}</td>
        <td style="text-align: center; color: #1E40AF; font-weight: 700;">${c.in_progress_count}</td>
        <td style="text-align: center; color: ${c.overdue_count > 0 ? '#DC2626' : '#64748B'}; font-weight: ${c.overdue_count > 0 ? '900' : '500'};">
          ${c.overdue_count}
        </td>
        <td style="text-align: center; font-weight: 700;">${c.avg_score != null ? `${c.avg_score}%` : '—'}</td>
        <td style="text-align: right;">
          <span style="font-weight: 700;">${c.completion_rate}%</span>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" style="width: ${c.completion_rate}%; background: ${c.completion_rate === 100 ? '#10B981' : '#7C3AED'};"></div>
          </div>
        </td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  ` : ''}

  ${includeRosters ? `
  <!-- Detailed Learner Rosters & Attendance Matrix -->
  <div class="section-title">2. Detailed Learner Rosters & Attendance Matrix</div>
  ${targetCourses.map(c => {
    let roster = activeRosters[c.id] || [];
    if (reportScope === 'overdue') {
      roster = roster.filter(r => r.is_overdue || (r.progress_percent < 50 && r.status !== 'completed'));
    }
    if (roster.length === 0) return '';

    return `
    <div style="margin-top: 10px; margin-bottom: 14px;">
      <div style="font-size: 11px; font-weight: 800; color: #475569; background: #F8FAFC; padding: 6px 10px; border-radius: 6px; border: 1px solid #E2E8F0; display: flex; justify-content: space-between;">
        <span>📚 <strong>${c.title}</strong> &bull; ${c.domain_name || 'General'}</span>
        <span>${roster.length} Enrolled Learner(s)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 4%; text-align: center;">#</th>
            <th style="width: 22%;">Employee Name & Code</th>
            <th>Department & Role</th>
            <th>Bookmark / Current Slide</th>
            <th style="text-align: center;">Progress</th>
            <th style="text-align: center;">Score</th>
            <th style="text-align: center;">Status</th>
            <th>Deadline</th>
            <th>Last Active</th>
          </tr>
        </thead>
        <tbody>
          ${roster.map((r, idx) => {
            let statusBadge = `<span class="badge badge-notstarted">Not Started</span>`;
            if (r.status === 'completed') statusBadge = `<span class="badge badge-completed">Completed</span>`;
            else if (r.status === 'in_progress' || r.progress_percent > 0) statusBadge = `<span class="badge badge-inprogress">In Progress</span>`;

            return `
            <tr>
              <td style="text-align: center; color: #64748B;">${idx + 1}</td>
              <td>
                <strong>${r.name}</strong>
                <div style="font-size: 9.5px; color: #64748B;">${r.employee_code} &bull; ${r.email}</div>
              </td>
              <td>
                <div>${r.department || 'General'}</div>
                <div style="font-size: 9.5px; color: #64748B;">${r.designation || 'Employee'}</div>
              </td>
              <td>
                <span style="font-family: monospace; font-size: 10px; color: #475569;">
                  ${r.scorm_location || '—'}
                </span>
              </td>
              <td style="text-align: center;">
                <strong>${Math.round(r.progress_percent || 0)}%</strong>
                <div class="progress-bar-container" style="width: 50px;">
                  <div class="progress-bar-fill" style="width: ${r.progress_percent || 0}%; background: ${r.status === 'completed' ? '#10B981' : '#7C3AED'};"></div>
                </div>
              </td>
              <td style="text-align: center; font-weight: 700;">
                ${r.score !== null ? `${r.score}%` : '—'}
              </td>
              <td style="text-align: center;">
                ${statusBadge}
                ${r.is_overdue ? `<div style="margin-top: 3px;"><span class="badge badge-overdue">OVERDUE</span></div>` : ''}
              </td>
              <td style="color: ${r.is_overdue ? '#DC2626' : '#475569'}; font-weight: ${r.is_overdue ? '800' : '400'};">
                ${r.deadline ? r.deadline.split('T')[0] : 'None'}
              </td>
              <td style="color: #64748B;">
                ${r.last_accessed_at ? r.last_accessed_at.split('T')[0] : '—'}
              </td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    `;
  }).join('')}
  ` : ''}

  ${includeLeaderboard && topLearners.length > 0 ? `
  <!-- Top Performers Leaderboard -->
  <div class="section-title">3. Top Performing Learners Leaderboard</div>
  <table>
    <thead>
      <tr>
        <th style="width: 60px; text-align: center;">Rank</th>
        <th>Employee Name</th>
        <th>Department & Designation</th>
        <th style="text-align: center;">Completed Modules</th>
        <th style="text-align: center;">Assigned Modules</th>
        <th style="text-align: center;">Average Score</th>
        <th>Last Active</th>
      </tr>
    </thead>
    <tbody>
      ${topLearners.slice(0, 10).map((l, idx) => {
        let medal = `#${idx + 1}`;
        if (idx === 0) medal = '🥇 Gold';
        else if (idx === 1) medal = '🥈 Silver';
        else if (idx === 2) medal = '🥉 Bronze';

        return `
        <tr>
          <td style="text-align: center; font-weight: 800;">${medal}</td>
          <td>
            <strong>${l.name}</strong>
            <div style="font-size: 9.5px; color: #64748B;">${l.employee_code} &bull; ${l.email}</div>
          </td>
          <td>${l.department || 'General'} &bull; ${l.designation || 'Employee'}</td>
          <td style="text-align: center; color: #166534; font-weight: 800;">${l.completed_count}</td>
          <td style="text-align: center;">${l.enrolled_count || l.assigned_courses || '—'}</td>
          <td style="text-align: center; font-weight: 700;">${l.avg_score != null ? `${l.avg_score}%` : '—'}</td>
          <td style="color: #64748B;">${l.last_active ? l.last_active.split('T')[0] : '—'}</td>
        </tr>
        `;
      }).join('')}
    </tbody>
  </table>
  ` : ''}

  <!-- Footer -->
  <div class="footer">
    <div>Phygitron 360 Enterprise Learning Platform &bull; Confidential Internal Governance Document</div>
    <div>Report generated on ${dateFormatted} at ${timeFormatted}</div>
  </div>
</body>
</html>`;
  };

  /* ── 1. Print / Save as PDF ── */
  const handlePrintPdf = async () => {
    toast.loading('Preparing executive printable report...');
    try {
      const activeRosters = await ensureRostersLoaded();
      const htmlContent = buildReportHtml(activeRosters);
      toast.dismiss();

      // Use hidden iframe to avoid popup blocker issues
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(htmlContent);
      iframe.contentWindow.document.close();

      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 3000);
      }, 400);

      toast.success('Opening print / PDF dialog...');
    } catch (err) {
      toast.dismiss();
      console.error('Print failed:', err);
      toast.error('Failed to trigger print dialog');
    }
  };

  /* ── 2. Download Standalone HTML Document ── */
  const handleDownloadHtml = async () => {
    toast.loading('Generating standalone HTML document...');
    try {
      const activeRosters = await ensureRostersLoaded();
      const htmlContent = buildReportHtml(activeRosters);
      toast.dismiss();

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanScope = reportScope === 'course' && currentCourse ? currentCourse.title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'executive_lms';
      link.href = url;
      link.download = `Forge_LMS_Report_${cleanScope}_${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('HTML Report downloaded successfully!');
    } catch (err) {
      toast.dismiss();
      console.error('HTML export failed:', err);
      toast.error('Failed to download HTML report');
    }
  };

  /* ── 3. Download Detailed CSV Spreadsheet ── */
  const handleDownloadCsv = async () => {
    toast.loading('Compiling CSV spreadsheet data...');
    try {
      const activeRosters = await ensureRostersLoaded();
      toast.dismiss();

      const now = new Date();
      const dateStr = now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString();

      const metadataRows = [
        ['PHYGITRON 360 - FORGE LMS EXECUTIVE LEARNING REPORT'],
        ['Report Generated At', `${dateStr} ${timeStr}`],
        ['Generated By', currentUser?.full_name || currentUser?.email || 'Executive'],
        ['Report Scope', reportScope === 'course' && currentCourse ? `Single Course: ${currentCourse.title}` : (reportScope === 'overdue' ? 'At-Risk & Overdue Learners' : 'All Courses (Organization-Wide)')],
        ['Total Courses Covered', coursesList.length],
        ['Total Org Enrollments', kpis.total_enrollments || 0],
        ['Org Completion Rate', `${kpis.completion_rate || 0}%`],
        ['Total Overdue Deadlines', kpis.overdue_count || 0],
        ['Executive Commentary', managerNotes ? managerNotes.replace(/\r?\n/g, ' ') : 'None'],
        [], // separator
      ];

      const headerRow = [
        'Course Title',
        'Domain / Category',
        'Difficulty',
        'Employee ID / Code',
        'Employee Name',
        'Email Address',
        'Department',
        'Designation',
        'Slide Bookmark / Location',
        'Progress (%)',
        'Score (%)',
        'Status',
        'Target Deadline',
        'Is Overdue',
        'Last Active Date',
        'Completion Date'
      ];

      const targetCourses = reportScope === 'course' && currentCourse ? [currentCourse] : coursesList;
      const dataRows = [];

      targetCourses.forEach(c => {
        let roster = activeRosters[c.id] || [];
        if (reportScope === 'overdue') {
          roster = roster.filter(r => r.is_overdue || (r.progress_percent < 50 && r.status !== 'completed'));
        }

        roster.forEach(r => {
          dataRows.push([
            c.title,
            c.domain_name || 'General',
            c.difficulty || 'beginner',
            r.employee_code || '',
            r.name || '',
            r.email || '',
            r.department || 'General',
            r.designation || 'Employee',
            r.scorm_location || '',
            r.progress_percent ?? 0,
            r.score !== null ? r.score : '',
            r.status || 'not_started',
            r.deadline ? r.deadline.split('T')[0] : '',
            r.is_overdue ? 'YES' : 'NO',
            r.last_accessed_at ? r.last_accessed_at.split('T')[0] : '',
            r.completed_at ? r.completed_at.split('T')[0] : '',
          ]);
        });
      });

      const allRows = [
        ...metadataRows.map(r => r.map(escapeCsvCell).join(',')),
        headerRow.map(escapeCsvCell).join(','),
        ...dataRows.map(r => r.map(escapeCsvCell).join(','))
      ];

      // Add UTF-8 BOM for Microsoft Excel compatibility
      const csvContent = '\uFEFF' + allRows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const cleanScope = reportScope === 'course' && currentCourse ? currentCourse.title.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'executive_lms';
      link.href = url;
      link.download = `Forge_LMS_Report_${cleanScope}_${now.toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('CSV Spreadsheet downloaded successfully!');
    } catch (err) {
      toast.dismiss();
      console.error('CSV export failed:', err);
      toast.error('Failed to download CSV spreadsheet');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 600 }}>
      <div 
        className="modal animate-scale-in" 
        onClick={e => e.stopPropagation()} 
        style={{ maxWidth: 700, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', background: '#0F172A', border: '1px solid rgba(255,255,255,0.1)', color: '#F8FAFC' }}
      >
        {/* Header */}
        <div className="modal-header" style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(124, 58, 237, 0.15)', border: '1px solid rgba(124, 58, 237, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A78BFA' }}>
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'white' }}>
                Forge LMS Executive Report
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: 0 }}>
                Generate publication-grade PDF reports, offline HTML audits, or CSV spreadsheets
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: 6, color: '#94A3B8' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 18 }}>
          
          {/* 1. Report Scope Selector */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#A78BFA', marginBottom: 10, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              1. Choose Report Scope
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="scope" 
                  value="all" 
                  checked={reportScope === 'all'} 
                  onChange={() => setReportScope('all')} 
                  style={{ accentColor: '#7C3AED' }}
                />
                <div>
                  <strong>All Courses & Learning Tracks</strong>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Comprehensive company-wide audit across all {coursesList.length} courses</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="scope" 
                  value="course" 
                  checked={reportScope === 'course'} 
                  onChange={() => setReportScope('course')} 
                  style={{ accentColor: '#7C3AED' }}
                />
                <div style={{ flex: 1 }}>
                  <strong>Single Course Focus</strong>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Drill down into a specific course's employee attendance and scores</div>
                  {reportScope === 'course' && (
                    <select
                      className="form-control"
                      value={selectedCourseId}
                      onChange={e => setSelectedCourseId(e.target.value)}
                      style={{ marginTop: 8, fontSize: '0.84rem', background: '#1E293B', color: 'white', borderColor: 'rgba(255,255,255,0.15)' }}
                    >
                      {coursesList.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.title} ({c.domain_name || 'General'}) &bull; {c.assigned_count} enrolled
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="scope" 
                  value="overdue" 
                  checked={reportScope === 'overdue'} 
                  onChange={() => setReportScope('overdue')} 
                  style={{ accentColor: '#7C3AED' }}
                />
                <div>
                  <strong style={{ color: '#F87171' }}>At-Risk & Overdue Deadlines Audit</strong>
                  <div style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Filters strictly to employees past their target deadline or stalled below 50%</div>
                </div>
              </label>
            </div>
          </div>

          {/* 2. Executive KPI Snapshot */}
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
              Org Performance Snapshot
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, textAlign: 'center' }}>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: 8 }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#A78BFA' }}>{kpis.total_courses || coursesList.length}</div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Courses</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: 8 }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#60A5FA' }}>{kpis.total_enrollments || 0}</div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Enrolled</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: 8 }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: '#34D399' }}>{kpis.completion_rate || 0}%</div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Completion</div>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: 8 }}>
                <div style={{ fontSize: '1.15rem', fontWeight: 900, color: kpis.overdue_count > 0 ? '#F87171' : '#34D399' }}>
                  {kpis.overdue_count || 0}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94A3B8' }}>Overdue</div>
              </div>
            </div>
          </div>

          {/* 3. Section Inclusions Checkboxes */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#A78BFA', marginBottom: 8, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              2. Sections to Include in Report
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeKpis} onChange={e => setIncludeKpis(e.target.checked)} style={{ accentColor: '#7C3AED' }} />
                <span>Executive KPI Summary Cards</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeCourses} onChange={e => setIncludeCourses(e.target.checked)} style={{ accentColor: '#7C3AED' }} />
                <span>Course Performance Matrix</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeRosters} onChange={e => setIncludeRosters(e.target.checked)} style={{ accentColor: '#7C3AED' }} />
                <span>Detailed Learner Rosters & Bookmarks</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.84rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={includeLeaderboard} onChange={e => setIncludeLeaderboard(e.target.checked)} style={{ accentColor: '#7C3AED' }} />
                <span>Top Performers Leaderboard</span>
              </label>
            </div>
          </div>

          {/* 4. Executive Commentary Notes Textarea */}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#E2E8F0' }}>
              <span>Executive Commentary & Directives (Optional)</span>
              <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>Will appear in official report banner</span>
            </label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Q3 Technical Compliance & SCORM AI Upskilling Review. All engineering staff must complete module before month-end."
              value={managerNotes}
              onChange={e => setManagerNotes(e.target.value)}
              style={{ fontSize: '0.85rem', resize: 'vertical', background: '#1E293B', color: 'white', borderColor: 'rgba(255,255,255,0.15)' }}
            />
          </div>

          {/* 5. Format Cards */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#A78BFA', marginBottom: 10, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              3. Select Export & Presentation Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              
              {/* PDF Print Card */}
              <div 
                onClick={handlePrintPdf}
                style={{ 
                  border: '1px solid rgba(124, 58, 237, 0.3)', 
                  borderRadius: 12, 
                  padding: '14px', 
                  cursor: 'pointer', 
                  background: 'rgba(124, 58, 237, 0.08)', 
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#A78BFA'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124, 58, 237, 0.3)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(124, 58, 237, 0.25)', color: '#A78BFA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Printer size={16} />
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.68rem', background: '#7C3AED' }}>Print / PDF</span>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'white' }}>Executive PDF</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2, lineHeight: 1.3 }}>
                    Publication-grade formatted A4 report with tables & scorecards.
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 'auto', fontSize: '0.75rem', justifyContent: 'center' }}>
                  <Printer size={13} /> Print / Save PDF
                </button>
              </div>

              {/* Standalone HTML Card */}
              <div 
                onClick={handleDownloadHtml}
                style={{ 
                  border: '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: 12, 
                  padding: '14px', 
                  cursor: 'pointer', 
                  background: '#1E293B', 
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={16} />
                  </div>
                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>Offline File</span>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'white' }}>HTML Document</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2, lineHeight: 1.3 }}>
                    Self-contained document for offline executive briefing.
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 'auto', fontSize: '0.75rem', justifyContent: 'center' }}>
                  <FileText size={13} /> Download .HTML
                </button>
              </div>

              {/* CSV Card */}
              <div 
                onClick={handleDownloadCsv}
                style={{ 
                  border: '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: 12, 
                  padding: '14px', 
                  cursor: 'pointer', 
                  background: '#1E293B', 
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.2)', color: '#34D399', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Download size={16} />
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.68rem' }}>Excel / CSV</span>
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'white' }}>CSV Spreadsheet</div>
                  <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 2, lineHeight: 1.3 }}>
                    Full roster breakdown with scores, bookmarks & deadlines.
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" style={{ width: '100%', marginTop: 'auto', fontSize: '0.75rem', justifyContent: 'center' }}>
                  <Download size={13} /> Download .CSV
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={onClose} style={{ color: '#94A3B8', fontWeight: 600 }}>
            Cancel
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary" onClick={handleDownloadCsv}>
              <Download size={14} /> Download CSV
            </button>
            <button className="btn btn-primary" onClick={handlePrintPdf} style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)' }}>
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
