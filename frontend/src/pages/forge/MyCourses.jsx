import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgeApi, adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, PlusCircle, Users, Award, CheckCircle, Clock,
  Eye, Trash2, Send, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  draft: { badge: 'badge-muted', label: 'Draft', icon: 'Draft' },
  pending_review: { badge: 'badge-warning', label: 'Pending Review', icon: 'Review' },
  published: { badge: 'badge-success', label: 'Published', icon: 'Live' },
};

export default function MyCourses() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [learnerRows, setLearnerRows] = useState([]);
  const [learnersLoading, setLearnersLoading] = useState(false);

  // Course Assignment State
  const [candidates, setCandidates] = useState([]);
  const [assignModal, setAssignModal] = useState({ open: false, courseId: null, deadline: '', loading: false });
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCourseForAssign, setSelectedCourseForAssign] = useState(null);

  const load = () => {
    setLoading(true);
    forgeApi.myCourses()
      .then(r => setCourses(Array.isArray(r.data.data) ? r.data.data : []))
      .catch(() => toast.error('Failed to load courses'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (course) => {
    if (!confirm(`Delete "${course.title}"? This cannot be undone.`)) return;
    setDeleting(course.id);
    try {
      await forgeApi.deleteCourse(course.id);
      toast.success('Course deleted');
      setCourses(prev => prev.filter(c => c.id !== course.id));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const handleSubmitReview = async (course) => {
    try {
      await forgeApi.submitForReview(course.id);
      toast.success('Course submitted for review!');
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, status: 'pending_review' } : c));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Submit failed');
    }
  };

  const handlePublish = async (course) => {
    try {
      await forgeApi.publishCourse(course.id);
      toast.success('Course published!');
      setCourses(prev => prev.map(c => c.id === course.id ? { ...c, status: 'published' } : c));
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Publish failed');
    }
  };

  const openLearners = async (course) => {
    setSelectedCourse(course);
    setLearnersLoading(true);
    try {
      const res = await forgeApi.courseEnrollments(course.id);
      setLearnerRows(Array.isArray(res.data.data) ? res.data.data : []);
    } catch {
      setLearnerRows([]);
      toast.error('Failed to load learner tracker');
    } finally {
      setLearnersLoading(false);
    }
  };

  const openAssignModal = (course) => {
    setSelectedCourseForAssign(course);
    setAssignModal({ open: true, courseId: course.id, deadline: '', loading: false });
    setSelectedCandidates([]);
    setSearch('');
    if (candidates.length === 0) {
      adminApi.listUsers().then(r => {
        const actualCandidates = (r.data.data || []).filter(c => 
          !c.email.includes('.local') && ['candidate', 'employee'].includes(c.role)
        );
        setCandidates(actualCandidates);
      }).catch(console.error);
    }
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (selectedCandidates.length === 0) { toast.error('Select at least one user'); return; }
    setAssignModal(m => ({ ...m, loading: true }));
    try {
      await forgeApi.bulkEnroll({
        course_id: assignModal.courseId,
        user_ids: selectedCandidates,
        deadline: assignModal.deadline ? new Date(assignModal.deadline).toISOString() : null,
      });
      toast.success('Course assigned successfully!');
      setAssignModal({ open: false, courseId: null, deadline: '', loading: false });
      load();
    } catch {
      toast.error('Failed to assign course');
      setAssignModal(m => ({ ...m, loading: false }));
    }
  };

  const canPublish = ['org_admin', 'super_admin'].includes(user?.role);
  const statsTotal = {
    enrollments: courses.reduce((s, c) => s + (c.enrollments || 0), 0),
    completions: courses.reduce((s, c) => s + (c.completions || 0), 0),
    certificates: courses.reduce((s, c) => s + (c.certificates_issued || 0), 0),
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>My Courses</h1>
          <p>Manage your created courses, track learner progress, and publish new content</p>
        </div>
        <Link to="/forge/build" className="btn btn-primary">
          <PlusCircle size={16} /> New Course
        </Link>
      </div>
      <div className="page-body">
        <div className="stats-grid animate-fade-in" style={{ marginBottom: 28 }}>
          {[
            { label: 'Total Courses', value: courses.length, icon: <BookOpen size={18} /> },
            { label: 'Total Enrollments', value: statsTotal.enrollments, icon: <Users size={18} /> },
            { label: 'Completions', value: statsTotal.completions, icon: <CheckCircle size={18} /> },
            { label: 'Certificates Issued', value: statsTotal.certificates, icon: <Award size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i + 1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : courses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">Courses</div>
            <p style={{ marginBottom: 20 }}>You have not created any courses yet.</p>
            <Link to="/forge/build" className="btn btn-primary"><PlusCircle size={16} /> Create Your First Course</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {courses.map((course, i) => {
              const cfg = STATUS_CONFIG[course.status] || STATUS_CONFIG.draft;
              const completionRate = course.enrollments > 0 ? Math.round((course.completions / course.enrollments) * 100) : 0;
              return (
                <div key={course.id} className={`card animate-fade-in stagger-${Math.min(i + 1, 5)}`}>
                  <div className="card-body" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: 12, flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'white', fontWeight: 800,
                    }}>
                      {course.difficulty}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>{course.title}</h4>
                        <span className={`badge ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                      </div>
                      <p style={{
                        fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12,
                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                      }}>
                        {course.description || 'No description'}
                      </p>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        {[
                          { icon: <BookOpen size={13} />, val: `${course.sections} sections` },
                          { icon: <Users size={13} />, val: `${course.enrollments} enrolled` },
                          { icon: <CheckCircle size={13} />, val: `${course.completions} completed` },
                          { icon: <Award size={13} />, val: `${course.certificates_issued} certs` },
                          course.estimated_hours && { icon: <Clock size={13} />, val: `${course.estimated_hours}h` },
                        ].filter(Boolean).map((item, j) => (
                          <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            {item.icon} {item.val}
                          </span>
                        ))}
                      </div>
                      {course.enrollments > 0 && (
                        <div style={{ marginTop: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 3 }}>
                            <span>Completion Rate</span><span style={{ fontWeight: 700, color: 'var(--primary)' }}>{completionRate}%</span>
                          </div>
                          <div className="progress-bar" style={{ height: 5 }}>
                            <div className="progress-fill" style={{ width: `${completionRate}%` }} />
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => nav(`/forge/course/${course.id}`)}>
                        <Eye size={13} /> Preview
                      </button>
                      {course.status === 'draft' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => handleSubmitReview(course)}>
                            <Send size={13} /> Submit
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={deleting === course.id}
                            onClick={() => handleDelete(course)}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      )}
                      {course.status === 'pending_review' && canPublish && (
                        <button className="btn btn-success btn-sm" onClick={() => handlePublish(course)}>
                          Publish
                        </button>
                      )}
                      {course.status === 'pending_review' && !canPublish && (
                        <div className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                          Awaiting Admin
                        </div>
                      )}
                      {course.status === 'published' && (
                        <>
                          <button className="btn btn-shimmer btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => openAssignModal(course)}>
                            <Send size={13} /> Assign
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }} onClick={() => openLearners(course)}>
                            <BarChart2 size={13} /> Learners
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedCourse && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
          }}>
            <div className="card" style={{ width: 'min(980px, 100%)', maxHeight: '80vh', overflow: 'hidden' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>Learner Tracker</h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{selectedCourse.title}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedCourse(null)}>Close</button>
              </div>
              <div className="card-body" style={{ maxHeight: 'calc(80vh - 80px)', overflow: 'auto' }}>
                {learnersLoading ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner spinner-lg" /></div>
                ) : learnerRows.length === 0 ? (
                  <div style={{ padding: 24, color: 'var(--text-muted)', textAlign: 'center' }}>No learners enrolled yet.</div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Learner</th>
                          <th>Progress</th>
                          <th>Status</th>
                          <th>Enrolled</th>
                          <th>Last Active</th>
                        </tr>
                      </thead>
                      <tbody>
                        {learnerRows.map((row) => (
                          <tr key={row.enrollment_id}>
                            <td style={{ fontWeight: 600 }}>{row.learner_name}</td>
                            <td style={{ minWidth: 180 }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span>{Math.round(row.progress_percent || 0)}%</span>
                                </div>
                                <div className="progress-bar" style={{ height: 6 }}>
                                  <div className="progress-fill" style={{ width: `${row.progress_percent || 0}%` }} />
                                </div>
                              </div>
                            </td>
                            <td>{row.completed_at ? <span className="badge badge-success">Completed</span> : <span className="badge badge-info">In Progress</span>}</td>
                            <td>{row.enrolled_at ? new Date(row.enrolled_at).toLocaleDateString() : '-'}</td>
                            <td>{row.last_accessed_at ? new Date(row.last_accessed_at).toLocaleString() : 'No activity yet'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {assignModal.open && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.55)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24
          }}>
            <div className="card animate-scale-in" style={{ width: 'min(540px, 100%)', maxHeight: '85vh', overflow: 'hidden' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>Assign Course</h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{selectedCourseForAssign?.title}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setAssignModal({ ...assignModal, open: false })}>✕</button>
              </div>
              <div className="card-body" style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 80px)' }}>
                <form onSubmit={handleAssign}>
                  <div className="form-group" style={{ marginBottom: 16 }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Search Users</label>
                    <input type="text" className="form-control" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.map(c => c.id))}>Select All</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.filter(c => c.role === 'employee').map(c => c.id))}>All Employees</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.filter(c => c.role === 'candidate').map(c => c.id))}>All Trainees</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedCandidates([])}>Clear</button>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16 }}>
                    {candidates.filter(c => (c.full_name || '').toLowerCase().includes(search.toLowerCase()) || (c.email || '').toLowerCase().includes(search.toLowerCase())).map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderBottom: '1px solid var(--border)', cursor: 'pointer', margin: 0 }}>
                        <input type="checkbox" checked={selectedCandidates.includes(c.id)} onChange={e => {
                          setSelectedCandidates(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                        }} style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ fontWeight: 600 }}>{c.full_name || 'User'}</div>
                          <span className={`badge ${c.role === 'employee' ? 'badge-info' : 'badge-muted'}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                            {c.role === 'employee' ? 'Employee' : 'Trainee'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.email}</div>
                      </label>
                    ))}
                    {candidates.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</div>}
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: 6 }}>Deadline (Optional)</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={assignModal.deadline} 
                      onChange={e => setAssignModal({ ...assignModal, deadline: e.target.value })} 
                      style={{ width: '100%' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setAssignModal({ ...assignModal, open: false })}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={assignModal.loading || selectedCandidates.length === 0}>
                      {assignModal.loading ? 'Assigning...' : `Assign to ${selectedCandidates.length} User(s)`}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
