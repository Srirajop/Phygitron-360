import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgeApi, adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Search, Filter, BookOpen, Clock, ChevronRight, CheckCircle,
  SlidersHorizontal, X, Star, Zap, Layers, PlayCircle, Sparkles, TrendingUp
} from 'lucide-react';
import './forge_styles.css';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import BorderGlow from '../../components/BorderGlow';
import TopHeader from '../../components/TopHeader';

const DIFF_CONFIG = {
  beginner:     { badge: 'badge-success', color: '#10B981', label: 'Beginner' },
  intermediate: { badge: 'badge-info',    color: '#3B82F6', label: 'Intermediate' },
  advanced:     { badge: 'badge-primary', color: '#8257e5', label: 'Advanced' },
  expert:       { badge: 'badge-danger',  color: '#EF4444', label: 'Expert' },
};

function CourseCard({ course, onEnroll, onNavigate, onAssign }) {
  const { user } = useAuth();
  const [enrolling, setEnrolling] = useState(false);
  const cfg = DIFF_CONFIG[course.difficulty] || DIFF_CONFIG.beginner;

  const handleEnroll = async (e) => {
    e.stopPropagation();
    if (course.enrolled) { onNavigate(); return; }
    setEnrolling(true);
    try {
      await forgeApi.enroll(course.id);
      toast.success('Path activated. Enjoy your journey!');
      onEnroll(course.id);
    } catch {
      toast.error('Failed to enroll');
    } finally {
      setEnrolling(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="forge-grain"
    >
      <BorderGlow 
        borderRadius={20} 
        glowRadius={30} 
        glowIntensity={0.6}
        backgroundColor="var(--forge-bg)"
        className="forge-course-card"
      >
        <div style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }} onClick={onNavigate}>
          <div className="forge-thumbnail">
            <div className="forge-thumbnail-overlay" />
            <BookOpen size={40} color="rgba(255,255,255,0.4)" style={{ position: 'relative', zIndex: 2 }} />
            <span className="forge-card-badge">
              {cfg.label}
            </span>
            {course.enrolled && (
              <div style={{ 
                position: 'absolute', bottom: 12, left: 12, zIndex: 10,
                background: 'rgba(16,185,129,0.95)', color: 'white',
                borderRadius: '8px', padding: '4px 10px', fontSize: '0.6rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(4px)'
              }}>
                <CheckCircle size={10} /> ENROLLED
              </div>
            )}
          </div>

          <div className="forge-card-body">
            <div className="forge-card-category">{course.category || 'General'}</div>
            <h4 className="forge-card-title">{course.title}</h4>
            
            <p className="forge-card-desc" style={{
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
            }}>{course.description}</p>

            {course.enrolled && course.progress_percent !== undefined && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span style={{ fontWeight: 800 }}>PROGRESS</span>
                  <span style={{ fontWeight: 800, color: 'var(--forge-accent)' }}>{Math.round(course.progress_percent)}%</span>
                </div>
                <div className="progress-bar" style={{ height: 3, background: 'rgba(255,255,255,0.05)', border: 'none' }}>
                  <div className="progress-fill" style={{ width: `${course.progress_percent}%`, background: 'var(--forge-accent)', boxShadow: 'none' }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
              <div style={{ display: 'flex', gap: 12 }}>
                {course.estimated_hours && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    <Clock size={12} /> {course.estimated_hours}h
                  </span>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <Layers size={12} /> {course.sections_count || 0} Modules
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {['instructor', 'org_admin', 'hr', 'super_admin'].includes(user?.role) && (
                  <button
                    className="btn btn-sm btn-ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAssign(course);
                    }}
                    style={{ 
                      padding: '6px 12px', 
                      borderRadius: '10px', 
                      fontSize: '0.75rem',
                      background: 'rgba(236, 72, 153, 0.1)',
                      color: '#EC4899',
                      border: '1px solid rgba(236, 72, 153, 0.2)',
                      fontWeight: 800
                    }}
                  >
                    ASSIGN
                  </button>
                )}
                <button
                  className={`btn btn-sm ${course.enrolled ? 'btn-ghost' : 'btn-primary'}`}
                  onClick={handleEnroll}
                  disabled={enrolling}
                  style={{ 
                    padding: '6px 16px', 
                    borderRadius: '10px', 
                    fontSize: '0.75rem',
                    background: course.enrolled ? 'var(--forge-card-bg)' : 'var(--forge-accent)',
                    color: course.enrolled ? 'var(--forge-text-main)' : 'white',
                    border: course.enrolled ? '1px solid var(--forge-border)' : 'none',
                    fontWeight: 800
                  }}
                >
                  {enrolling ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                    : course.enrolled ? 'RESUME'
                    : 'START COURSE'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      </BorderGlow>
    </motion.div>
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

  // Course Assignment State
  const [candidates, setCandidates] = useState([]);
  const [assignModal, setAssignModal] = useState({ open: false, courseId: null, deadline: '', loading: false });
  const [selectedCandidates, setSelectedCandidates] = useState([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [selectedCourseForAssign, setSelectedCourseForAssign] = useState(null);

  const openAssignModal = (course) => {
    setSelectedCourseForAssign(course);
    setAssignModal({ open: true, courseId: course.id, deadline: '', loading: false });
    setSelectedCandidates([]);
    setAssignSearch('');
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
    } catch {
      toast.error('Failed to assign course');
      setAssignModal(m => ({ ...m, loading: false }));
    }
  };

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
    setCourses(prev => prev.map(c => c.id === courseId ? { ...c, enrolled: true, progress_percent: 0 } : c));
  };

  const difficulties = ['', 'beginner', 'intermediate', 'advanced', 'expert'];
  const diffLabels = { '': 'All Levels', beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', expert: 'Expert' };

  return (
    <div className="forge-container forge-grain" style={{ minHeight: '100vh', padding: '0 40px 80px' }}>
      <TopHeader />
      
      <div style={{ padding: '60px 0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', color: 'var(--forge-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
              <Layers size={22} />
            </div>
            <h1 style={{ margin: 0, fontSize: '2.8rem', fontWeight: 900, letterSpacing: '-0.05em', color: 'var(--forge-text-main)' }}>Forge</h1>
          </div>
          <p style={{ margin: 0, fontSize: '1.2rem', color: 'var(--forge-text-dim)', maxWidth: 600 }}>Master new skills with clear, step-by-step learning courses.</p>
        </motion.div>
        {['instructor', 'org_admin', 'hr', 'super_admin'].includes(user?.role) && (
          <motion.button 
            whileHover={{ y: -2 }}
            whileTap={{ y: 0 }}
            className="btn btn-shimmer" 
            onClick={() => nav('/forge/build')} 
            style={{ padding: '14px 32px', borderRadius: 16, height: 'auto', fontWeight: 800, letterSpacing: '0.05em' }}
          >
            CREATE COURSE
          </motion.button>
        )}
      </div>

      <div className="page-body" style={{ padding: 0 }}>
        {/* Search + Filter Bar */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <form onSubmit={handleSearch} style={{ flex: 1, display: 'flex', gap: 12, minWidth: 300 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--forge-text-dim)' }} />
                <input
                  id="course-search"
                  className="form-control"
                  placeholder="Query knowledge graphs..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  style={{ 
                    paddingLeft: 52, height: 56, borderRadius: '16px', 
                    background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)',
                    color: 'var(--forge-text-main)', fontSize: '1rem'
                  }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ padding: '0 32px', height: 56, borderRadius: '16px', background: 'var(--forge-accent)', border: 'none', fontWeight: 800 }}>Search</button>
            </form>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--forge-card-bg)', padding: '6px', borderRadius: '18px', border: '1px solid var(--forge-border)' }}>
              {difficulties.map(d => (
                <button
                  key={d}
                  className={`btn btn-sm ${dFilter === d ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setDFilter(d)}
                  style={{ 
                    fontSize: '0.75rem', borderRadius: '14px', padding: '10px 18px',
                    background: dFilter === d ? 'var(--forge-accent)' : 'transparent',
                    color: dFilter === d ? 'white' : 'var(--forge-text-dim)',
                    border: 'none',
                    fontWeight: 700,
                    letterSpacing: '0.02em'
                  }}
                >
                  {diffLabels[d].toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" style={{ borderColor: 'var(--forge-accent)', borderTopColor: 'transparent' }} /></div>
        ) : courses.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '100px 40px', background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)', borderRadius: 24 }}>
            <div style={{ fontSize: '4rem', marginBottom: 24, opacity: 0.5 }}>- 0 -</div>
            <h3 style={{ color: 'white' }}>No paths detected</h3>
            <p style={{ color: 'var(--forge-text-dim)' }}>Zero matches for "{search || 'applied filters'}" in current knowledge base.</p>
            <button className="btn btn-secondary" style={{ marginTop: 24, borderRadius: 12, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }} onClick={() => { setSearch(''); setSearchInput(''); setDFilter(''); }}>RESET FILTERS</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 32, marginBottom: 60 }}>
              {courses.map((c, i) => (
                <CourseCard
                  key={c.id}
                  course={c}
                  onEnroll={handleEnroll}
                  onNavigate={() => nav(`/forge/course/${c.id}`)}
                  onAssign={openAssignModal}
                />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 12, paddingBottom: 60 }}>
                <button className="btn" disabled={page === 1} onClick={() => load(page - 1)} style={{ borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}>PREV</button>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px', fontWeight: 800, background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.85rem' }}>
                  {page} / {pages}
                </div>
                <button className="btn" disabled={page === pages} onClick={() => load(page + 1)} style={{ borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: 'none' }}>NEXT</button>
              </div>
            )}
          </>
        )}

        {assignModal.open && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            backdropFilter: 'blur(8px)'
          }}>
            <div className="card animate-scale-in" style={{ width: 'min(540px, 100%)', maxHeight: '85vh', overflow: 'hidden', background: '#111118', border: '1px solid var(--forge-border)', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px 16px', borderBottom: '1px solid var(--forge-border)' }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--forge-text-main)', fontSize: '1.25rem', fontWeight: 800 }}>Assign Course</h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--forge-text-dim)', marginTop: 4, fontWeight: 600 }}>{selectedCourseForAssign?.title}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setAssignModal({ ...assignModal, open: false })} style={{ color: 'var(--forge-text-dim)', padding: 4, background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
              </div>
              <div className="card-body" style={{ overflowY: 'auto', maxHeight: 'calc(85vh - 120px)', padding: '24px 32px 32px' }}>
                <form onSubmit={handleAssign}>
                  <div className="form-group" style={{ marginBottom: 20 }}>
                    <label className="form-label" style={{ fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--forge-text-main)', fontSize: '0.85rem', letterSpacing: '0.02em' }}>SEARCH USERS</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      placeholder="Search by name or email..." 
                      value={assignSearch} 
                      onChange={e => setAssignSearch(e.target.value)} 
                      style={{ 
                        width: '100%', 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid var(--forge-border)', 
                        color: 'var(--forge-text-main)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '0.9rem'
                      }} 
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.map(c => c.id))} style={{ borderRadius: '8px', fontSize: '0.7rem', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', fontWeight: 700 }}>Select All</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.filter(c => c.role === 'employee').map(c => c.id))} style={{ borderRadius: '8px', fontSize: '0.7rem', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', fontWeight: 700 }}>All Employees</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedCandidates(candidates.filter(c => c.role === 'candidate').map(c => c.id))} style={{ borderRadius: '8px', fontSize: '0.7rem', padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--forge-border)', color: 'var(--forge-text-main)', fontWeight: 700 }}>All Trainees</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedCandidates([])} style={{ borderRadius: '8px', fontSize: '0.7rem', padding: '6px 12px', color: 'var(--forge-text-dim)', fontWeight: 700, border: 'none', background: 'transparent' }}>Clear</button>
                  </div>
                  <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--forge-border)', borderRadius: '14px', marginBottom: 24, background: 'rgba(0,0,0,0.2)' }}>
                    {candidates.filter(c => (c.full_name || '').toLowerCase().includes(assignSearch.toLowerCase()) || (c.email || '').toLowerCase().includes(assignSearch.toLowerCase())).map(c => (
                      <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--forge-border)', cursor: 'pointer', margin: 0 }}>
                        <input 
                          type="checkbox" 
                          checked={selectedCandidates.includes(c.id)} 
                          onChange={e => {
                            setSelectedCandidates(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                          }} 
                          style={{ width: 16, height: 16, accentColor: 'var(--forge-accent)', cursor: 'pointer' }} 
                        />
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontWeight: 700, color: 'var(--forge-text-main)', fontSize: '0.85rem' }}>{c.full_name || 'User'}</div>
                          <span className={`badge ${c.role === 'employee' ? 'badge-info' : 'badge-muted'}`} style={{ fontSize: '0.6rem', padding: '2px 8px', borderRadius: '6px', fontWeight: 800 }}>
                            {c.role === 'employee' ? 'EMPLOYEE' : 'TRAINEE'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--forge-text-dim)', fontFamily: 'monospace' }}>{c.email}</div>
                      </label>
                    ))}
                    {candidates.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--forge-text-dim)', fontSize: '0.85rem' }}>No users found.</div>}
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: 28 }}>
                    <label className="form-label" style={{ fontWeight: 700, display: 'block', marginBottom: 8, color: 'var(--forge-text-main)', fontSize: '0.85rem', letterSpacing: '0.02em' }}>DEADLINE (OPTIONAL)</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={assignModal.deadline} 
                      onChange={e => setAssignModal({ ...assignModal, deadline: e.target.value })} 
                      style={{ 
                        width: '100%', 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid var(--forge-border)', 
                        color: 'var(--forge-text-main)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setAssignModal({ ...assignModal, open: false })} style={{ borderRadius: '12px', fontWeight: 800, padding: '12px 24px', fontSize: '0.85rem', color: 'var(--forge-text-main)', border: 'none', background: 'transparent' }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={assignModal.loading || selectedCandidates.length === 0} style={{ borderRadius: '12px', fontWeight: 800, padding: '12px 28px', fontSize: '0.85rem', background: 'var(--forge-accent)', border: 'none', color: 'white', cursor: 'pointer', boxShadow: '0 4px 14px rgba(124, 58, 237, 0.3)' }}>
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
