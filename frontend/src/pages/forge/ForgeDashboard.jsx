import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, Award, PlayCircle, Clock, ChevronRight, Brain,
  TrendingUp, Star, Zap, Target, Search, Filter, GraduationCap, CheckCircle,
  ArrowUpRight, Sparkles, Activity, Layers
} from 'lucide-react';
import './forge_styles.css';

const DIFF_CONFIG = {
  beginner:     { badge: 'badge-success', color: '#10B981', label: 'Beginner' },
  intermediate: { badge: 'badge-info',    color: '#3B82F6', label: 'Intermediate' },
  advanced:     { badge: 'badge-primary', color: '#8257e5', label: 'Advanced' },
  expert:       { badge: 'badge-danger',  color: '#EF4444', label: 'Expert' },
};

const getGradient = (id) => {
  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)',
    'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)',
    'linear-gradient(135deg, #09203f 0%, #537895 100%)',
    'linear-gradient(135deg, #b721ff 0%, #21d4fd 100%)',
    'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
  ];
  return gradients[id % gradients.length];
};

function CompactCourseCard({ course, onNavigate, showProgress }) {
  const cfg = DIFF_CONFIG[course.difficulty] || DIFF_CONFIG.beginner;
  return (
    <div className="forge-course-card" onClick={onNavigate}>
      <div className="forge-thumbnail" style={{ background: getGradient(course.course_id || course.id), height: 120 }}>
        <div className="forge-thumbnail-overlay" />
        <BookOpen size={24} color="rgba(255,255,255,0.8)" style={{ position: 'relative', zIndex: 2 }} />
        <span className={`forge-card-badge ${cfg.badge}`} style={{ color: 'white', background: cfg.color, transform: 'scale(0.8)', transformOrigin: 'top right' }}>
          {cfg.label}
        </span>
      </div>
      <div className="card-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h4 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', lineHeight: 1.3, fontWeight: 700 }}>{course.title}</h4>
        
        {showProgress && course.progress_percent !== undefined ? (
          <div style={{ marginTop: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{Math.round(course.progress_percent)}% Complete</span>
            </div>
            <div className="progress-bar" style={{ height: 4 }}>
              <div className="progress-fill shimmer-progress" style={{ width: `${course.progress_percent}%` }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
             <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {course.estimated_hours}h</span>
             <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Layers size={12} /> {course.sections_count || 0} Modules</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ icon, title, action, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: '14px',
          background: 'var(--primary-lightest)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
          boxShadow: 'inset 0 0 0 1px var(--primary-lighter)'
        }}>{icon}</div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{title}</h3>
          {subtitle && <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{subtitle}</p>}
        </div>
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
    Promise.all([forgeApi.dashboard(), forgeApi.library({ limit: 10 })])
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

  return (
    <div className="forge-container animate-fade-in" style={{ paddingBottom: 60 }}>
      {/* Premium Multi-dimensional Header */}
      <div style={{
        margin: '24px 32px 48px',
        padding: '60px 48px',
        borderRadius: '32px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
      }}>
        {/* Animated Background Element */}
        <div style={{
          position: 'absolute', top: -100, right: -100, width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%)',
          filter: 'blur(40px)', opacity: 0.6
        }} />
        
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 40 }}>
          <div style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
               <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', color: 'white', padding: '6px 16px', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Sparkles size={12} className="active-pulse" /> Learning Dashboard
               </div>
            </div>
            <h1 style={{ color: 'white', fontSize: '3rem', margin: '0 0 12px 0', letterSpacing: '-0.03em' }}>
              Welcome, {user?.full_name?.split(' ')[0] || 'Explorer'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.15rem', lineHeight: 1.5, margin: 0 }}>
              {totalInProgress > 0 
                ? `You are currently enrolled in ${totalInProgress} learning paths. Keep up the great work!` 
                : 'Your journey starts here. Explore our premium curriculum designed to accelerate your growth.'}
            </p>
            
            <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
               <button className="btn btn-primary" onClick={() => nav('/forge/library')} style={{ padding: '14px 32px', borderRadius: '16px' }}>
                  <Search size={18} /> Course Builder
               </button>
               {isInstructor && (
                 <button className="btn" onClick={() => nav('/forge/build')} style={{ padding: '14px 32px', borderRadius: '16px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <Zap size={18} /> Studio
                 </button>
               )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
             {[
               { val: totalInProgress, label: 'Active', icon: <PlayCircle size={18} />, color: 'var(--primary)' },
               { val: totalCompleted, label: 'Mastered', icon: <Award size={18} />, color: '#10B981' },
               { val: totalRecommended, label: 'Goals', icon: <Target size={18} />, color: '#EC4899' },
               { val: allCourses.length, label: 'Course Builder', icon: <Activity size={18} />, color: '#06B6D4' }
             ].map((s, i) => (
                <div key={i} style={{ 
                  background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)',
                  padding: '20px 24px', borderRadius: '24px', minWidth: 140, transition: 'var(--transition)'
                }}>
                   <div style={{ color: s.color, marginBottom: 8 }}>{s.icon}</div>
                   <div style={{ color: 'white', fontSize: '1.75rem', fontWeight: 900, marginBottom: 4 }}>{s.val}</div>
                   <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                </div>
             ))}
          </div>
        </div>
      </div>

      <div className="page-body" style={{ padding: '0 32px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <>
            {/* Continue Learning */}
            {data.in_progress?.length > 0 && (
              <div style={{ marginBottom: 60 }}>
                <SectionHeader
                  icon={<PlayCircle size={20} />}
                  title="Continue Learning"
                  subtitle="Pick up right where you left off"
                  action={<button onClick={() => nav('/forge/library')} className="btn btn-ghost">Full Library <ChevronRight size={14} /></button>}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 28 }}>
                  {data.in_progress.map((c, i) => (
                    <div key={c.course_id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                      <CompactCourseCard
                        course={{ ...c, id: c.course_id }}
                        onNavigate={() => nav(`/forge/course/${c.course_id}`)}
                        showProgress
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 60 }}>
               
               <div>
                  {/* Recommended */}
                  <div style={{ marginBottom: 60 }}>
                    <SectionHeader
                      icon={<Brain size={20} />}
                      title="Recommended Courses"
                      subtitle="Courses tailored for you"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                      {data.recommended.length > 0 ? data.recommended.map((c, i) => (
                        <div key={c.course_id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                          <CompactCourseCard
                            course={{ ...c, id: c.course_id }}
                            onNavigate={() => nav(`/forge/course/${c.course_id}`)}
                            showProgress={false}
                          />
                        </div>
                      )) : (
                        <div className="card" style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', background: 'var(--bg-card-alt)' }}>
                           <p style={{ color: 'var(--text-muted)' }}>Complete more courses to get tailored recommendations.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Recently Published */}
                  <div>
                    <SectionHeader
                      icon={<Activity size={20} />}
                      title="Recently Published"
                      subtitle="New skills available in your workspace"
                    />
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
                      {allCourses.slice(0, 4).map((c, i) => (
                        <div key={c.id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                          <CompactCourseCard
                            course={c}
                            onNavigate={() => nav(`/forge/course/${c.id}`)}
                            showProgress={false}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
               </div>

               {/* Right Sidebar: Quick Actions & Stats */}
               <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                  
                  {/* Instructor Studio Card */}
                  {isInstructor && (
                    <div style={{ 
                      padding: 32, borderRadius: 24, background: 'var(--primary)', color: 'white',
                      boxShadow: '0 20px 40px rgba(124,58,237,0.25)', position: 'relative', overflow: 'hidden'
                    }}>
                       <div style={{ position: 'absolute', top: -20, right: -20, opacity: 0.2 }}>
                          <GraduationCap size={120} />
                       </div>
                       <h4 style={{ color: 'white', marginBottom: 8, fontSize: '1.25rem' }}>Instructor Studio</h4>
                       <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginBottom: 24 }}>Design curricula, manage assessments, and track team capability growth.</p>
                       <button className="btn" style={{ background: 'white', color: 'var(--primary)', width: '100%', borderRadius: 12, fontWeight: 700 }} onClick={() => nav('/forge/build')}>
                          Go To Studio <ArrowUpRight size={16} />
                       </button>
                    </div>
                  )}

                  {/* Mastery Score Progress */}
                  <div className="card" style={{ padding: 24 }}>
                     <h4 style={{ marginBottom: 16, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Standing</h4>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--primary-lightest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '1.5rem', fontWeight: 900 }}>
                           A+
                        </div>
                        <div>
                           <div style={{ fontWeight: 800, fontSize: '1rem' }}>Expert Level</div>
                           <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Top 5% of Organization</div>
                        </div>
                     </div>
                  </div>

                  {/* Certified Skills */}
                  <div className="card" style={{ padding: 24 }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Certifications</h4>
                        <Award size={16} color="var(--primary)" />
                     </div>
                     <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {['Python Pro', 'System Design', 'Agile Lead', 'UX Flow'].map(s => (
                          <div key={s} className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '6px 12px', border: 'none' }}>{s}</div>
                        ))}
                     </div>
                     <Link to="/forge/transcript" style={{ display: 'block', marginTop: 16, fontSize: '0.75rem', fontWeight: 700, textAlign: 'center' }}>View Full Transcript</Link>
                  </div>

               </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
