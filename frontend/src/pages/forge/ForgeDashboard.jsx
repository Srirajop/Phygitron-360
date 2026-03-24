import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { BookOpen, Award, PlayCircle, Clock, ChevronRight, Brain } from 'lucide-react';

const DIFF_BADGE = { beginner: 'badge-success', intermediate: 'badge-info', advanced: 'badge-primary', expert: 'badge-danger' };
const DIFF_EMOJI = { beginner: '🌱', intermediate: '🌿', advanced: '🔥', expert: '⭐' };

function CourseCard({ course, onNavigate }) {
  return (
    <div className="course-card" onClick={onNavigate}>
      <div className="course-card-thumb">
        <span style={{ position: 'relative', zIndex: 2 }}>{DIFF_EMOJI[course.difficulty] || '📚'}</span>
      </div>
      <div className="course-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <h4 style={{ flex: 1, paddingRight: 8 }}>{course.title}</h4>
          <span className={`badge ${DIFF_BADGE[course.difficulty] || 'badge-muted'}`} style={{ flexShrink: 0 }}>{course.difficulty}</span>
        </div>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{course.description}</p>
        {course.progress_percent !== undefined && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Progress</span><span>{course.progress_percent?.toFixed(0)}%</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${course.progress_percent}%` }} /></div>
          </div>
        )}
        {course.estimated_hours && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 10 }}><Clock size={12} style={{ verticalAlign: 'middle' }} /> {course.estimated_hours}h estimated</div>}
      </div>
    </div>
  );
}

export default function ForgeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ in_progress: [], recommended: [], completed: [] });
  const [allCourses, setAllCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    Promise.all([forgeApi.dashboard(), forgeApi.listCourses()])
      .then(([d, c]) => { setData(d.data.data || {}); setAllCourses(c.data.data || []); })
      .finally(() => setLoading(false));
  }, []);

  const totalCompleted = data.completed?.length || 0;
  const totalEnrolled = (data.in_progress?.length || 0) + totalCompleted;

  return (
    <div>
      <div className="page-header">
        <h1>Learning Hub 📚</h1>
        <p>Continue learning, explore new courses, and build your skills</p>
      </div>
      <div className="page-body">
        <div className="stats-grid animate-fade-in">
          {[
            { label: 'Enrolled Courses', value: totalEnrolled, icon: <BookOpen size={18} /> },
            { label: 'Completed', value: totalCompleted, icon: <Award size={18} /> },
            { label: 'AI Recommended', value: data.recommended?.length || 0, icon: <Brain size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div> : (<>

          {data.in_progress?.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <h3 style={{ marginBottom: 16 }}>▶️ Continue Learning</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 20 }}>
                {data.in_progress.map(c => <CourseCard key={c.course_id} course={{ ...c, title: c.title, description: c.description, difficulty: c.difficulty, estimated_hours: null, progress_percent: c.progress_percent }} onNavigate={() => nav(`/forge/course/${c.course_id}`)} />)}
              </div>
            </div>
          )}

          {data.recommended?.length > 0 && (
            <div style={{ marginBottom: 40 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Brain size={20} color="var(--primary)" />
                <h3>AI Recommended for You</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 20 }}>
                {data.recommended.map(c => <CourseCard key={c.course_id} course={c} onNavigate={() => nav(`/forge/course/${c.course_id}`)} />)}
              </div>
            </div>
          )}

          {allCourses.length > 0 && (
            <div>
              <h3 style={{ marginBottom: 16 }}>🔍 Explore All Courses</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px,1fr))', gap: 20 }}>
                {allCourses.map(c => <CourseCard key={c.id} course={c} onNavigate={() => nav(`/forge/course/${c.id}`)} />)}
              </div>
            </div>
          )}

          {allCourses.length === 0 && data.in_progress?.length === 0 && (
            <div className="empty-state"><div className="empty-icon">📚</div><p>No courses available yet — check back soon!</p></div>
          )}
        </>)}
      </div>
    </div>
  );
}
