import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { forgeApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  ChevronLeft, Award, PlayCircle, CheckCircle, Clock, Maximize2,
  Minimize2, RefreshCw, Bookmark, Sparkles, X, Shield, Download,
  ExternalLink, Layers, BookOpen, ArrowLeft, ArrowRight, HelpCircle, Check, Radio
} from 'lucide-react';
import './forge_styles.css';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

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

const calculateLearnerProgress = (runtimeData, eventProgress, totalSlides = 57) => {
  const status = String(
    runtimeData?.['cmi.completion_status'] ||
    runtimeData?.['cmi.core.lesson_status'] ||
    runtimeData?.['cmi.success_status'] ||
    ''
  ).toLowerCase();

  if (['completed', 'passed', 'complete', 'success'].includes(status)) {
    return 100;
  }

  // 1. Explicit progress from shim event
  if (eventProgress !== undefined && eventProgress !== null && !isNaN(parseFloat(eventProgress))) {
    const ep = parseFloat(eventProgress);
    if (ep > 0) return Math.min(100, Math.round(ep));
  }

  // 2. SCORM 2004 cmi.progress_measure (0.0 to 1.0 or 0 to 100)
  if (runtimeData?.['cmi.progress_measure']) {
    const pm = parseFloat(runtimeData['cmi.progress_measure']);
    if (!isNaN(pm) && pm > 0) {
      return Math.min(100, Math.round(pm <= 1 ? pm * 100 : pm));
    }
  }

  // 3. SCORM cmi.core.lesson_progress
  if (runtimeData?.['cmi.core.lesson_progress']) {
    const lp = parseFloat(runtimeData['cmi.core.lesson_progress']);
    if (!isNaN(lp) && lp > 0) {
      return Math.min(100, Math.round(lp));
    }
  }

  // 4. Storyline 360 suspend_data chunk parsing
  const suspendData = String(runtimeData?.['cmi.suspend_data'] || runtimeData?.['cmi.core.suspend_data'] || '');
  if (suspendData) {
    const firstChunk = suspendData.split('~')[0];
    const matchBody = firstChunk.match(/^[0-9a-zA-Z_$~]{1,6}([0-9a-zA-Z_$]{4,})/);
    if (matchBody && matchBody[1]) {
      const numViewed = Math.floor(matchBody[1].length / 2);
      if (numViewed > 0) {
        return Math.min(98, Math.round((numViewed / totalSlides) * 100));
      }
    } else if (suspendData.includes(',')) {
      const parts = suspendData.split(',');
      const viewed = parts.filter(p => ['1', 'true', 'v'].includes(p.trim())).length;
      if (parts.length >= 4) {
        return Math.min(98, Math.round((viewed / parts.length) * 100));
      }
    }
  }

  // 5. Fraction in location string (e.g. "14/50")
  const location = String(runtimeData?.['cmi.location'] || runtimeData?.['cmi.core.lesson_location'] || '');
  if (location) {
    const mFrac = location.match(/(\d+)\s*(?:\/|of)\s*(\d+)/i);
    if (mFrac && parseFloat(mFrac[2]) > 0) {
      return Math.min(100, Math.round((parseFloat(mFrac[1]) / parseFloat(mFrac[2])) * 100));
    }
  }

  return null;
};

