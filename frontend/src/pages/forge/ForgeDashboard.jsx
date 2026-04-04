import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, Award, PlayCircle, Clock, ChevronRight, Brain,
  TrendingUp, Star, Zap, Target, Search, Filter, GraduationCap, CheckCircle
} from 'lucide-react';

const DIFF_CONFIG = {
  beginner:     { badge: 'badge-success', emoji: '🌱', color: '#10B981' },
  intermediate: { badge: 'badge-info',    emoji: '🌿', color: '#3B82F6' },
  advanced:     { badge: 'badge-primary', emoji: '🔥', color: '#8B5CF6' },
  expert:       { badge: 'badge-danger',  emoji: '⭐', color: '#EF4444' },
};

function ProgressRing({ percent, size = 56, stroke = 5 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--primary-lighter)" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="var(--primary)" strokeWidth={stroke} fill="none"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
    </svg>
  );
}

function CourseCard({ course, onNavigate, showProgress }) {
  const cfg = DIFF_CONFIG[course.difficulty] || DIFF_CONFIG.beginner;
  return (
    <div
      className="course-card animate-fade-in"
      onClick={onNavigate}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
    >
      <div className="course-card-thumb" style={{ position: 'relative' }}>
        <span style={{ position: 'relative', zIndex: 2, fontSize: '2.5rem' }}>{cfg.emoji}</span>
        <span className={`badge ${cfg.badge}`} style={{
          position: 'absolute', top: 12, right: 12, zIndex: 3
        }}>{course.difficulty}</span>
        {course.enrolled && (
          <span style={{
            position: 'absolute', top: 12, left: 12, zIndex: 3,
            background: 'rgba(16,185,129,0.9)', color: 'white',
            borderRadius: '999px', padding: '3px 10px', fontSize: '0.7rem', fontWeight: 700
          }}>✓ Enrolled</span>
        )}
      </div>
      <div className="course-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ marginBottom: 6, fontSize: '0.95rem', lineHeight: 1.3 }}>{course.title}</h4>
        <p style={{
          flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>{course.description}</p>

        {showProgress && course.progress_percent !== undefined && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Progress</span><span style={{ fontWeight: 700, color: 'var(--primary)' }}>{course.progress_percent?.toFixed(0)}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${course.progress_percent}%` }} /></div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
          {course.estimated_hours && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Clock size={12} /><span>{course.estimated_hours}h</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, marginLeft: 'auto' }}>
            <span>View Course</span><ChevronRight size={12} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '10px',
          background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
        }}>{icon}</div>
        <h3 style={{ margin: 0 }}>{title}</h3>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export default function ForgeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ in_progress: [], recommended: [], completed: [] });
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();
  const isInstructor = ['instructor', 'admin', 'hr'].includes(user?.role);

  useEffect(() => {
    Promise.all([forgeApi.dashboard(), forgeApi.library({ limit: 9 })])
      .then(([d, lib]) => {
        const raw = d.data.data || {};
        setData({
          in_progress:  Array.isArray(raw.in_progress)  ? raw.in_progress  : [],
          recommended:  Array.isArray(raw.recommended)  ? raw.recommended  : [],
          completed:    Array.isArray(raw.completed)    ? raw.completed    : [],
        });
        const courses = lib.data.data?.courses;
        setAllCourses(Array.isArray(courses) ? courses : []);
      })
      .finally(() => setLoading(false));
  }, []);

  const totalCompleted = data.completed?.length || 0;
  const totalInProgress = data.in_progress?.length || 0;
  const totalRecommended = data.recommended?.length || 0;

  const stats = [
    { label: 'In Progress', value: totalInProgress, icon: <PlayCircle size={18} />, color: '#8B5CF6' },
    { label: 'Completed', value: totalCompleted, icon: <CheckCircle size={18} />, color: '#10B981' },
    { label: 'AI Recommended', value: totalRecommended, icon: <Brain size={18} />, color: '#EC4899' },
    { label: 'Available Courses', value: allCourses.length, icon: <BookOpen size={18} />, color: '#3B82F6' },
  ];

  return (
    <div>
      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, #9333EA 50%, #EC4899 100%)',
        padding: '40px 32px 48px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.07,
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <GraduationCap size={28} color="rgba(255,255,255,0.9)" />
                <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>PHYGITRON 360 — FORGE LXP</span>
              </div>
              <h1 style={{ color: 'white', fontSize: '2rem', marginBottom: 8 }}>
                Welcome back, {user?.full_name?.split(' ')[0] || 'Learner'}! 👋
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '1rem', margin: 0 }}>
                {totalInProgress > 0
                  ? `You have ${totalInProgress} course${totalInProgress > 1 ? 's' : ''} in progress. Keep the momentum going!`
                  : 'Start your learning journey today — explore courses tailored for you.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <Link to="/forge/library" className="btn" style={{
                background: 'rgba(255,255,255,0.15)', color: 'white',
                border: '1.5px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(10px)',
              }}>
                <Search size={16} /> Browse Library
              </Link>
              {isInstructor && (
                <Link to="/forge/build" className="btn" style={{
                  background: 'white', color: 'var(--primary)', fontWeight: 700,
                }}>
                  <Zap size={16} /> Build Course
                </Link>
              )}
            </div>
          </div>

          {/* Inline Stats Strip */}
          <div style={{ display: 'flex', gap: 24, marginTop: 32, flexWrap: 'wrap' }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)',
                borderRadius: 12, padding: '10px 18px',
                border: '1px solid rgba(255,255,255,0.2)',
              }}>
                <div style={{ color: 'rgba(255,255,255,0.8)' }}>{s.icon}</div>
                <div>
                  <div style={{ color: 'white', fontSize: '1.4rem', fontWeight: 900, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.72rem', fontWeight: 600 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            {/* Continue Learning */}
            {data.in_progress?.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <SectionHeader
                  icon={<PlayCircle size={18} />}
                  title="Continue Learning"
                  action={<Link to="/forge/library" className="btn btn-ghost btn-sm">View All <ChevronRight size={14} /></Link>}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 20 }}>
                  {data.in_progress.map((c, i) => (
                    <div key={c.course_id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                      <CourseCard
                        course={{ ...c, id: c.course_id }}
                        onNavigate={() => nav(`/forge/course/${c.course_id}`)}
                        showProgress
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Recommended */}
            {data.recommended?.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <SectionHeader
                  icon={<Brain size={18} />}
                  title="AI Recommended For You"
                  action={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'linear-gradient(135deg, #EC4899, #8B5CF6)', borderRadius: 999, padding: '4px 14px' }}>
                      <Zap size={12} color="white" />
                      <span style={{ color: 'white', fontSize: '0.72rem', fontWeight: 700 }}>Skill Gap Detected</span>
                    </div>
                  }
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 20 }}>
                  {data.recommended.map((c, i) => (
                    <div key={c.course_id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                      <CourseCard
                        course={{ ...c, id: c.course_id }}
                        onNavigate={() => nav(`/forge/course/${c.course_id}`)}
                        showProgress={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {data.completed?.length > 0 && (
              <div style={{ marginBottom: 48 }}>
                <SectionHeader
                  icon={<Award size={18} />}
                  title="Completed Courses"
                  action={<Link to="/forge/transcript" className="btn btn-secondary btn-sm"><Award size={14} /> My Transcript</Link>}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 20 }}>
                  {data.completed.slice(0, 3).map((c, i) => (
                    <div key={c.course_id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}
                      style={{ position: 'relative' }}
                    >
                      <CourseCard
                        course={{ ...c, id: c.course_id, progress_percent: 100 }}
                        onNavigate={() => nav(`/forge/course/${c.course_id}`)}
                        showProgress
                      />
                      <div style={{
                        position: 'absolute', top: 12, left: 12, zIndex: 10,
                        background: '#10B981', borderRadius: 999, padding: '4px 12px',
                        color: 'white', fontSize: '0.72rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <CheckCircle size={11} /> Completed
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explore All Courses */}
            {allCourses.length > 0 && (
              <div>
                <SectionHeader
                  icon={<BookOpen size={18} />}
                  title="Explore Courses"
                  action={<Link to="/forge/library" className="btn btn-secondary btn-sm"><Search size={14} /> Full Library</Link>}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 20 }}>
                  {allCourses.map((c, i) => (
                    <div key={c.id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                      <CourseCard
                        course={c}
                        onNavigate={() => nav(`/forge/course/${c.id}`)}
                        showProgress={false}
                      />
                    </div>
                  ))}
                </div>
                <div style={{ textAlign: 'center', marginTop: 32 }}>
                  <Link to="/forge/library" className="btn btn-primary">
                    <BookOpen size={16} /> Browse Full Course Library
                  </Link>
                </div>
              </div>
            )}

            {allCourses.length === 0 && data.in_progress?.length === 0 && (
              <div className="empty-state" style={{ padding: '80px 32px' }}>
                <div style={{ fontSize: '5rem', marginBottom: 16 }}>📚</div>
                <h3 style={{ marginBottom: 8 }}>No courses available yet</h3>
                <p style={{ marginBottom: 24 }}>Your learning journey starts when courses are published for your organisation.</p>
                {isInstructor && (
                  <Link to="/forge/build" className="btn btn-primary">
                    <Zap size={16} /> Create Your First Course
                  </Link>
                )}
              </div>
            )}

            {/* Quick Links */}
            {isInstructor && (
              <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))', gap: 16 }}>
                {[
                  { to: '/forge/my-courses', icon: <BookOpen size={20} />, label: 'My Courses', sub: 'Manage your created courses' },
                  { to: '/forge/build', icon: <Zap size={20} />, label: 'Build Course', sub: 'Create new content' },
                  { to: '/forge/transcript', icon: <Award size={20} />, label: 'Transcript', sub: 'View your certificates' },
                  { to: '/forge/team', icon: <TrendingUp size={20} />, label: 'Team Analytics', sub: 'Track team learning' },
                ].map((item, i) => (
                  <Link key={i} to={item.to} style={{ textDecoration: 'none' }}>
                    <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: 'linear-gradient(135deg, var(--primary-lightest), rgba(168,85,247,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
                        flexShrink: 0,
                      }}>{item.icon}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.label}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.sub}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
