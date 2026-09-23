import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  ChevronLeft, Award, PlayCircle, CheckCircle, Clock, Maximize2,
  Minimize2, RefreshCw, Bookmark, Sparkles, X, Shield, Download,
  ExternalLink, Layers
} from 'lucide-react';
import './forge_styles.css';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const resolveAssetUrl = (url) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  if (url.startsWith('/uploads')) {
    const encodedPath = url.split('/').map(part => encodeURIComponent(part)).join('/');
    return `${API_BASE}${encodedPath}`;
  }
  return url;
};

export default function CoursePlayer() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const iframeRef = useRef(null);
  const scormDataRef = useRef({});
  const saveTimerRef = useRef(null);

  // Load course details
  const loadCourse = useCallback(async () => {
    try {
      const res = await forgeApi.getCourse(id);
      const data = res.data.data;
      setCourse(data);

      if (data.enrollment) {
        scormDataRef.current = {
          'cmi.core.lesson_location': data.enrollment.scorm_location || '',
          'cmi.location': data.enrollment.scorm_location || '',
          'cmi.core.suspend_data': data.enrollment.scorm_suspend_data || '',
          'cmi.suspend_data': data.enrollment.scorm_suspend_data || '',
          'cmi.core.score.raw': data.enrollment.score !== null ? String(data.enrollment.score) : '',
          'cmi.score.raw': data.enrollment.score !== null ? String(data.enrollment.score) : '',
        };
      }
    } catch (err) {
      toast.error('Failed to load course details');
      nav('/forge/library');
    } finally {
      setLoading(false);
    }
  }, [id, nav]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // Debounced backend progress sync
  const scheduleSync = useCallback((syncPayload) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      try {
        const res = await forgeApi.syncProgress(id, syncPayload);
        const result = res.data.data;
        setLastSyncTime(new Date());

        setCourse(prev => {
          if (!prev) return prev;
          const wasCompleted = prev.enrollment?.status === 'completed';
          const isNowCompleted = result.completed || result.status === 'completed';

          if (!wasCompleted && isNowCompleted) {
            setShowCelebration(true);
          }

          return {
            ...prev,
            enrollment: {
              ...(prev.enrollment || {}),
              progress_percent: result.progress_percent,
              status: result.status,
              scorm_location: result.scorm_location,
            }
          };
        });
      } catch (err) {
        console.error('Failed to auto-sync SCORM progress', err);
      }
    }, 800);
  }, [id]);

  // PostMessage bridge for SCORM runtime
  useEffect(() => {
    const handleMessage = (event) => {
      const msg = event?.data;
      if (!msg || typeof msg !== 'object') return;

      // 1. Ready event: package loaded inside iframe, send initial bookmark to resume
      if (msg.type === 'phygitron:scorm-ready') {
        const initData = {
          'cmi.core.student_id': String(user?.id || 'employee'),
          'cmi.core.student_name': user?.full_name || 'Learner',
          'cmi.learner_id': String(user?.id || 'employee'),
          'cmi.learner_name': user?.full_name || 'Learner',
          'cmi.core.lesson_location': course?.enrollment?.scorm_location || '',
          'cmi.location': course?.enrollment?.scorm_location || '',
          'cmi.core.suspend_data': course?.enrollment?.scorm_suspend_data || '',
          'cmi.suspend_data': course?.enrollment?.scorm_suspend_data || '',
        };

        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage({
            type: 'phygitron:scorm-init-data',
            data: initData,
          }, '*');
        }
        return;
      }

      // 2. Set / Commit / Finish events
      if (msg.type === 'phygitron:scorm-set' || msg.type === 'phygitron:scorm-commit' || msg.type === 'phygitron:scorm-finish') {
        if (msg.type === 'phygitron:scorm-set' && msg.key) {
          scormDataRef.current[msg.key] = msg.value;
        } else if (msg.data) {
          scormDataRef.current = { ...scormDataRef.current, ...msg.data };
        }

        const currentRuntime = scormDataRef.current;
        const location = currentRuntime['cmi.location'] || currentRuntime['cmi.core.lesson_location'] || null;
        const suspendData = currentRuntime['cmi.suspend_data'] || currentRuntime['cmi.core.suspend_data'] || null;
        const rawScore = currentRuntime['cmi.score.raw'] || currentRuntime['cmi.core.score.raw'] || null;
        const status = currentRuntime['cmi.completion_status'] || currentRuntime['cmi.core.lesson_status'] || currentRuntime['cmi.success_status'] || null;

        // Progress calculation
        let progress = null;
        if (currentRuntime['cmi.progress_measure']) {
          const pm = parseFloat(currentRuntime['cmi.progress_measure']);
          if (!isNaN(pm)) progress = pm <= 1 ? pm * 100 : pm;
        }
        if (progress === null && currentRuntime['cmi.core.lesson_progress']) {
          const lp = parseFloat(currentRuntime['cmi.core.lesson_progress']);
          if (!isNaN(lp)) progress = lp;
        }
        if (['completed', 'passed', 'success'].includes(String(status || '').toLowerCase())) {
          progress = 100;
        }

        scheduleSync({
          scorm_location: location,
          scorm_suspend_data: suspendData,
          score: rawScore !== null && !isNaN(parseFloat(rawScore)) ? parseFloat(rawScore) : undefined,
          status: status || undefined,
          progress_percent: progress !== null ? Math.min(100, Math.max(0, progress)) : undefined,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [course?.enrollment, user, scheduleSync]);

  const toggleFullscreen = () => {
    const elem = document.getElementById('scorm-player-container');
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  const reloadPlayer = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
      toast.success('Module reloaded');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner spinner-lg" />
        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading course runtime...</p>
      </div>
    );
  }

  if (!course) return null;

  const launchUrl = resolveAssetUrl(course.scorm_entry_url || (course.sections?.[0]?.content_url));
  const enrollment = course.enrollment;
  const progressPct = Math.round(enrollment?.progress_percent || 0);
  const isCompleted = enrollment?.status === 'completed' || progressPct >= 100;
  const bookmarkLocation = enrollment?.scorm_location;

  return (
    <div
      id="scorm-player-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        background: '#0B0F17',
        color: '#E2E8F0',
        overflow: 'hidden',
      }}
    >
      {/* ── Top Bar / Header ────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          zIndex: 50,
          flexShrink: 0,
        }}
      >
        {/* Left: Back & Course Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => nav('/forge')}
            className="btn-icon"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Return to Forge Dashboard"
          >
            <ChevronLeft size={20} />
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  background: course.domain_color ? `${course.domain_color}25` : 'rgba(124, 58, 237, 0.25)',
                  color: course.domain_color || '#A78BFA',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                }}
              >
                {course.domain_name || course.category || 'General'}
              </span>
              <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                SCORM {course.scorm_version || '1.2'}
              </span>
            </div>
            <h2 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: 'white' }}>
              {course.title}
            </h2>
          </div>
        </div>

        {/* Center: Bookmark indicator & Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {bookmarkLocation && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '4px 12px',
                borderRadius: 8,
                fontSize: '0.75rem',
                color: '#94A3B8',
              }}
            >
              <Bookmark size={13} style={{ color: '#F59E0B' }} />
              <span>Bookmark: <strong>{bookmarkLocation}</strong></span>
            </div>
          )}

          <div style={{ width: 180 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#94A3B8', marginBottom: 4 }}>
              <span>Progress</span>
              <span style={{ fontWeight: 800, color: isCompleted ? '#10B981' : 'var(--forge-accent)' }}>
                {progressPct}%
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 999, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: isCompleted ? '#10B981' : 'linear-gradient(90deg, #7C3AED, #A78BFA)',
                  borderRadius: 999,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isCompleted && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 12px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                borderRadius: 8,
                fontSize: '0.75rem',
                fontWeight: 800,
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle size={14} /> Completed
            </div>
          )}

          <button
            onClick={reloadPlayer}
            className="btn-icon"
            style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1' }}
            title="Reload Module"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="btn-icon"
            style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: '#CBD5E1' }}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </header>

      {/* ── Main Player Frame ───────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%' }}>
        {launchUrl ? (
          <iframe
            ref={iframeRef}
            src={launchUrl}
            title={course.title}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              display: 'block',
              background: '#000',
            }}
            allow="fullscreen; autoplay"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
            <Award size={48} style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>SCORM package launch URL is not available.</p>
          </div>
        )}
      </div>

      {/* ── Completion Celebration Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showCelebration && (
          <div className="modal-backdrop" onClick={() => setShowCelebration(false)}>
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0 }}
              className="modal-box"
              style={{
                maxWidth: 480,
                width: '100%',
                background: '#131926',
                borderRadius: 24,
                padding: '36px 28px',
                textAlign: 'center',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: '3.6rem', marginBottom: 12 }}>🏆</div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '1.6rem', fontWeight: 900, color: 'white' }}>
                Course Completed!
              </h2>
              <p style={{ margin: '0 0 20px 0', color: '#94A3B8', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Congratulations, you have successfully finished <strong>{course.title}</strong>!
                Your learning record has been updated and a certificate has been generated.
              </p>

              {enrollment?.score !== undefined && enrollment?.score !== null && (
                <div
                  style={{
                    display: 'inline-block',
                    padding: '8px 24px',
                    borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: '#10B981',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    marginBottom: 24,
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                  }}
                >
                  Score: {enrollment.score}%
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => setShowCelebration(false)}
                  className="btn btn-ghost"
                  style={{ padding: '10px 20px', borderRadius: 12, color: '#94A3B8' }}
                >
                  Continue Reviewing
                </button>
                <button
                  onClick={() => nav('/forge/transcript')}
                  className="btn btn-primary"
                  style={{
                    padding: '10px 22px',
                    borderRadius: 12,
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                  }}
                >
                  View Certificate →
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