const extractBookmark = (runtimeData) => {
  const loc = runtimeData?.['cmi.location'] || runtimeData?.['cmi.core.lesson_location'];
  if (loc && String(loc).trim() !== '') return String(loc).trim();

  const sd = String(runtimeData?.['cmi.suspend_data'] || runtimeData?.['cmi.core.suspend_data'] || '');
  const mPlayer = sd.match(/_player\.([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)/);
  if (mPlayer && mPlayer[2]) {
    return `Slide: ${mPlayer[2]}`;
  }
  return null;
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
  const [isSyncing, setIsSyncing] = useState(false);

  // Native Interactive Course State
  const [nativeSectionIdx, setNativeSectionIdx] = useState(0);
  const [completedSections, setCompletedSections] = useState(new Set());
  const [nativeQuizAnswers, setNativeQuizAnswers] = useState({});
  const [nativeQuizSubmitted, setNativeQuizSubmitted] = useState({});

  const iframeRef = useRef(null);
  const scormDataRef = useRef({});
  const saveTimerRef = useRef(null);

  // Load course details
  const loadCourse = useCallback(async () => {
    try {
      const res = await forgeApi.getCourse(id);
      const data = res.data.data;

      if (data.enrollment) {
        let initProg = parseFloat(data.enrollment.progress_percent || 0);
        let initLoc = data.enrollment.scorm_location;

        // Auto-heal progress if currently 0 but suspend_data has visited slides
        if (initProg <= 0 && data.enrollment.scorm_suspend_data) {
          const calcProg = calculateLearnerProgress({
            'cmi.suspend_data': data.enrollment.scorm_suspend_data,
            'cmi.location': data.enrollment.scorm_location,
            'cmi.core.lesson_status': data.enrollment.status,
          }, null, 57);
          if (calcProg && calcProg > 0) {
            initProg = calcProg;
            data.enrollment.progress_percent = calcProg;
          }
        }
        if (!initLoc && data.enrollment.scorm_suspend_data) {
          initLoc = extractBookmark({ 'cmi.suspend_data': data.enrollment.scorm_suspend_data });
          if (initLoc) data.enrollment.scorm_location = initLoc;
        }

        // Restore native completed sections
        if (data.sections && data.sections.length > 0) {
          const prog = parseFloat(data.enrollment.progress_percent || 0);
          const totalSec = data.sections.length;
          const completedCount = Math.round((prog / 100) * totalSec);
          const initialCompleted = new Set();
          for (let i = 0; i < completedCount; i++) {
            if (data.sections[i]) initialCompleted.add(data.sections[i].id);
          }
          setCompletedSections(initialCompleted);
        }

        scormDataRef.current = {
          'cmi.core.lesson_location': data.enrollment.scorm_location || '',
          'cmi.location': data.enrollment.scorm_location || '',
          'cmi.core.suspend_data': data.enrollment.scorm_suspend_data || '',
          'cmi.suspend_data': data.enrollment.scorm_suspend_data || '',
          'cmi.core.score.raw': data.enrollment.score !== null ? String(data.enrollment.score) : '',
          'cmi.score.raw': data.enrollment.score !== null ? String(data.enrollment.score) : '',
        };
      }

      setCourse(data);
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

    setIsSyncing(true);
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
      } finally {
        setIsSyncing(false);
      }
    }, 600);
  }, [id]);

  // Handle manual 100% course completion
  const handleMarkComplete = async () => {
    if (!window.confirm("Are you sure you want to mark this course as completed? This will finalize your progress at 100% and generate your official Certificate of Completion.")) {
      return;
    }
    try {
      setIsSyncing(true);
      await forgeApi.syncProgress(id, {
        status: 'completed',
        progress_percent: 100,
        scorm_location: course?.enrollment?.scorm_location || 'Completed',
        scorm_suspend_data: course?.enrollment?.scorm_suspend_data,
        score: course?.enrollment?.score || 100,
      });
      setCourse(prev => ({
        ...prev,
        enrollment: {
          ...(prev?.enrollment || {}),
          status: 'completed',
          progress_percent: 100,
          completed_at: new Date().toISOString(),
        }
      }));
      setShowCelebration(true);
      toast.success("Course marked as 100% completed! Certificate generated.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to mark course complete");
    } finally {
      setIsSyncing(false);
    }
  };

  // Complete a native lesson and calculate progress
  const handleCompleteNativeSection = async (secId, nextIdx) => {
    const newCompleted = new Set(completedSections);
    newCompleted.add(secId);
    setCompletedSections(newCompleted);

    const totalSec = course?.sections?.length || 1;
    const newProg = Math.min(100, Math.round((newCompleted.size / totalSec) * 100));

    setCourse(prev => ({
      ...prev,
      enrollment: {
        ...(prev?.enrollment || {}),
        progress_percent: newProg,
        status: newProg >= 100 ? 'completed' : 'in_progress',
        completed_at: newProg >= 100 ? new Date().toISOString() : prev?.enrollment?.completed_at,
      }
    }));

    try {
      await forgeApi.syncProgress(id, {
        progress_percent: newProg,
        status: newProg >= 100 ? 'completed' : 'in_progress',
        scorm_location: `Lesson ${nextIdx !== undefined ? nextIdx + 1 : nativeSectionIdx + 1}`,
      });
      if (newProg >= 100) {
        setShowCelebration(true);
        toast.success("🎉 Course completed! Official certificate generated.");
      }
    } catch (e) {
      console.error('Failed to sync native lesson progress', e);
    }

    if (nextIdx !== undefined && nextIdx < totalSec) {
      setNativeSectionIdx(nextIdx);
    }
  };

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
          totalSlides: 57,
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
        const computedProgress = calculateLearnerProgress(currentRuntime, msg.progressPercent, 57);
        const bookmark = extractBookmark(currentRuntime) || location;

        // Real-time local state update so the progress bar updates with zero lag
        if (computedProgress !== null) {
          setCourse(prev => {
            if (!prev) return prev;
            const currentPct = prev.enrollment?.progress_percent || 0;
            if (computedProgress > currentPct || bookmark !== prev.enrollment?.scorm_location) {
              return {
                ...prev,
                enrollment: {
                  ...(prev.enrollment || {}),
                  progress_percent: Math.max(currentPct, computedProgress),
                  scorm_location: bookmark || prev.enrollment?.scorm_location,
                }
              };
            }
            return prev;
          });
        }

        scheduleSync({
          scorm_location: bookmark,
          scorm_suspend_data: suspendData,
          score: rawScore !== null && !isNaN(parseFloat(rawScore)) ? parseFloat(rawScore) : undefined,
          status: status || undefined,
          progress_percent: computedProgress !== null ? Math.min(100, Math.max(0, computedProgress)) : undefined,
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

          <div style={{ width: 190 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#94A3B8', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>Progress</span>
                {isSyncing ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', color: '#F59E0B' }}>
                    <Clock size={10} /> saving...
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', color: '#10B981' }}>
                    <CheckCircle size={10} /> saved
                  </span>
                )}
              </div>
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
          {isCompleted ? (
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
          ) : (
            <button
              onClick={handleMarkComplete}
              className="btn btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'linear-gradient(135deg, #10B981, #059669)',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.76rem',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
              }}
              title="Mark module 100% completed and generate certificate"
            >
              <CheckCircle size={14} /> Mark Complete
            </button>
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
      <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', display: 'flex' }}>
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
        ) : course?.sections && course.sections.length > 0 ? (
          /* Native Interactive Course Player */
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', width: '100%', height: '100%', background: '#0B0F19' }}>
            
            {/* Left Drawer: Course Lessons List */}
            <div style={{ background: '#131926', borderRight: '1px solid rgba(255,255,255,0.08)', padding: '20px 16px', overflowY: 'auto' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--forge-accent)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '0.05em' }}>
                Course Modules ({course.sections.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {course.sections.map((sec, sIdx) => {
                  const isActive = sIdx === nativeSectionIdx;
                  const isDone = completedSections.has(sec.id);
                  return (
                    <div
                      key={sec.id || sIdx}
                      onClick={() => setNativeSectionIdx(sIdx)}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: isActive ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255,255,255,0.02)',
                        border: isActive ? '1px solid var(--forge-accent)' : '1px solid rgba(255,255,255,0.05)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: isActive ? '#A78BFA' : 'var(--text-muted)' }}>
                          LESSON {sIdx + 1}
                        </span>
                        {isDone ? (
                          <span style={{ color: '#10B981', display: 'flex', alignItems: 'center', gap: 2, fontSize: '0.7rem', fontWeight: 800 }}>
                            <CheckCircle size={12} /> Done
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                            {sec.duration_minutes || 15}m
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white', lineHeight: 1.3 }}>
                        {sec.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Main Content Pane */}
            <div style={{ padding: '36px 48px', overflowY: 'auto', maxHeight: 'calc(100vh - 65px)' }}>
              {course.sections[nativeSectionIdx] && (() => {
                const curSec = course.sections[nativeSectionIdx];
                const isDone = completedSections.has(curSec.id);
                return (
                  <div style={{ maxWidth: 860, margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--forge-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        Lesson {nativeSectionIdx + 1} of {course.sections.length}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <Clock size={13} /> {curSec.duration_minutes || 15} mins
                      </div>
                    </div>

                    <h1 style={{ margin: '0 0 24px 0', fontSize: '2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>
                      {curSec.title}
                    </h1>

                    {/* Lesson Markdown Content */}
                    <div className="course-lesson-content" style={{ fontSize: '0.96rem', lineHeight: 1.7, color: '#E2E8F0', marginBottom: 36 }}>
                      <ReactMarkdown>{curSec.content_markdown || '*No lesson content available.*'}</ReactMarkdown>
                    </div>

                    {/* Interactive Quizzes */}
                    {curSec.quizzes && curSec.quizzes.length > 0 && (
                      <div style={{ background: '#131926', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 18, padding: '24px 28px', marginBottom: 36 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                          <HelpCircle size={20} color="#34D399" />
                          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'white' }}>
                            Interactive Knowledge Check
                          </h3>
                        </div>

                        {curSec.quizzes.map((q, qIdx) => {
                          const qKey = `${curSec.id}_${q.id || qIdx}`;
                          const selectedOpt = nativeQuizAnswers[qKey];
                          const submitted = nativeQuizSubmitted[qKey];
                          const isCorrect = selectedOpt === q.correct_answer;

                          return (
                            <div key={q.id || qIdx} style={{ background: '#0B0F19', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 18, marginBottom: 16 }}>
                              <p style={{ margin: '0 0 14px 0', fontWeight: 700, fontSize: '0.95rem', color: 'white' }}>
                                {qIdx + 1}. {q.question_text}
                              </p>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {(q.options || []).map((opt, optIdx) => (
                                  <label
                                    key={optIdx}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '10px 14px',
                                      borderRadius: 10,
                                      background: submitted
                                        ? opt === q.correct_answer
                                          ? 'rgba(16, 185, 129, 0.2)'
                                          : selectedOpt === opt
                                          ? 'rgba(239, 68, 68, 0.2)'
                                          : 'rgba(255,255,255,0.02)'
                                        : selectedOpt === opt
                                        ? 'rgba(124, 58, 237, 0.2)'
                                        : 'rgba(255,255,255,0.03)',
                                      border: submitted && opt === q.correct_answer
                                        ? '1px solid #10B981'
                                        : selectedOpt === opt
                                        ? '1px solid var(--forge-accent)'
                                        : '1px solid rgba(255,255,255,0.06)',
                                      cursor: submitted ? 'default' : 'pointer',
                                      color: 'white',
                                      fontSize: '0.9rem'
                                    }}
                                  >
                                    <input
                                      type="radio"
                                      name={`native_quiz_${qKey}`}
                                      checked={selectedOpt === opt}
                                      onChange={() => !submitted && setNativeQuizAnswers(p => ({ ...p, [qKey]: opt }))}
                                      disabled={submitted}
                                      style={{ accentColor: '#7C3AED' }}
                                    />
                                    <span>{opt}</span>
                                  </label>
                                ))}
                              </div>

                              {!submitted ? (
                                <button
                                  type="button"
                                  disabled={!selectedOpt}
                                  onClick={() => setNativeQuizSubmitted(p => ({ ...p, [qKey]: true }))}
                                  className="btn btn-secondary btn-sm"
                                  style={{ marginTop: 12, fontWeight: 700 }}
                                >
                                  Check Answer
                                </button>
                              ) : (
                                <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', fontSize: '0.85rem' }}>
                                  <div style={{ fontWeight: 800, color: isCorrect ? '#34D399' : '#F87171', marginBottom: 4 }}>
                                    {isCorrect ? '✓ Correct Answer!' : '✕ Incorrect'}
                                  </div>
                                  <div style={{ color: '#CBD5E1' }}>
                                    {q.explanation}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Lesson Footer Navigation */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <button
                        type="button"
                        disabled={nativeSectionIdx === 0}
                        onClick={() => setNativeSectionIdx(Math.max(0, nativeSectionIdx - 1))}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
                      >
                        <ArrowLeft size={16} /> Previous Lesson
                      </button>

                      {nativeSectionIdx < course.sections.length - 1 ? (
                        <button
                          type="button"
                          onClick={() => handleCompleteNativeSection(curSec.id, nativeSectionIdx + 1)}
                          className="btn btn-primary"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px',
                            borderRadius: 12, fontWeight: 800, background: 'linear-gradient(135deg, #7C3AED, #6D28D9)'
                          }}
                        >
                          Complete & Next Lesson <ArrowRight size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCompleteNativeSection(curSec.id, nativeSectionIdx)}
                          className="btn btn-primary"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 26px',
                            borderRadius: 12, fontWeight: 800, background: 'linear-gradient(135deg, #10B981, #059669)',
                            boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)'
                          }}
                        >
                          <CheckCircle size={18} /> Complete Course & Claim Certificate
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 12 }}>
            <Award size={48} style={{ color: 'var(--text-muted)' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Course content is currently being prepared.</p>
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
