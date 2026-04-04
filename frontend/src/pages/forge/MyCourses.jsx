import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgeApi } from '../../api';
import {
  BookOpen, PlusCircle, Users, Award, CheckCircle, Clock,
  Eye, Edit2, Trash2, Send, BarChart2, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  draft:          { badge: 'badge-muted',    label: 'Draft',           icon: '✏️' },
  pending_review: { badge: 'badge-warning',  label: 'Pending Review',  icon: '⏳' },
  published:      { badge: 'badge-success',  label: 'Published',       icon: '✅' },
};

export default function MyCourses() {
  const nav = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  const load = () => {
    setLoading(true);
    forgeApi.myCourses()
      .then(r => {
        const d = r.data.data;
        setCourses(Array.isArray(d) ? d : []);
      })
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

  const courseList = Array.isArray(courses) ? courses : [];
  const statsTotal = {
    enrollments:  courseList.reduce((s, c) => s + (c.enrollments  || 0), 0),
    completions:  courseList.reduce((s, c) => s + (c.completions  || 0), 0),
    certificates: courseList.reduce((s, c) => s + (c.certificates_issued || 0), 0),
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
        {/* Summary Stats */}
        <div className="stats-grid animate-fade-in" style={{ marginBottom: 28 }}>
          {[
            { label: 'Total Courses', value: courseList.length, icon: <BookOpen size={18} /> },
            { label: 'Total Enrollments', value: statsTotal.enrollments, icon: <Users size={18} /> },
            { label: 'Completions', value: statsTotal.completions, icon: <CheckCircle size={18} /> },
            { label: 'Certificates Issued', value: statsTotal.certificates, icon: <Award size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : courseList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <p style={{ marginBottom: 20 }}>You haven't created any courses yet.</p>
            <Link to="/forge/build" className="btn btn-primary"><PlusCircle size={16} /> Create Your First Course</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {courseList.map((course, i) => {
              const cfg = STATUS_CONFIG[course.status] || STATUS_CONFIG.draft;
              const completionRate = course.enrollments > 0 ? Math.round((course.completions / course.enrollments) * 100) : 0;
              return (
                <div key={course.id} className={`card animate-fade-in stagger-${Math.min(i+1,5)}`}>
                  <div className="card-body" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                    {/* Left: thumb */}
                    <div style={{
                      width: 80, height: 80, borderRadius: 12, flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
                    }}>
                      {{ beginner: '🌱', intermediate: '🌿', advanced: '🔥', expert: '⭐' }[course.difficulty] || '📚'}
                    </div>

                    {/* Middle: info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>{course.title}</h4>
                        <span className={`badge ${cfg.badge}`}>{cfg.icon} {cfg.label}</span>
                        <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>{course.difficulty}</span>
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12,
                        display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
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

                    {/* Right: actions */}
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
                      {course.status === 'pending_review' && (
                        <button className="btn btn-success btn-sm" onClick={() => handlePublish(course)}>
                          ✅ Publish
                        </button>
                      )}
                      {course.status === 'published' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.75rem' }}
                          onClick={async () => {
                            try {
                              const res = await forgeApi.courseEnrollments(course.id);
                              const enrolls = res.data.data || [];
                              alert(`${enrolls.length} learners enrolled`);
                            } catch {}
                          }}
                        >
                          <BarChart2 size={13} /> Learners
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
