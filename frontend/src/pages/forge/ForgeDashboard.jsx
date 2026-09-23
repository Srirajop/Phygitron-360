import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, Award, PlayCircle, Clock, ChevronRight,
  TrendingUp, CheckCircle, ArrowUpRight, Sparkles, Layers,
  Bookmark, AlertTriangle, Calendar, FileText
} from 'lucide-react';
import './forge_styles.css';
import BorderGlow from '../../components/BorderGlow';
import TopHeader from '../../components/TopHeader';

export default function ForgeDashboard() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('in_progress'); // 'in_progress', 'assigned', 'completed'

  useEffect(() => {
    forgeApi.myLearning()
      .then(res => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const continueCourse = data?.continue_learning;
  const inProgress = data?.in_progress || [];
  const assigned = data?.assigned || [];
  const completed = data?.completed || [];
  const certificates = data?.certificates || [];
  const stats = data?.stats || {};

  return (
    <div className="forge-container forge-grain" style={{ minHeight: '100vh', padding: '0 40px 80px' }}>
      <TopHeader />

      {/* Hero / Greeting */}
      <div style={{ padding: '36px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(124, 58, 237, 0.12)', color: 'var(--forge-accent)', fontWeight: 800, fontSize: '0.72rem', textTransform: 'uppercase' }}>
              Employee Learning Portal
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--forge-text-main)' }}>
            Welcome back, {user?.full_name?.split(' ')[0] || 'Learner'} 👋
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Resume your assigned training modules right where you left off
          </p>
        </div>

        <Link
          to="/forge/library"
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 20px',
            borderRadius: 12,
            fontWeight: 800,
            fontSize: '0.85rem',
          }}
        >
          <Layers size={16} /> Explore Course Library →
        </Link>
      </div>

      {/* ── Stat Highlights ──────────────────────────────────────────────── */}
      <div className="stats-grid animate-fade-in" style={{ marginBottom: 32 }}>
        {[
          { label: 'Assigned Courses', value: stats.total_assigned || 0, icon: <BookOpen size={20} />, color: '#7C3AED' },
          { label: 'In Progress', value: stats.in_progress_count || 0, icon: <PlayCircle size={20} />, color: '#3B82F6' },
          { label: 'Courses Completed', value: stats.completed_count || 0, icon: <CheckCircle size={20} />, color: '#10B981' },
          { label: 'Certificates Earned', value: stats.certificates_count || 0, icon: <Award size={20} />, color: '#F59E0B' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ borderRadius: 18, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span className="stat-label" style={{ fontWeight: 700, fontSize: '0.82rem' }}>{s.label}</span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: `${s.color}15`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.icon}
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: 900, color: s.color }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Hero Continue Learning / Bookmark Card ──────────────────────── */}
      {continueCourse && (
        <div style={{ marginBottom: 36 }}>
          <BorderGlow
            borderRadius={24}
            glowRadius={36}
            glowIntensity={0.6}
            backgroundColor="var(--forge-bg)"
          >
            <div
              style={{
                padding: '28px 32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 24,
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(15, 23, 42, 0.9) 100%)',
                borderRadius: 24,
                border: '1px solid rgba(124, 58, 237, 0.25)',
              }}
            >
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span
                    style={{
                      background: 'rgba(124, 58, 237, 0.2)',
                      color: continueCourse.domain_color || '#A78BFA',
                      padding: '3px 10px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                    }}
                  >
                    {continueCourse.domain_name || 'General'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Bookmark size={13} style={{ color: '#F59E0B' }} />
                    {continueCourse.scorm_location ? `Saved Bookmark: ${continueCourse.scorm_location}` : 'In Progress'}
                  </span>
                </div>

                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.45rem', fontWeight: 900, color: 'var(--forge-text-main)' }}>
                  {continueCourse.title}
                </h3>

                <p style={{ margin: '0 0 16px 0', color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: 640 }}>
                  {continueCourse.description || 'Pick up right where you left off. Your SCORM runtime state is saved.'}
                </p>

                {/* Progress bar */}
                <div style={{ maxWidth: 380 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Overall Progress</span>
                    <span style={{ fontWeight: 800, color: 'var(--forge-accent)' }}>
                      {Math.round(continueCourse.progress_percent)}% Complete
                    </span>
                  </div>
                  <div className="progress-bar" style={{ height: 6, background: 'rgba(255,255,255,0.08)' }}>
                    <div className="progress-fill" style={{ width: `${continueCourse.progress_percent}%`, background: 'var(--forge-accent)' }} />
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={() => nav(`/forge/course/${continueCourse.course_id}`)}
                  className="btn btn-primary"
                  style={{
                    padding: '14px 28px',
                    borderRadius: 14,
                    fontSize: '0.95rem',
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                    boxShadow: '0 8px 24px rgba(124, 58, 237, 0.4)',
                  }}
                >
                  <PlayCircle size={20} /> Resume at Bookmark
                </button>
              </div>
            </div>
          </BorderGlow>
        </div>
      )}

      {/* ── Courses Tabbed View ───────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        <button
          onClick={() => setActiveTab('in_progress')}
          style={{
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'in_progress' ? '3px solid var(--forge-accent)' : '3px solid transparent',
            color: activeTab === 'in_progress' ? 'var(--forge-accent)' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <PlayCircle size={16} /> In Progress ({inProgress.length})
        </button>

        <button
          onClick={() => setActiveTab('assigned')}
          style={{
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'assigned' ? '3px solid var(--forge-accent)' : '3px solid transparent',
            color: activeTab === 'assigned' ? 'var(--forge-accent)' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Calendar size={16} /> Assigned ({assigned.length})
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          style={{
            padding: '12px 16px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'completed' ? '3px solid var(--forge-accent)' : '3px solid transparent',
            color: activeTab === 'completed' ? 'var(--forge-accent)' : 'var(--text-muted)',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={16} /> Completed ({completed.length})
        </button>
      </div>

      {/* ── Courses List for Active Tab ───────────────────────────────────── */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : (
        <div>
          {activeTab === 'in_progress' && (
            inProgress.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 20 }}>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 16px' }}>No courses currently in progress.</p>
                <Link to="/forge/library" className="btn btn-secondary btn-sm">Browse Course Catalog</Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {inProgress.map(c => (
                  <CourseItemCard key={c.enrollment_id} course={c} onLaunch={() => nav(`/forge/course/${c.course_id}`)} />
                ))}
              </div>
            )
          )}

          {activeTab === 'assigned' && (
            assigned.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 20 }}>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 16px' }}>You have no pending assigned courses.</p>
                <Link to="/forge/library" className="btn btn-secondary btn-sm">Explore Library</Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {assigned.map(c => (
                  <CourseItemCard key={c.enrollment_id} course={c} onLaunch={() => nav(`/forge/course/${c.course_id}`)} />
                ))}
              </div>
            )
          )}

          {activeTab === 'completed' && (
            completed.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', borderRadius: 20 }}>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 16px' }}>No completed courses yet. Finish your first module to earn certificates!</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                {completed.map(c => (
                  <CourseItemCard key={c.enrollment_id} course={c} onLaunch={() => nav(`/forge/course/${c.course_id}`)} isCompleted />
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

function CourseItemCard({ course, onLaunch, isCompleted }) {
  const progressPct = Math.round(course.progress_percent || 0);

  return (
    <BorderGlow
      borderRadius={18}
      glowRadius={25}
      glowIntensity={0.4}
      backgroundColor="var(--forge-bg)"
      className="forge-course-card"
    >
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span
            style={{
              background: course.domain_color ? `${course.domain_color}20` : 'rgba(124, 58, 237, 0.1)',
              color: course.domain_color || '#A78BFA',
              padding: '2px 8px',
              borderRadius: 6,
              fontSize: '0.7rem',
              fontWeight: 800,
            }}
          >
            {course.domain_name || 'General'}
          </span>

          {course.deadline && (
            <span style={{ fontSize: '0.72rem', color: course.is_overdue ? '#EF4444' : 'var(--text-muted)', fontWeight: course.is_overdue ? 800 : 600 }}>
              Due: {new Date(course.deadline).toLocaleDateString()}
            </span>
          )}
        </div>

        <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 800, lineHeight: 1.3, color: 'var(--forge-text-main)' }}>
          {course.title}
        </h4>

        {course.scorm_location && (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
            <Bookmark size={11} style={{ color: '#F59E0B' }} />
            Bookmark: {course.scorm_location}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 14 }}>
          {isCompleted ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                Completed
              </span>
              {course.score !== null && (
                <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#10B981' }}>
                  Score: {course.score}%
                </span>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                <span>Progress</span>
                <span style={{ fontWeight: 700, color: 'var(--forge-accent)' }}>{progressPct}%</span>
              </div>
              <div className="progress-bar" style={{ height: 4 }}>
                <div className="progress-fill" style={{ width: `${progressPct}%`, background: 'var(--forge-accent)' }} />
              </div>
            </div>
          )}

          <button
            onClick={onLaunch}
            className="btn btn-primary btn-sm"
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <PlayCircle size={14} />
            {isCompleted ? 'Review Course' : progressPct > 0 ? 'Resume Course' : 'Launch Module'}
          </button>
        </div>
      </div>
    </BorderGlow>
  );
}
