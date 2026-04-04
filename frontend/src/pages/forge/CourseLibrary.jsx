import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Search, Filter, BookOpen, Clock, ChevronRight, CheckCircle,
  SlidersHorizontal, X, Star, Zap
} from 'lucide-react';
import toast from 'react-hot-toast';

const DIFF_CONFIG = {
  beginner:     { badge: 'badge-success', emoji: '🌱', label: 'Beginner' },
  intermediate: { badge: 'badge-info',    emoji: '🌿', label: 'Intermediate' },
  advanced:     { badge: 'badge-primary', emoji: '🔥', label: 'Advanced' },
  expert:       { badge: 'badge-danger',  emoji: '⭐', label: 'Expert' },
};

function CourseCard({ course, onEnroll, onNavigate }) {
  const [enrolling, setEnrolling] = useState(false);
  const cfg = DIFF_CONFIG[course.difficulty] || DIFF_CONFIG.beginner;

  const handleEnroll = async (e) => {
    e.stopPropagation();
    if (course.enrolled) { onNavigate(); return; }
    setEnrolling(true);
    try {
      await forgeApi.enroll(course.id);
      toast.success('Enrolled successfully!');
      onEnroll(course.id);
    } catch {
      toast.error('Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <div className="course-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="course-card-thumb" style={{ cursor: 'pointer' }} onClick={onNavigate}>
        <span style={{ position: 'relative', zIndex: 2, fontSize: '2.5rem' }}>{cfg.emoji}</span>
        <span className={`badge ${cfg.badge}`} style={{ position: 'absolute', top: 12, right: 12, zIndex: 3 }}>
          {cfg.label}
        </span>
      </div>
      <div className="course-card-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ marginBottom: 6, fontSize: '0.95rem', cursor: 'pointer' }} onClick={onNavigate}>
          {course.title}
        </h4>
        <p style={{
          flex: 1, fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 14,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{course.description}</p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {course.estimated_hours && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Clock size={12} /> {course.estimated_hours}h
            </span>
          )}
        </div>

        <button
          className={`btn btn-block ${course.enrolled ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleEnroll}
          disabled={enrolling}
          style={{ fontWeight: 700 }}
        >
          {enrolling ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            : course.enrolled ? <><CheckCircle size={15} /> Continue Learning</>
            : <><Zap size={15} /> Enroll Now</>
          }
        </button>
      </div>
    </div>
  );
}

export default function CourseLibrary() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [courses, setCourses] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [dFilter, setDFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const res = await forgeApi.library({ q: search || undefined, difficulty: dFilter || undefined, page: pg, limit: 12 });
      const d = res.data.data || {};
      setCourses(d.courses || []);
      setTotal(d.total || 0);
      setPages(d.pages || 1);
      setPage(pg);
    } catch {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [search, dFilter]);

  useEffect(() => { load(1); }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const handleEnroll = (courseId) => {
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, enrolled: true } : c));
  };

  const difficulties = ['', 'beginner', 'intermediate', 'advanced', 'expert'];
  const diffLabels = { '': 'All Levels', beginner: '🌱 Beginner', intermediate: '🌿 Intermediate', advanced: '🔥 Advanced', expert: '⭐ Expert' };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Course Library</h1>
          <p>Explore {total} course{total !== 1 ? 's' : ''} available for your organisation</p>
        </div>
        {['instructor', 'admin', 'hr'].includes(user?.role) && (
          <button className="btn btn-primary" onClick={() => nav('/forge/build')}>
            <Zap size={16} /> Create Course
          </button>
        )}
      </div>

      <div className="page-body">
        {/* Search + Filter Bar */}
        <div className="card animate-fade-in" style={{ marginBottom: 28 }}>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 8, minWidth: 220 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    id="course-search"
                    className="form-control"
                    placeholder="Search courses…"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    style={{ paddingLeft: 38 }}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 18px' }}>Search</button>
                {(search || dFilter) && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setSearchInput(''); setDFilter(''); }}>
                    <X size={14} /> Clear
                  </button>
                )}
              </form>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <SlidersHorizontal size={14} /> Filter:
                </div>
                {difficulties.map(d => (
                  <button
                    key={d}
                    className={`btn btn-sm ${dFilter === d ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setDFilter(d)}
                    style={{ fontSize: '0.78rem' }}
                  >
                    {diffLabels[d]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>
        ) : courses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <p>No courses found{search ? ` for "${search}"` : ''}.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px,1fr))', gap: 20, marginBottom: 32 }}>
              {courses.map((c, i) => (
                <div key={c.id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                  <CourseCard
                    course={c}
                    onEnroll={handleEnroll}
                    onNavigate={() => nav(`/forge/course/${c.id}`)}
                  />
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => load(page - 1)}>← Prev</button>
                <span style={{ padding: '8px 16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Page {page} of {pages}
                </span>
                <button className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => load(page + 1)}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
