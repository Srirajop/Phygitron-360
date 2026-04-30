import React, { useState, useEffect, useCallback } from 'react';
import { deployApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Clock, LogIn, LogOut, Calendar, ChevronLeft, ChevronRight, FileText, Send, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const STATUS_COLORS = { present: '#10B981', absent: '#EF4444', half_day: '#F59E0B', leave: '#3B82F6', holiday: '#8B5CF6' };
const STATUS_LABELS = { present: 'Present', absent: 'Absent', half_day: 'Half Day', leave: 'Leave', holiday: 'Holiday' };

export default function Attendance() {
  const { user } = useAuth();
  const isManager = ['hr', 'org_admin', 'manager'].includes(user?.role);

  const [tab, setTab] = useState(isManager ? 'team' : 'my'); // managers default to team view
  const [attendance, setAttendance] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clockingIn, setClockingIn] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [noEmployee, setNoEmployee] = useState(false); // true if user has no employee record

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1);
  const [viewYear, setViewYear] = useState(today.getFullYear());

  // Leave request form
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deployApi.myAttendance({ month: viewMonth, year: viewYear });
      setAttendance(res.data.data);
      setNoEmployee(false);
    } catch (err) {
      // 404 = user has no employee record (admin/HR accounts) — not an error
      if (err?.response?.status === 404) {
        setNoEmployee(true);
      }
      // Don't show error toast for expected cases
    } finally { setLoading(false); }
  }, [viewMonth, viewYear]);

  const loadTeam = async () => {
    try {
      const res = await deployApi.teamAttendance();
      setTeamData(res.data.data);
    } catch { /* silently fail if table doesn't exist yet */ }
  };

  const loadLeaves = async () => {
    try {
      const res = await deployApi.leaveRequests({});
      const data = res.data?.data;
      setLeaveRequests(Array.isArray(data) ? data : []);
    } catch { setLeaveRequests([]); }
  };

  useEffect(() => { if (tab === 'my') loadAttendance(); }, [loadAttendance, tab]);
  useEffect(() => { if (tab === 'team' && isManager) loadTeam(); }, [tab]);
  useEffect(() => { if (tab === 'leave' && isManager) loadLeaves(); }, [tab]);

  const handleClockIn = async () => {
    setClockingIn(true);
    try {
      await deployApi.clockIn();
      toast.success('Clocked in! ☀️');
      loadAttendance();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Clock in failed'); }
    finally { setClockingIn(false); }
  };

  const handleClockOut = async () => {
    const workLog = prompt("Please enter a short work log for today:");
    if (workLog === null) return; // cancelled
    if (!workLog.trim()) { toast.error("Work log is required"); return; }

    setClockingOut(true);
    try {
      const res = await deployApi.clockOut({ work_log: workLog });
      toast.success(res.data.message || 'Clocked out successfully');
      loadAttendance();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Clock out failed'); }
    finally { setClockingOut(false); }
  };

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      await deployApi.requestLeave(leaveForm);
      toast.success('Leave request submitted');
      setShowLeaveForm(false);
      setLeaveForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      loadLeaves();
    } catch (err) { toast.error(err?.response?.data?.detail || 'Failed to submit'); }
  };

  const handleLeaveAction = async (id, approve) => {
    try {
      await deployApi.approveLeave(id, approve);
      toast.success(approve ? 'Leave approved' : 'Leave rejected');
      loadLeaves();
    } catch { toast.error('Action failed'); }
  };

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build calendar grid
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();
  const calendarDays = [];
  for (let i = 0; i < firstDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const getRecordForDay = (day) => {
    if (!attendance?.records || !day) return null;
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return attendance.records.find(r => r.date === dateStr);
  };

  const todayRecord = attendance?.today;
  const summary = attendance?.summary;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>Attendance</h1>
          <p>Track your work hours and manage leave</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setShowLeaveForm(true)} style={{ gap: 6 }}>
            <FileText size={15} /> Request Leave
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: 4, border: '1px solid var(--border)', width: 'fit-content' }}>
          <button onClick={() => setTab('my')} className="btn btn-sm" style={{ background: tab === 'my' ? 'var(--primary)' : 'transparent', color: tab === 'my' ? 'white' : 'var(--text-secondary)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: '0.85rem' }}>My Attendance</button>
          {isManager && <button onClick={() => setTab('team')} className="btn btn-sm" style={{ background: tab === 'team' ? 'var(--primary)' : 'transparent', color: tab === 'team' ? 'white' : 'var(--text-secondary)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: '0.85rem' }}>Team</button>}
          {isManager && <button onClick={() => setTab('leave')} className="btn btn-sm" style={{ background: tab === 'leave' ? 'var(--primary)' : 'transparent', color: tab === 'leave' ? 'white' : 'var(--text-secondary)', border: 'none', padding: '8px 20px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: '0.85rem' }}>Leave Requests</button>}
        </div>

        {tab === 'my' && (
          <>
            {noEmployee ? (
              <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
                <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👤</div>
                  <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>No Employee Record</h3>
                  <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                    Your account ({user?.role}) does not have an employee profile linked to it.<br />
                    Use the <strong>Team</strong> tab to view your organisation's attendance.
                  </p>
                  {isManager && (
                    <button className="btn btn-primary" onClick={() => setTab('team')} style={{ gap: 6 }}>
                      View Team Attendance
                    </button>
                  )}
                </div>
              </div>
            ) : (
            <>
            {/* Clock In/Out Card */}
            <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
              <div className="card-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>TODAY</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  {todayRecord?.clocked_in && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      Clocked in at {new Date(todayRecord.clocked_in).toLocaleTimeString()}
                      {todayRecord.clocked_out && ` · Out at ${new Date(todayRecord.clocked_out).toLocaleTimeString()}`}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  {!todayRecord?.clocked_in ? (
                    <button className="btn btn-primary" onClick={handleClockIn} disabled={clockingIn} style={{ gap: 8, padding: '12px 28px', fontSize: '1rem' }}>
                      <LogIn size={20} /> {clockingIn ? 'Clocking in...' : 'Clock In'}
                    </button>
                  ) : !todayRecord?.clocked_out ? (
                    <button className="btn btn-secondary" onClick={handleClockOut} disabled={clockingOut} style={{ gap: 8, padding: '12px 28px', fontSize: '1rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}>
                      <LogOut size={20} /> {clockingOut ? 'Clocking out...' : 'Clock Out'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#10B98120', borderRadius: 'var(--radius)', color: '#10B981', fontWeight: 700 }}>
                      <Check size={20} /> Day Complete
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            {summary && (
              <div className="stats-grid animate-fade-in" style={{ marginBottom: 24 }}>
                {[
                  { label: 'Present', value: summary.total_present, color: '#10B981' },
                  { label: 'Absent', value: summary.total_absent, color: '#EF4444' },
                  { label: 'Half Day', value: summary.total_half_day, color: '#F59E0B' },
                  { label: 'Leave', value: summary.total_leave, color: '#3B82F6' },
                  { label: 'Hours Worked', value: `${summary.total_hours}h`, color: 'var(--primary)' },
                ].map((s, i) => (
                  <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
                    <div className="stat-icon" style={{ color: s.color }}><Clock size={18} /></div>
                    <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Calendar */}
            <div className="card animate-fade-in stagger-3">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
                <h4 style={{ margin: 0 }}>{MONTH_NAMES[viewMonth - 1]} {viewYear}</h4>
                <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
              </div>
              <div className="card-body">
                {loading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                      <div key={d} style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-muted)', padding: '8px 0' }}>{d}</div>
                    ))}
                    {calendarDays.map((day, i) => {
                      if (!day) return <div key={`e-${i}`} />;
                      const record = getRecordForDay(day);
                      const isToday = day === today.getDate() && viewMonth === today.getMonth() + 1 && viewYear === today.getFullYear();
                      const status = record?.status || null;
                      const bg = status ? `${STATUS_COLORS[status]}20` : isToday ? 'var(--primary-lightest)' : 'transparent';
                      const border = isToday ? '2px solid var(--primary)' : '1px solid var(--border)';
                      return (
                        <div key={day} style={{ textAlign: 'center', padding: '10px 4px', borderRadius: 'var(--radius)', background: bg, border, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                          <div style={{ fontWeight: isToday ? 800 : 500, fontSize: '0.85rem', color: isToday ? 'var(--primary)' : 'var(--text-primary)' }}>{day}</div>
                          {status && (
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status] }} title={STATUS_LABELS[status]} />
                          )}
                          {record?.hours && <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600 }}>{record.hours}h</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Legend */}
                <div style={{ display: 'flex', gap: 16, marginTop: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[k] }} />
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </>
            )}
          </>
        )}

        {/* Team Tab */}
        {tab === 'team' && teamData && (
          <div className="card animate-fade-in">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ margin: 0 }}>Team Attendance — {new Date(teamData.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h4>
              <div style={{ display: 'flex', gap: 16 }}>
                <span style={{ fontWeight: 700, color: '#10B981' }}>{teamData.present} Present</span>
                <span style={{ fontWeight: 700, color: '#EF4444' }}>{teamData.absent} Absent</span>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Employee</th>
                    <th style={{ padding: '14px 20px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Department</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Status</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Clock In</th>
                    <th style={{ padding: '14px 20px', textAlign: 'center', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>Clock Out</th>
                  </tr>
                </thead>
                <tbody>
                  {teamData.team.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>{t.name}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t.department || '—'}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6, background: `${STATUS_COLORS[t.status] || STATUS_COLORS.absent}18`, color: STATUS_COLORS[t.status] || STATUS_COLORS.absent, textTransform: 'capitalize' }}>{t.status}</span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {t.clock_in ? new Date(t.clock_in).toLocaleTimeString() : '—'}
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {t.clock_out ? new Date(t.clock_out).toLocaleTimeString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Leave Requests Tab */}
        {tab === 'leave' && (
          <div className="card animate-fade-in">
            <div className="card-header"><h4 style={{ margin: 0 }}>Leave Requests</h4></div>
            <div className="card-body" style={{ padding: 0 }}>
              {(!Array.isArray(leaveRequests) || leaveRequests.length === 0) ? (
                <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>No leave requests</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      {['Employee','Type','From','To','Reason','Status','Actions'].map(h => (
                        <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(Array.isArray(leaveRequests) ? leaveRequests : []).map(lr => (
                      <tr key={lr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '14px 16px', fontWeight: 600 }}>{lr.employee_name}</td>
                        <td style={{ padding: '14px 16px', textTransform: 'capitalize', fontSize: '0.85rem' }}>{lr.leave_type}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{lr.start_date}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{lr.end_date}</td>
                        <td style={{ padding: '14px 16px', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lr.reason || '—'}</td>
                        <td style={{ padding: '14px 16px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 6, textTransform: 'capitalize',
                            background: lr.status === 'approved' ? '#10B98118' : lr.status === 'rejected' ? '#EF444418' : '#F59E0B18',
                            color: lr.status === 'approved' ? '#10B981' : lr.status === 'rejected' ? '#EF4444' : '#F59E0B'
                          }}>{lr.status}</span>
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          {lr.status === 'pending' && (
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleLeaveAction(lr.id, true)} style={{ color: '#10B981', padding: '4px 8px' }}><Check size={14} /></button>
                              <button className="btn btn-ghost btn-sm" onClick={() => handleLeaveAction(lr.id, false)} style={{ color: '#EF4444', padding: '4px 8px' }}><X size={14} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Leave Request Form Modal */}
      {showLeaveForm && (
        <div className="modal-overlay" onClick={() => setShowLeaveForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Request Leave</h4>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowLeaveForm(false)}>✕</button>
            </div>
            <form onSubmit={handleLeaveSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Leave Type</label>
                  <select className="form-control" value={leaveForm.leave_type} onChange={e => setLeaveForm(f => ({ ...f, leave_type: e.target.value }))}>
                    <option value="sick">Sick Leave (10 days)</option>
                    <option value="casual">Casual Leave (12 days)</option>
                    <option value="privilege">Privilege Leave (15 days)</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="compensatory">Compensatory Off</option>
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label">From Date *</label>
                    <input type="date" required className="form-control" value={leaveForm.start_date} onChange={e => setLeaveForm(f => ({ ...f, start_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">To Date *</label>
                    <input type="date" required className="form-control" value={leaveForm.end_date} onChange={e => setLeaveForm(f => ({ ...f, end_date: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Reason</label>
                  <textarea className="form-control" rows={3} placeholder="Optional reason for leave..." value={leaveForm.reason} onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowLeaveForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary"><Send size={14} /> Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
