import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  Search, Filter, BookOpen, Clock, ChevronRight, CheckCircle,
  SlidersHorizontal, X, Star, Zap, Layers, PlayCircle, Sparkles,
  TrendingUp, Upload, Plus, FolderPlus, Users, Calendar, Award,
  AlertCircle, Check, Shield, FileArchive, ArrowUpRight
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
};

export default function CourseLibrary() {
  const { user } = useAuth();
  const nav = useNavigate();

  const isOfficial = ['org_admin', 'hr', 'manager', 'instructor', 'super_admin'].includes(user?.role);

  const [courses, setCourses] = useState([]);
  const [domains, setDomains] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState('');

  // Modals state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [domainModalOpen, setDomainModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedCourseForAssign, setSelectedCourseForAssign] = useState(null);

  // SCORM Upload Form State
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadDomainId, setUploadDomainId] = useState('');
  const [uploadDifficulty, setUploadDifficulty] = useState('beginner');
  const [uploadHours, setUploadHours] = useState(2.0);
  const [uploadPassScore, setUploadPassScore] = useState(70.0);
  const [uploading, setUploading] = useState(false);

  // Domain Management Form State
  const [newDomainName, setNewDomainName] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [newDomainColor, setNewDomainColor] = useState('#7C3AED');
  const [creatingDomain, setCreatingDomain] = useState(false);

  // Assignment Modal State
  const [assignableEmployees, setAssignableEmployees] = useState([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignDeptFilter, setAssignDeptFilter] = useState('');
  const [assignSearch, setAssignSearch] = useState('');
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Load Domains
  const loadDomains = useCallback(async () => {
    try {
      const res = await forgeApi.domains();
      setDomains(res.data.data || []);
    } catch (e) {
      console.error('Failed to load domains', e);
    }
  }, []);

  // Load Courses
  const loadCourses = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const res = await forgeApi.library({
        q: search || undefined,
        domain_id: selectedDomain || undefined,
        difficulty: selectedDifficulty || undefined,
        page: pg,
        limit: 18,
      });
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
  }, [search, selectedDomain, selectedDifficulty]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  useEffect(() => {
    loadCourses(1);
  }, [loadCourses]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // ── Open Assign Modal (Strictly Employee DB) ───────────────────────────────
  const openAssignModal = async (course) => {
    setSelectedCourseForAssign(course);
    setAssignModalOpen(true);
    setSelectedEmpIds([]);
    setAssignDeadline('');
    setAssignSearch('');
    setAssignDeptFilter('');
    setLoadingEmployees(true);

    try {
      const res = await forgeApi.assignableEmployees({ course_id: course.id });
      setAssignableEmployees(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load active employees');
      console.error(err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (selectedEmpIds.length === 0) {
      toast.error('Please select at least one employee.');
      return;
    }
    setAssigning(true);
    try {
      const res = await forgeApi.assignCourse(selectedCourseForAssign.id, {
        employee_ids: selectedEmpIds,
        deadline: assignDeadline ? new Date(assignDeadline).toISOString() : null,
      });
      toast.success(res.data.message || 'Course successfully assigned!');
      setAssignModalOpen(false);
      loadCourses(page);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  // ── SCORM Upload Submit ────────────────────────────────────────────────────
  const handleScormUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error('Please choose a SCORM .zip file.');
      return;
    }
    if (!uploadFile.name.toLowerCase().endsWith('.zip')) {
      toast.error('Only valid .zip SCORM archives are allowed.');
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append('file', uploadFile);

    const params = {
      title: uploadTitle || undefined,
      description: uploadDesc || undefined,
      domain_id: uploadDomainId ? parseInt(uploadDomainId, 10) : undefined,
      difficulty: uploadDifficulty,
      estimated_hours: uploadHours,
      pass_score: uploadPassScore,
    };

    try {
      const res = await forgeApi.uploadScorm(fd, params);
      toast.success(res.data.message || 'SCORM course uploaded successfully!');
      setUploadModalOpen(false);
      // Reset form
      setUploadFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadDomainId('');
      loadDomains();
      loadCourses(1);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload SCORM package.');
    } finally {
      setUploading(false);
    }
  };

  // ── Create Domain ─────────────────────────────────────────────────────────
  const handleCreateDomain = async (e) => {
    e.preventDefault();
    if (!newDomainName.trim()) {
      toast.error('Domain name is required.');
      return;
    }
    setCreatingDomain(true);
    try {
      await forgeApi.createDomain({
        name: newDomainName.trim(),
        description: newDomainDesc || undefined,
        color: newDomainColor,
      });
      toast.success('Domain created successfully!');
      setNewDomainName('');
      setNewDomainDesc('');
      loadDomains();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create domain.');
    } finally {
      setCreatingDomain(false);
    }
  };

  const handleDeleteDomain = async (domainId) => {
    if (!window.confirm('Are you sure you want to delete this domain? Courses in it will be unassigned.')) return;
    try {
      await forgeApi.deleteDomain(domainId);
      toast.success('Domain deleted');
      if (selectedDomain === domainId) setSelectedDomain(null);
      loadDomains();
      loadCourses(1);
    } catch (err) {
      toast.error('Failed to delete domain');
    }
  };

  // Filtered employees for assign modal
  const filteredEmployees = assignableEmployees.filter((emp) => {
    const matchesSearch =
      !assignSearch ||
      emp.name.toLowerCase().includes(assignSearch.toLowerCase()) ||
      emp.employee_code.toLowerCase().includes(assignSearch.toLowerCase()) ||
      emp.email.toLowerCase().includes(assignSearch.toLowerCase());
    const matchesDept = !assignDeptFilter || emp.department === assignDeptFilter;
    return matchesSearch && matchesDept;
  });

  const allEligibleIds = filteredEmployees.filter(e => !e.is_enrolled).map(e => e.employee_id);
  const isAllSelected = allEligibleIds.length > 0 && allEligibleIds.every(id => selectedEmpIds.includes(id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedEmpIds(prev => prev.filter(id => !allEligibleIds.includes(id)));
    } else {
      setSelectedEmpIds(prev => Array.from(new Set([...prev, ...allEligibleIds])));
    }
  };

  const departmentsList = Array.from(new Set(assignableEmployees.map(e => e.department).filter(Boolean)));

  return (
    <div className="forge-container forge-grain" style={{ minHeight: '100vh', padding: '0 40px 80px' }}>
      <TopHeader />

      {/* Hero / Page Header */}
      <div style={{ padding: '40px 0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ width: 42, height: 42, borderRadius: '12px', background: 'rgba(124, 58, 237, 0.12)', color: 'var(--forge-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(124, 58, 237, 0.25)' }}>
              <Layers size={22} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '2.4rem', fontWeight: 900, letterSpacing: '-0.04em', color: 'var(--forge-text-main)' }}>
                Course Library
              </h1>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Interactive SCORM training packages & professional domain certifications
              </p>
            </div>
          </div>
        </motion.div>

        {/* Action Controls for Authorized Officials */}
        {isOfficial && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              onClick={() => setDomainModalOpen(true)}
              className="btn btn-secondary"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                borderRadius: '12px', fontWeight: 700, fontSize: '0.85rem'
              }}
            >
              <FolderPlus size={16} /> Manage Domains
            </button>
            <button
              onClick={() => setUploadModalOpen(true)}
              className="btn btn-primary"
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
                borderRadius: '12px', fontWeight: 800, fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
              }}
            >
              <Upload size={16} /> Upload SCORM Package
            </button>
          </div>
        )}
      </div>

      {/* Domain Category Filter Chips */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 16, marginBottom: 20 }}>
        <button
          onClick={() => setSelectedDomain(null)}
          style={{
            padding: '8px 18px',
            borderRadius: '9999px',
            border: selectedDomain === null ? '1px solid var(--forge-accent)' : '1px solid var(--forge-border)',
            background: selectedDomain === null ? 'var(--forge-accent)' : 'var(--forge-card-bg)',
            color: selectedDomain === null ? 'white' : 'var(--forge-text-main)',
            fontWeight: 700,
            fontSize: '0.82rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap',
          }}
        >
          All Domains ({total})
        </button>
        {domains.map((dom) => {
          const isSelected = selectedDomain === dom.id;
          return (
            <button
              key={dom.id}
              onClick={() => setSelectedDomain(isSelected ? null : dom.id)}
              style={{
                padding: '8px 18px',
                borderRadius: '9999px',
                border: isSelected ? `2px solid ${dom.color || '#7C3AED'}` : '1px solid var(--forge-border)',
                background: isSelected ? `${dom.color || '#7C3AED'}20` : 'var(--forge-card-bg)',
                color: isSelected ? (dom.color || '#7C3AED') : 'var(--forge-text-main)',
                fontWeight: 700,
                fontSize: '0.82rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: dom.color || '#7C3AED' }} />
              {dom.name}
              {dom.course_count !== undefined && (
                <span style={{ opacity: 0.7, fontSize: '0.72rem', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '10px' }}>
                  {dom.course_count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search & Difficulty Filter Bar */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
        <form onSubmit={handleSearchSubmit} style={{ flex: 1, minWidth: 280, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-control"
            placeholder="Search by title, domain or keyword..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{
              paddingLeft: 46,
              borderRadius: '14px',
              height: 48,
              background: 'var(--forge-card-bg)',
              border: '1px solid var(--forge-border)',
              color: 'var(--forge-text-main)',
            }}
          />
        </form>

        <div style={{ display: 'flex', gap: 12 }}>
          <select
            className="form-control"
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            style={{
              height: 48,
              borderRadius: '14px',
              background: 'var(--forge-card-bg)',
              border: '1px solid var(--forge-border)',
              color: 'var(--forge-text-main)',
              fontWeight: 600,
              padding: '0 16px',
            }}
          >
            <option value="">All Difficulty Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      {/* Courses Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 320, flexDirection: 'column', gap: 16 }}>
          <div className="spinner spinner-lg" />
          <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading SCORM packages...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', borderRadius: 20, background: 'var(--forge-card-bg)', border: '1px solid var(--forge-border)' }}>
          <FileArchive size={48} style={{ color: 'var(--forge-accent)', margin: '0 auto 16px', opacity: 0.6 }} />
          <h3 style={{ margin: '0 0 8px 0', fontWeight: 800 }}>No Courses Found</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 24px', fontSize: '0.9rem' }}>
            {search || selectedDomain || selectedDifficulty
              ? 'Try adjusting your search criteria or domain filter.'
              : isOfficial
              ? 'Get started by uploading your first SCORM zip training course into the library.'
              : 'Courses assigned by your manager or administrator will appear here.'}
          </p>
          {isOfficial && (
            <button onClick={() => setUploadModalOpen(true)} className="btn btn-primary" style={{ padding: '10px 24px', borderRadius: 12 }}>
              <Upload size={16} /> Upload SCORM Course
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {courses.map((course) => {
            const diff = DIFF_CONFIG[course.difficulty] || DIFF_CONFIG.beginner;
            const isEnrolled = !!course.enrolled;
            const progressPct = course.enrollment?.progress_percent || 0;
            const isCompleted = course.enrollment?.status === 'completed' || progressPct >= 100;

            return (
              <BorderGlow
                key={course.id}
                borderRadius={20}
                glowRadius={30}
                glowIntensity={0.5}
                backgroundColor="var(--forge-bg)"
                className="forge-course-card"
              >
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  {/* Thumbnail / Header */}
                  <div
                    className="forge-thumbnail"
                    style={{
                      height: 140,
                      position: 'relative',
                      background: `linear-gradient(135deg, ${course.domain_color || '#7C3AED'}30 0%, #1e1b4b 100%)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottom: '1px solid var(--forge-border)',
                    }}
                  >
                    <BookOpen size={44} style={{ color: course.domain_color || '#7C3AED', opacity: 0.7 }} />

                    {/* Domain Badge */}
                    <span
                      style={{
                        position: 'absolute',
                        top: 14,
                        left: 14,
                        background: 'rgba(0,0,0,0.6)',
                        color: course.domain_color || '#A78BFA',
                        backdropFilter: 'blur(6px)',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        border: `1px solid ${course.domain_color || '#7C3AED'}40`,
                      }}
                    >
                      {course.domain_name || 'General'}
                    </span>

                    {/* SCORM Version Tag */}
                    <span
                      style={{
                        position: 'absolute',
                        top: 14,
                        right: 14,
                        background: 'rgba(124,58,237,0.85)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                      }}
                    >
                      SCORM {course.scorm_version || '1.2'}
                    </span>

                    {/* Enrolled Status Pill */}
                    {isEnrolled && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 12,
                          left: 14,
                          background: isCompleted ? 'rgba(16, 185, 129, 0.9)' : 'rgba(124, 58, 237, 0.9)',
                          color: 'white',
                          borderRadius: '6px',
                          padding: '3px 8px',
                          fontSize: '0.68rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <CheckCircle size={11} /> {isCompleted ? 'COMPLETED' : `${Math.round(progressPct)}% COMPLETE`}
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span className={`badge ${diff.badge}`} style={{ fontSize: '0.7rem' }}>
                        {diff.label}
                      </span>
                      {course.estimated_hours && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {course.estimated_hours} hrs
                        </span>
                      )}
                    </div>

                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', fontWeight: 800, color: 'var(--forge-text-main)', lineHeight: 1.3 }}>
                      {course.title}
                    </h4>

                    <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {course.description || 'Interactive SCORM training module.'}
                    </p>

                    {/* Progress Bar if Enrolled */}
                    {isEnrolled && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>
                          <span>Progress</span>
                          <span style={{ fontWeight: 700, color: 'var(--forge-accent)' }}>{Math.round(progressPct)}%</span>
                        </div>
                        <div className="progress-bar" style={{ height: 4, background: 'rgba(255,255,255,0.08)' }}>
                          <div className="progress-fill" style={{ width: `${progressPct}%`, background: isCompleted ? '#10B981' : 'var(--forge-accent)' }} />
                        </div>
                      </div>
                    )}

                    {/* Card Actions */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--forge-border)' }}>
                      {isOfficial && (
                        <button
                          onClick={() => openAssignModal(course)}
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '8px 12px',
                            borderRadius: '10px',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          title="Assign to active employees"
                        >
                          <Users size={13} /> Assign
                        </button>
                      )}

                      <button
                        onClick={() => nav(`/forge/course/${course.id}`)}
                        className={`btn btn-sm ${isEnrolled ? 'btn-primary' : 'btn-ghost'}`}
                        style={{
                          flex: 1,
                          padding: '8px 14px',
                          borderRadius: '10px',
                          fontWeight: 800,
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          background: isEnrolled ? 'var(--forge-accent)' : 'transparent',
                          color: isEnrolled ? 'white' : 'var(--forge-text-main)',
                          border: isEnrolled ? 'none' : '1px solid var(--forge-border)',
                        }}
                      >
                        <PlayCircle size={14} />
                        {isCompleted ? 'REVIEW COURSE' : isEnrolled ? 'RESUME COURSE' : 'START COURSE'}
                      </button>
                    </div>
                  </div>
                </div>
              </BorderGlow>
            );
          })}
        </div>
      )}

      {/* ── MODAL 1: SCORM Package Uploader ─────────────────────────────────── */}
      <AnimatePresence>
        {uploadModalOpen && (
          <div className="modal-backdrop" onClick={() => !uploading && setUploadModalOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-box"
              style={{ maxWidth: 580, width: '100%', background: 'var(--bg-card)', borderRadius: 20, overflow: 'hidden' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Upload SCORM Package</h3>
                </div>
                <button className="btn-icon" onClick={() => !uploading && setUploadModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleScormUpload} style={{ padding: 24 }}>
                {/* File Dropzone */}
                <div
                  style={{
                    border: '2px dashed var(--forge-border)',
                    borderRadius: 14,
                    padding: '24px 16px',
                    textAlign: 'center',
                    marginBottom: 20,
                    background: uploadFile ? 'rgba(124, 58, 237, 0.05)' : 'var(--bg-card)',
                    cursor: 'pointer',
                  }}
                  onClick={() => document.getElementById('scorm-file-input').click()}
                >
                  <input
                    id="scorm-file-input"
                    type="file"
                    accept=".zip"
                    style={{ display: 'none' }}
                    onChange={(e) => setUploadFile(e.target.files[0] || null)}
                  />
                  <FileArchive size={36} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                    {uploadFile ? uploadFile.name : 'Click to select SCORM .ZIP archive'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Supports SCORM 1.2 & SCORM 2004 packages containing imsmanifest.xml
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Course Title (Optional — auto-read from manifest)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g., Information Security Awareness 2026"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Domain / Category</label>
                    <select
                      className="form-control"
                      value={uploadDomainId}
                      onChange={(e) => setUploadDomainId(e.target.value)}
                    >
                      <option value="">General / None</option>
                      {domains.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Difficulty Level</label>
                    <select
                      className="form-control"
                      value={uploadDifficulty}
                      onChange={(e) => setUploadDifficulty(e.target.value)}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Estimated Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      className="form-control"
                      value={uploadHours}
                      onChange={(e) => setUploadHours(parseFloat(e.target.value) || 1)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Pass Score Threshold (%)</label>
                    <input
                      type="number"
                      step="5"
                      min="0"
                      max="100"
                      className="form-control"
                      value={uploadPassScore}
                      onChange={(e) => setUploadPassScore(parseFloat(e.target.value) || 70)}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Brief summary of learning outcomes and prerequisites..."
                    value={uploadDesc}
                    onChange={(e) => setUploadDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={uploading}
                    onClick={() => setUploadModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={uploading || !uploadFile}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {uploading ? (
                      <>
                        <div className="spinner" style={{ width: 16, height: 16 }} />
                        Extracting & Validating SCORM...
                      </>
                    ) : (
                      <>
                        <Upload size={16} /> Deploy SCORM Course
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 2: Domain Management ──────────────────────────────────────── */}
      <AnimatePresence>
        {domainModalOpen && (
          <div className="modal-backdrop" onClick={() => setDomainModalOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-box"
              style={{ maxWidth: 640, width: '100%', background: 'var(--bg-card)', borderRadius: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FolderPlus size={20} style={{ color: 'var(--primary)' }} />
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>Manage Learning Domains</h3>
                </div>
                <button className="btn-icon" onClick={() => setDomainModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: 24 }}>
                {/* Create Domain Form */}
                <form onSubmit={handleCreateDomain} style={{ marginBottom: 24, padding: 16, borderRadius: 14, background: 'rgba(124, 58, 237, 0.05)', border: '1px solid rgba(124, 58, 237, 0.2)' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', marginBottom: 12, color: 'var(--primary)' }}>
                    Add New Learning Domain / Category
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 10 }}>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Domain Name (e.g. Artificial Intelligence, Cloud Computing)"
                      value={newDomainName}
                      onChange={(e) => setNewDomainName(e.target.value)}
                      required
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="color"
                        value={newDomainColor}
                        onChange={(e) => setNewDomainColor(e.target.value)}
                        style={{ width: 42, height: 42, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'none' }}
                        title="Choose badge color"
                      />
                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={creatingDomain}
                        style={{ flex: 1, padding: '10px 14px', fontSize: '0.82rem', fontWeight: 700 }}
                      >
                        {creatingDomain ? 'Adding...' : 'Add Domain'}
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Short description of this domain (optional)"
                    value={newDomainDesc}
                    onChange={(e) => setNewDomainDesc(e.target.value)}
                  />
                </form>

                {/* Existing Domains List */}
                <div style={{ fontWeight: 800, fontSize: '0.85rem', marginBottom: 12, color: 'var(--text-muted)' }}>
                  Existing Domains ({domains.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 260, overflowY: 'auto' }}>
                  {domains.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '20px 0' }}>
                      No custom domains created yet.
                    </p>
                  ) : (
                    domains.map((d) => (
                      <div
                        key={d.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: 12,
                          background: 'var(--bg-main)',
                          border: '1px solid var(--border)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ width: 14, height: 14, borderRadius: '50%', background: d.color || '#7C3AED' }} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d.name}</div>
                            {d.description && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.description}</div>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                            {d.course_count || 0} courses
                          </span>
                          <button
                            onClick={() => handleDeleteDomain(d.id)}
                            className="btn-icon"
                            style={{ color: '#EF4444' }}
                            title="Delete Domain"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL 3: Bulk Employee Assignment (Strictly Employee Database) ── */}
      <AnimatePresence>
        {assignModalOpen && selectedCourseForAssign && (
          <div className="modal-backdrop" onClick={() => !assigning && setAssignModalOpen(false)}>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="modal-box"
              style={{ maxWidth: 740, width: '100%', background: 'var(--bg-card)', borderRadius: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase' }}>
                    <Shield size={14} /> Employee Course Assignment
                  </div>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '1.25rem', fontWeight: 800 }}>
                    {selectedCourseForAssign.title}
                  </h3>
                </div>
                <button className="btn-icon" onClick={() => !assigning && setAssignModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: 24 }}>
                {/* Search & Dept Filters */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search active employees by name, code, or email..."
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      style={{ paddingLeft: 38, height: 42, borderRadius: 10, fontSize: '0.85rem' }}
                    />
                  </div>

                  <select
                    className="form-control"
                    value={assignDeptFilter}
                    onChange={(e) => setAssignDeptFilter(e.target.value)}
                    style={{ width: 180, height: 42, borderRadius: 10, fontSize: '0.85rem' }}
                  >
                    <option value="">All Departments</option>
                    {departmentsList.map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                {/* Target Deadline Input */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-main)', borderRadius: 12, marginBottom: 16 }}>
                  <Calendar size={18} style={{ color: 'var(--primary)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>Target Completion Deadline</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Employees will receive automated email alerts before this date</div>
                  </div>
                  <input
                    type="date"
                    className="form-control"
                    value={assignDeadline}
                    onChange={(e) => setAssignDeadline(e.target.value)}
                    style={{ width: 170, height: 38, borderRadius: 8, fontSize: '0.85rem' }}
                  />
                </div>

                {/* Employees Roster List */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--bg-main)', borderBottom: '1px solid var(--border)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem' }}>
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                      />
                      Select All Eligible ({allEligibleIds.length})
                    </label>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Selected: <strong>{selectedEmpIds.length}</strong>
                    </span>
                  </div>

                  <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {loadingEmployees ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
                        <div className="spinner" />
                      </div>
                    ) : filteredEmployees.length === 0 ? (
                      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No employees found matching filter.
                      </div>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const isEnrolled = emp.is_enrolled;
                        const isSelected = selectedEmpIds.includes(emp.employee_id);

                        return (
                          <div
                            key={emp.employee_id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 16px',
                              borderBottom: '1px solid var(--border)',
                              opacity: isEnrolled ? 0.6 : 1,
                              background: isSelected ? 'rgba(124, 58, 237, 0.04)' : 'transparent',
                            }}
                          >
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: isEnrolled ? 'not-allowed' : 'pointer' }}>
                              <input
                                type="checkbox"
                                disabled={isEnrolled}
                                checked={isSelected}
                                onChange={() => {
                                  if (isEnrolled) return;
                                  setSelectedEmpIds(prev =>
                                    prev.includes(emp.employee_id)
                                      ? prev.filter(id => id !== emp.employee_id)
                                      : [...prev, emp.employee_id]
                                  );
                                }}
                              />
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                  {emp.name}
                                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                                    ({emp.employee_code})
                                  </span>
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {emp.email} · {emp.department} · {emp.designation}
                                </div>
                              </div>
                            </label>

                            {isEnrolled && (
                              <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>
                                Already Enrolled
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Transactional emails will be sent immediately upon assignment.
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={assigning}
                      onClick={() => setAssignModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={assigning || selectedEmpIds.length === 0}
                      onClick={handleAssignSubmit}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 12 }}
                    >
                      {assigning ? (
                        <>
                          <div className="spinner" style={{ width: 14, height: 14 }} /> Assigning...
                        </>
                      ) : (
                        <>
                          <Check size={16} /> Confirm Assignment ({selectedEmpIds.length})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
