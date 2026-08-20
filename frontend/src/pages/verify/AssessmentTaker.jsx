import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyApi } from '../../api';
import { Terminal, TerminalSquare, Play, Info, CheckCircle, ChevronLeft, ChevronRight, Send, AlertTriangle, Clock, Maximize, AlertOctagon, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { normalizeProctoringConfig } from './proctoringConfig';

// Build a { categoryName: score } map from MediaPipe FaceLandmarker blendshapes.
// Blendshapes include purpose-built eye-gaze scores (eyeLookDown/Up/Out/In…)
// which are far more reliable for "looking away from screen" than iris geometry.
function getBlendshapes(result) {
  const list = result?.faceBlendshapes;
  if (!list || list.length === 0) return null;
  const cats = Array.isArray(list[0]) ? list[0] : list;
  const map = {};
  for (const c of cats) {
    if (c && c.categoryName) map[c.categoryName] = c.score || 0;
  }
  return map;
}

// ── Utility: extract test cases from markdown problem text ─────────────────────
const smartExtractTestCases = (markdown) => {
  if (!markdown) return [];
  const cases = [];
  const splitTopLevelArgs = (raw) => {
    const parts = [];
    let current = '';
    let depth = 0;
    let inString = false;
    let stringChar = '';
    for (const ch of raw) {
      if (inString) { current += ch; if (ch === stringChar) inString = false; continue; }
      if (ch === "'" || ch === '"') { inString = true; stringChar = ch; current += ch; continue; }
      if ('[{('.includes(ch)) depth += 1;
      else if (']})'.includes(ch) && depth > 0) depth -= 1;
      if (ch === ',' && depth === 0) { if (current.trim()) parts.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  };
  const regex = /Input:\s*(.*?)\s*\n\s*Output:\s*(.*?)(?:\n|$)/gi;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    let inputRaw = match[1].trim().replace(/`/g, '');
    let outputRaw = match[2].trim().replace(/`/g, '');
    const cleanValue = (val) => val.replace(/^[a-zA-Z0-9_]+\s*=\s*/, '').trim();
    const normalizedInput = splitTopLevelArgs(inputRaw).map(cleanValue).join('\n');
    cases.push({ input: normalizedInput || cleanValue(inputRaw), expected_output: cleanValue(outputRaw) });
  }
  return cases;
};

// ── CSS for markdown problem description ──────────────────────────────────────
const leetcodeStyle = `
  .leetcode-q-container { font-size: 0.95rem; line-height: 1.7; color: #eff1f6f2; padding-bottom: 24px; font-family: 'Inter', -apple-system, sans-serif; }
  .leetcode-q-container h1 { font-size: 1.6rem; margin: 0 0 1.5rem 0; color: #fff; font-weight: 800; letter-spacing: -0.02em; }
  .leetcode-q-container h2, .leetcode-q-container h3, .leetcode-q-container h4 { font-size: 1.25rem; margin: 32px 0 16px; color: #fff; font-weight: 700; }
  .leetcode-q-container p { margin-bottom: 16px; display: block; }
  .leetcode-q-container code { background: #282828; color: #ffb86c; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.85rem; font-family: 'JetBrains Mono', 'Fira Code', monospace; }
  .leetcode-q-container pre { background: #1e1e1e; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #3c3c3c; overflow-x: auto; }
  .leetcode-q-container pre code { background: transparent; padding: 0; color: #eff1f6; }
  .leetcode-q-container strong { color: #fff; font-weight: 700; }
  .leetcode-q-container ul, .leetcode-q-container ol { margin-bottom: 16px; padding-left: 24px; }
  .leetcode-q-container li { margin-bottom: 8px; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
function getCodingAnswerState(answer, question) {
  const language = (answer && typeof answer === 'object' && answer.language) || question.programming_language || 'python';
  const code = (answer && typeof answer === 'object' && typeof answer.code === 'string')
    ? answer.code
    : (question.starter_code || '');
  return {
    language,
    code,
    results: answer?.results || [],
    raw_stdout: answer?.raw_stdout || '',
    raw_stderr: answer?.raw_stderr || '',
    last_run_at: answer?.last_run_at || null,
  };
}

function starterForLanguage(language, existingStarter = '') {
  // Only return the DB-stored starter code for python (as authored by the question creator).
  // For all other languages, start with a blank editor so the candidate's own code is
  // never overwritten by boilerplate when switching languages.
  const trimmed = (existingStarter || '').trim();
  if (trimmed && language === 'python') return existingStarter;
  return '';
}

// ── Section Complete Overlay ───────────────────────────────────────────────────
// Shown when a section's time limit expires. Auto-advances after 3 s.
function SectionCompleteOverlay({ sections, currentSectionIndex, isFinalSection, onAdvance }) {
  const [countdown, setCountdown] = React.useState(3);
  const currentSection = sections[currentSectionIndex];
  const nextSection = !isFinalSection ? sections[currentSectionIndex + 1] : null;

  React.useEffect(() => {
    if (countdown <= 0) { onAdvance(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'linear-gradient(135deg, #0f0c29 0%, #1a1a2e 50%, #16213e 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center', padding: 32,
    }}>
      {/* Pulse ring */}
      <div style={{ position: 'relative', marginBottom: 32 }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 60px rgba(16,185,129,0.35)',
          animation: 'pulse 2s infinite',
        }}>
          <span style={{ fontSize: '2.5rem' }}>✓</span>
        </div>
      </div>

      <div style={{ color: '#6EE7B7', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
        Section Complete
      </div>
      <h2 style={{ fontSize: '2rem', color: '#fff', fontWeight: 800, marginBottom: 8 }}>
        {currentSection?.title}
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem', marginBottom: 40, maxWidth: 420, lineHeight: 1.7 }}>
        {isFinalSection
          ? 'You have completed all sections. Your assessment will be submitted automatically.'
          : <>Great work! Time for this section has ended. You will now move on to <strong style={{ color: '#A78BFA' }}>{nextSection?.title}</strong>.</>}
      </p>

      {/* Up next card */}
      {!isFinalSection && nextSection && (
        <div style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14, padding: '16px 28px', marginBottom: 36,
          display: 'flex', alignItems: 'center', gap: 16,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(124,58,237,0.25)', border: '1px solid rgba(124,58,237,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#A78BFA' }}>
            {currentSectionIndex + 2}
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{nextSection.title}</div>
            {nextSection.time_limit_minutes && (
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', marginTop: 2 }}>
                ⏱ {nextSection.time_limit_minutes} minute{nextSection.time_limit_minutes !== 1 ? 's' : ''} time limit
              </div>
            )}
          </div>
        </div>
      )}

      {/* Countdown */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          border: '3px solid rgba(124,58,237,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: '1.6rem', color: '#A78BFA',
          background: 'rgba(124,58,237,0.1)',
        }}>
          {countdown}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
          {isFinalSection ? 'Submitting' : 'Continuing'} in {countdown}s…
        </div>
        <button
          className="btn btn-primary"
          style={{ marginTop: 8, padding: '10px 28px', fontWeight: 700 }}
          onClick={onAdvance}
        >
          {isFinalSection ? 'Submit Now →' : `Continue to ${nextSection?.title} →`}
        </button>
      </div>
    </div>
  );
}

// ── Section Locked Banner ─────────────────────────────────────────────────────
// Inline info banner shown when a candidate tries to move to the next section
// before the current section's time has expired.
function SectionLockedBanner({ sectionTitle, sectionTimeLeft, formatTime, onClose }) {
  React.useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 14,
      background: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)',
      border: '1.5px solid #F59E0B',
      borderRadius: 14, padding: '16px 20px',
      marginBottom: 20,
      boxShadow: '0 4px 20px rgba(245,158,11,0.15)',
      animation: 'fadeIn 0.25s ease',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(245,158,11,0.15)', border: '2px solid #F59E0B',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem',
      }}>
        🔒
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#92400E', marginBottom: 4 }}>
          Section Locked — Time Remaining
        </div>
        <div style={{ fontSize: '0.85rem', color: '#78350F', lineHeight: 1.6 }}>
          <strong>{sectionTitle}</strong> has a time limit. You cannot move to the next section until the timer reaches zero.
          <br />
          <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: '#B45309', marginTop: 4, display: 'inline-block' }}>
            ⏱ {formatTime(sectionTimeLeft)} remaining
          </span>
        </div>
        <div style={{ fontSize: '0.78rem', color: '#A16207', marginTop: 6 }}>
          Use this time to review your answers or revisit any questions you skipped.
        </div>
      </div>
      <button
        onClick={onClose}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B45309', fontSize: '1.1rem', padding: 4, flexShrink: 0 }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AssessmentTaker() {
  const { id } = useParams();
  const nav = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const isAssessmentTestMode = searchParams.get('testMode') === '1' || localStorage.getItem('assessment_test_mode') === 'true';

  const [assessment, setAssessment] = useState(null);
  const proctoringConfig = useMemo(() => normalizeProctoringConfig(assessment?.proctoring_config), [assessment]);
  const [answers, setAnswers] = useState({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const sections = React.useMemo(() => {
    if (!assessment?.sections || assessment.sections.length === 0) return [];
    const definedSections = assessment.sections;
    const hasUncategorized = assessment.questions.some(q => !q.section_id);
    if (hasUncategorized) {
      return [...definedSections, { id: 'uncategorized', title: 'General Questions', time_limit_minutes: null }];
    }
    return definedSections;
  }, [assessment]);
  const currentSection = sections.length > 0 ? sections[currentSectionIndex] : null;

  const sectionQuestions = React.useMemo(() => {
    if (!assessment) return [];
    if (sections.length === 0) return assessment.questions.map((q, i) => ({ ...q, originalIndex: i }));
    return assessment.questions
      .map((q, i) => ({ ...q, originalIndex: i }))
      .filter(q => {
        if (currentSection?.id === 'uncategorized') return !q.section_id;
        return q.section_id === currentSection?.id;
      });
  }, [assessment, sections, currentSection]);

  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [sectionTimeLeft, setSectionTimeLeft] = useState(null);
  const [sectionComplete, setSectionComplete] = useState(false); // drives the transition banner
  const [sectionLockedMsg, setSectionLockedMsg] = useState(false); // inline "time not up yet" banner
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [consoleTab, setConsoleTab] = useState('testcase');
  const [runningCode, setRunningCode] = useState(false);
  const [selectedCase, setSelectedCase] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  // Live debug overlay (only populated in testMode) so we can verify what the
  // MediaPipe model actually returns for face count / gaze signals.
  const [proctorDebug, setProctorDebug] = useState(null);
  // Resume-session state: true if candidate previously started this assessment
  const [sessionAlreadyStarted, setSessionAlreadyStarted] = useState(false);
  const [startingSession, setStartingSession] = useState(false);
  // Resume limit info — populated from start-session response
  const [resumeInfo, setResumeInfo] = useState({ count: 0, max: 0, limited: false, limitReached: false });
  // assignment_id is returned by startSession and needed for recordStrike
  const assignmentIdRef = useRef(null);

  const submittingRef = useRef(false);
  const startTime = useRef(null);
  const sessionStartedAtRef = useRef(null);
  const pgEvents = useRef([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  // Direct Monaco editor instance — we read getValue() for Run Code
  const editorRef = useRef(null);

  // Proctoring Refs
  const speechRecognitionRef = useRef(null);
  const audioCtxRef = useRef(null);          // Web Audio API — catches murmurs
  const analyserRef = useRef(null);
  const audioCalibrationRef = useRef({ samples: [], baseline: null });
  const audioStateRef = useRef({ quietSamples: 0, lockedUntil: 0 });
  const lastSpeechStrikeRef = useRef({ transcript: '', time: 0 });
  const audioViolationTimer = useRef(null);
  const cameraTrackViolationTimer = useRef(null);
  const cameraObstructedTimerRef = useRef(null);
  const seenFaceOnceRef = useRef(false);
  const strikes = useRef(0);
  const submitRef = useRef(null);
  const handleCheatAttemptRef = useRef(null);
  const lastStrikeTime = useRef(0);
  const violationCooldownsRef = useRef({});
  // Mediapipe FaceLandmarker — real ML face/landmark model replacing the dead
  // native FaceDetector API. Provides 478 landmarks (with iris/eye centres)
  // used for face presence, multi-face, gaze and head-pose detection.
  const faceLandmarkerRef = useRef(null);
  const faceLandmarkerReadyRef = useRef(false);
  const faceLandmarkResultRef = useRef(null);
  const gazeStrikeTimerRef = useRef(null);
  const gazeSamplesRef = useRef(0);
  const headTurnStrikeTimerRef = useRef(null);
  const faceMissingTimerRef = useRef(null);
  const multiFaceStartRef = useRef(0);
  const multiFaceSamplesRef = useRef(0);
  // Guard: prevents the section timer from double-firing when currentSectionIndex
  // updates and sectionTimeLeft is still 0 on the same render cycle.
  const sectionTransitioningRef = useRef(false);
  // Proctoring thresholds are driven by the assignment's strictness config.
  const MAX_STRIKES = proctoringConfig.max_strikes || 5;
  const PROCTORING_START_GRACE_MS = proctoringConfig.grace_ms || 8000;

  // Load assessment
  useEffect(() => {
    verifyApi.getAssessment(id).then(r => {
      const data = r.data.data;
      if (data.terminated_by_proctor) {
        toast.error('This assessment was previously terminated by a proctor due to rules violations.', { duration: 10000 });
        nav('/verify/dashboard');
        return;
      }
      setAssessment(data);
      
      // Restore existing strikes from DB (candidate may have refreshed the page)
      if (data.strike_count !== undefined) {
        strikes.current = data.strike_count;
        setStrikeCount(data.strike_count);
      }

      // ── SERVER-AUTHORITATIVE TIMER ─────────────────────────────────────────
      // The server always returns session_already_started=true when started_at is
      // stamped on the AssessmentAssignment row. If true, use the server-computed
      // time_remaining_seconds as the timer — a page reload can NEVER extend it.
      // The candidate must also re-enter fullscreen (start gate shown with Resume btn),
      // but their strikes and time are preserved from the previous session.
      if (data.session_already_started) {
        setSessionAlreadyStarted(true);
        // Set the correct remaining time (may be null for unlimited assessments)
        if (data.time_remaining_seconds !== null && data.time_remaining_seconds !== undefined) {
          setTimeLeft(data.time_remaining_seconds);
        }
        // Do NOT auto-set hasStarted=true here — the candidate must re-enter
        // fullscreen so proctoring can restart and strikes can continue to accumulate.
      } else if (data.time_limit_minutes) {
        // Fresh session: pre-load the full timer value, but the timer effect will
        // only start ticking once the user clicks Start (hasStarted guard below).
        setTimeLeft(data.time_limit_minutes * 60);
      }
      // Also seed assignmentIdRef if assignment_id was returned (formally assigned candidate)
      if (data.assignment_id) assignmentIdRef.current = data.assignment_id;
    }).finally(() => setLoading(false));
  }, [id, nav]);

  // Global Timer — ONLY ticks when the candidate has actually started (entered fullscreen).
  // This prevents the pre-start gate from silently consuming time on reload.
  useEffect(() => {
    if (!hasStarted) return;   // ← KEY GUARD: no ticking until user clicks Start
    if (timeLeft === null) return;
    if (timeLeft <= 0) { submitRef.current?.(); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, hasStarted]);

  // Section Timer — ticks down the section-specific time limit.
  // IMPORTANT: currentSectionIndex and sections.length are intentionally NOT in the
  // dependency array here. Adding them caused the effect to re-run the moment
  // setCurrentSectionIndex was called (index changed but sectionTimeLeft was still 0),
  // which made it double-fire and skip the next section. We use sectionTransitioningRef
  // as a one-shot guard instead.
  useEffect(() => {
    if (!hasStarted || sectionTimeLeft === null) return;
    if (sectionTimeLeft <= 0) {
      // Already handling this transition — bail out immediately
      if (sectionTransitioningRef.current) return;
      sectionTransitioningRef.current = true;

      // Grab the section index synchronously via the state updater to avoid stale closure
      setCurrentSectionIndex(prev => {
        const nextIdx = prev + 1;
        if (nextIdx < sections.length) {
          // Show the section-complete banner; actual navigation happens inside it
          setSectionComplete(true);
        } else {
          // Final section — submit
          setSectionComplete(true);
        }
        return prev; // don't change index yet — the banner handles it
      });
      return;
    }
    const t = setTimeout(() => setSectionTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionTimeLeft, hasStarted]);

  // Set sectionTimeLeft when section changes (also resets the transition guard)
  useEffect(() => {
    sectionTransitioningRef.current = false;
    setSectionComplete(false);
    if (sections.length > 0 && currentSectionIndex < sections.length) {
      const section = sections[currentSectionIndex];
      if (section.time_limit_minutes) {
        setSectionTimeLeft(section.time_limit_minutes * 60);
      } else {
        setSectionTimeLeft(null);
      }
    }
  }, [currentSectionIndex, sections]);

  // Webcam & Audio proctoring
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(s => {
        streamRef.current = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        s.getVideoTracks().forEach(track => {
          track.onmute = () => {
            pgEvents.current.push({ type: 'camera_disabled', details: 'Camera track muted during assessment', time: new Date().toISOString() });
            handleCheatAttemptRef.current?.('Camera Disabled / Privacy Shutter Closed', 'camera_disabled');
          };
          track.onended = () => {
            pgEvents.current.push({ type: 'camera_disabled', details: 'Camera track ended during assessment', time: new Date().toISOString() });
            handleCheatAttemptRef.current?.('Camera Turned Off During Assessment', 'camera_disabled');
          };
        });
        // Web Audio analyser — voice frequency layer for murmurs
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaStreamSource(s);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 2048;            // Fine frequency resolution
          analyser.smoothingTimeConstant = 0.7;
          source.connect(analyser);
          audioCtxRef.current = audioCtx;
          analyserRef.current = analyser;
        } catch (e) { console.warn('Web Audio setup failed:', e); }
      })
      .catch(err => {
        toast.error('Webcam and Microphone access required for proctored assessments.', { duration: 6000 });
        pgEvents.current.push({ type: 'hardware_denied', details: err.message, time: new Date().toISOString() });
      });

    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (!proctoringConfig.audio_detect) return;
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (hasStarted && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [hasStarted]);

  const captureScreenshot = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const vid = videoRef.current;
      const can = canvasRef.current;
      if (vid.readyState === vid.HAVE_ENOUGH_DATA) {
        can.width = vid.videoWidth || 640; can.height = vid.videoHeight || 480;
        const ctx = can.getContext('2d');
        ctx.drawImage(vid, 0, 0, can.width, can.height);
        pgEvents.current.push({ type: 'screenshot', details: can.toDataURL('image/jpeg', 0.5), time: new Date().toISOString() });
      }
    }
  }, []);

  useEffect(() => {
    if (!hasStarted) return;
    const t0 = setTimeout(() => captureScreenshot('Initial Snapshot'), 5000);
    const t1 = setInterval(() => captureScreenshot('Periodic Screenshot'), 60000);
    return () => { clearTimeout(t0); clearInterval(t1); };
  }, [hasStarted, captureScreenshot]);

  const handleCheatAttempt = useCallback((actionName, eventType = 'proctoring_violation', cooldownMs = 15000) => {
    if (!hasStarted || submittingRef.current) return false;
    const startedAt = sessionStartedAtRef.current || 0;
    if (startedAt && (Date.now() - startedAt) < PROCTORING_START_GRACE_MS) return false;

    const now = Date.now();
    const lastForThisViolation = violationCooldownsRef.current[actionName] || 0;
    if (now - lastForThisViolation < cooldownMs) return false;   // blocked by per-violation cooldown
    if (now - lastStrikeTime.current < 1000) return false;        // min 1s between any two strikes
    violationCooldownsRef.current[actionName] = now;
    lastStrikeTime.current = now;

    strikes.current++;
    setStrikeCount(strikes.current);
    captureScreenshot(`Cheat: ${actionName}`);

    // Capture audio snippet for audio-related violations
    if (streamRef.current && (actionName.includes('Audio') || actionName.includes('Speaking') || actionName.includes('Voice') || actionName.includes('Murmur'))) {
      try {
        const recorder = new MediaRecorder(streamRef.current);
        const chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = () => {
             pgEvents.current.push({ type: 'audio_snippet', details: reader.result, time: new Date().toISOString() });
          };
        };
        recorder.start();
        setTimeout(() => recorder.stop(), 3000);
      } catch (e) { console.error('Snippet capture failed:', e); }
    }

    pgEvents.current.push({ type: eventType, details: `${actionName} (Strike #${strikes.current})`, time: new Date().toISOString() });

    const isTerminal = strikes.current >= MAX_STRIKES;

    // Persist strike state to the backend so a refresh doesn't reset it to 0.
    // Include the flag_type so the audit trail records WHY the strike happened.
    if (assessment && assessment.assignment_id) {
      verifyApi.recordStrike({
        assignment_id: assessment.assignment_id,
        violation_name: actionName,
        flag_type: eventType,
        is_terminal: isTerminal,
      }).catch(e => console.error('Failed to record strike on server', e));
    }

    if (isTerminal) {
      toast.error('Assessment terminated due to repeated proctoring violations.', { duration: 6000 });
      submitRef.current?.(true);
    } else {
      toast.error(`Warning: ${actionName}! (Strike ${strikes.current}/${MAX_STRIKES})`, { icon: '⚠️', duration: 4000 });
    }
    return true;  // strike was issued
  }, [captureScreenshot, hasStarted, assessment]);

  // ── Proctoring Analysis (Mediapipe FaceLandmarker) ────────────────────────
  //
  // Replaces the previous native-FaceDetector + hand-rolled pixel heuristics.
  // We use Google's MediaPipe Tasks-Vision FaceLandmarker (free & open source,
  // runs fully client-side via WASM) which returns 478 facial landmarks per
  // detected face, including iris/eye centres. From these landmarks we derive:
  //   • face presence      (>=1 face detected)
  //   • multiple people    (>=2 faces detected)
  //   • eye/gaze off-screen (iris position relative to eye corners)
  //   • head turn          (nose vs face-centre horizontal offset / yaw proxy)
  // All thresholds are pulled from the assignment's strictness config.
  useEffect(() => {
    if (!hasStarted) return;

    let cancelled = false;

    // ── Auto-seed seenFaceOnceRef after 10 s ─────────────────────────────────
    const seedTimer = setTimeout(() => {
      if (!seenFaceOnceRef.current) seenFaceOnceRef.current = true;
    }, 10000);

    // ── Load the MediaPipe FaceLandmarker model (WASM + .task weights) ────────
    // The model is fetched from the official CDN. It is cached by the browser so
    // subsequent assessments load instantly. OUTPUT_FACE_BLENDSHAPES is enabled so
    // blendshape scores (e.g. eyeLook* / headYaw) can be used as an extra signal.
    (async () => {
      try {
        const fileset = await FilesetResolver.forVisionTasks('/proctoring/wasm/');
        if (cancelled) return;
        const landmarker = await FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 4,
          // Lower the confidence floors so a second (often smaller / partially
          // framed) person is actually detected instead of being filtered out.
          minFaceDetectionConfidence: 0.3,
          minFacePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
          outputFaceBlendshapes: true,
        });
        if (cancelled) { landmarker.close?.(); return; }
        faceLandmarkerRef.current = landmarker;
        faceLandmarkerReadyRef.current = true;
      } catch (err) {
        console.error('Failed to load FaceLandmarker, proctoring CV disabled:', err);
        toast.error('Advanced proctoring model failed to load; basic monitoring only.', { duration: 5000 });
      }
    })();

    // ── LAYER 1: SpeechRecognition (clear spoken utterances) ─────────────────
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition && proctoringConfig.audio_detect) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const last = event.results[event.results.length - 1];
        const transcript = (last[0]?.transcript || '').trim().replace(/\s+/g, ' ');
        if (!transcript) return;

        const confidence = last[0]?.confidence || 0;
        const meaningfulFinal = last.isFinal && transcript.length >= 4;
        const highConfidenceInterim = !last.isFinal && confidence >= 0.9 && transcript.length >= 5;
        if (!meaningfulFinal && !highConfidenceInterim) return;

        const normalized = transcript.toLowerCase();
        const now = Date.now();
        const lastSpeech = lastSpeechStrikeRef.current;
        if (lastSpeech.transcript === normalized && now - lastSpeech.time < 45000) return;

        const fired = handleCheatAttemptRef.current?.('Speaking Detected During Assessment', 'audio_detected', 30000);
        if (fired) lastSpeechStrikeRef.current = { transcript: normalized, time: now };
      };
      recognition.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted') console.warn('SR error:', e.error);
      };
      recognition.onend = () => { try { recognition.start(); } catch { /* ignore */ } };
      try { recognition.start(); } catch { /* ignore */ }
      speechRecognitionRef.current = recognition;
    }

    // ── LAYER 2: Web Audio FFT — catches murmurs / whispers ─────────────────
    const audioInterval = setInterval(() => {
      if (!analyserRef.current || !proctoringConfig.audio_detect) return;
      // The AudioContext is created on mount but only starts producing data once
      // resumed (requires a user gesture). If it's still suspended (e.g. resume in
      // requestFS didn't take), nudge it now so the analyser actually receives audio.
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      const fftSize = analyserRef.current.fftSize;
      const sampleRate = audioCtxRef.current?.sampleRate || 44100;
      const binHz = sampleRate / fftSize;
      const voiceLow  = Math.floor(300  / binHz);
      const voiceHigh = Math.floor(3400 / binHz);
      const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(buf);
      const voiceBand  = buf.slice(voiceLow, voiceHigh + 1);
      const voiceAvg   = voiceBand.reduce((a, b) => a + b, 0) / voiceBand.length;
      const activeBins = voiceBand.filter(v => v > 20).length;
      const voiceRatio = activeBins / voiceBand.length;
      const timeBuf    = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(timeBuf);
      let rmsSum = 0;
      for (const s of timeBuf) { const c = (s - 128) / 128; rmsSum += c * c; }
      const rms = Math.sqrt(rmsSum / timeBuf.length);

      const cal = audioCalibrationRef.current;
      if (cal.samples.length < 8) {
        cal.samples.push(voiceAvg);
        cal.baseline = cal.samples.reduce((a, b) => a + b, 0) / cal.samples.length;
        return;
      }
      const baseline = cal.baseline || 0;
      const audioState = audioStateRef.current;
      if (audioState.quietSamples === 0 && !audioState.lockedUntil) audioState.quietSamples = 6;
      const now = Date.now();

      // Looser, more robust voice detection. A clear sustained voice near the mic
      // should be flagged even when the surrounding room is not perfectly quiet.
      const voiceFloor = Math.max(baseline + 14, 18);
      const voiceSpreadLooksHuman = voiceRatio >= 0.10 && voiceRatio <= 0.85;
      const energeticVoice = voiceAvg > voiceFloor && voiceSpreadLooksHuman && rms > 0.018;
      const veryLoudVoiceBand = voiceAvg > Math.max(baseline + 22, 30) && rms > 0.03;
      // Fallback: any clearly loud, sustained sound in the voice band (covers mics
      // with aggressive AGC that flatten the spectrum into a non-"human" shape).
      const loudSustain = voiceAvg > Math.max(baseline + 30, 40) && rms > 0.02;
      const isVoiceLike = energeticVoice || veryLoudVoiceBand || loudSustain;

      if (!isVoiceLike) {
        audioState.quietSamples = Math.min(audioState.quietSamples + 1, 20);
        audioViolationTimer.current = null;
        cal.baseline = baseline * 0.95 + voiceAvg * 0.05;
      }

      if (now < audioState.lockedUntil || audioState.quietSamples < 6) return;

      if (isVoiceLike) {
        if (!audioViolationTimer.current) audioViolationTimer.current = now;
        if (now - audioViolationTimer.current > (proctoringConfig.voice_sustain_ms || 3200)) {
          const fired = handleCheatAttemptRef.current?.('Sustained Voice Detected Near Microphone', 'audio_detected', proctoringConfig.audio_cooldown_ms || 45000);
          if (fired) {
            audioState.lockedUntil = now + (proctoringConfig.audio_cooldown_ms || 45000);
            audioState.quietSamples = 0;
          }
          audioViolationTimer.current = null;
        }
      }
    }, 500);

    // ── CV / FACE loop — runs every 700 ms (light enough for VIDEO mode) ─────
    const cvInterval = setInterval(() => {
      const vid = videoRef.current;
      const videoTrack = streamRef.current?.getVideoTracks?.()[0];
      const trackDead = !videoTrack || videoTrack.readyState !== 'live' || videoTrack.muted || !videoTrack.enabled;

      // Camera track died / disabled by OS (hardware lid switch / privacy shutter)
      if (trackDead) {
        if (!cameraTrackViolationTimer.current) cameraTrackViolationTimer.current = Date.now();
        if (Date.now() - cameraTrackViolationTimer.current > 1500) {
          handleCheatAttemptRef.current?.('Camera Disabled or Unavailable', 'camera_disabled', 15000);
          cameraTrackViolationTimer.current = null;
        }
        return;
      }
      cameraTrackViolationTimer.current = null;
      if (!vid || vid.readyState < 2 || vid.videoWidth === 0 || !faceLandmarkerReadyRef.current) return;

      // ── Camera covered / lid closed: brightness drops sharply ─────────────
      const can = canvasRef.current;
      if (!can) return;
      const ctx = can.getContext('2d', { willReadFrequently: true });
      can.width = 160; can.height = 120;
      ctx.drawImage(vid, 0, 0, 160, 120);
      const data = ctx.getImageData(0, 0, 160, 120).data;
      let brightness = 0;
      for (let i = 0; i < data.length; i += 4) brightness += (data[i] + data[i+1] + data[i+2]) / 3;
      const avgBright = brightness / (160 * 120);
      if (avgBright < 15) {
        if (!cameraObstructedTimerRef.current) cameraObstructedTimerRef.current = Date.now();
        if (Date.now() - cameraObstructedTimerRef.current > 2000) {
          handleCheatAttemptRef.current?.('Camera Obstructed / Covered', 'camera_obstructed', 15000);
          cameraObstructedTimerRef.current = null;
        }
      } else {
        cameraObstructedTimerRef.current = null;
      }

      // ── Run the ML landmarker ──────────────────────────────────────────────
      let result;
      try {
        result = faceLandmarkerRef.current.detectForVideo(vid, performance.now());
      } catch { /* ignore */ return; }
      const faces = result?.faceLandmarks || [];
      faceLandmarkResultRef.current = result;
      const now = Date.now();

      // ── Face presence ──────────────────────────────────────────────────────
      if (faces.length >= 1) {
        seenFaceOnceRef.current = true;
        faceMissingTimerRef.current = null;
      } else if (seenFaceOnceRef.current && proctoringConfig.face_not_visible) {
        if (!faceMissingTimerRef.current) faceMissingTimerRef.current = now;
        else if (now - faceMissingTimerRef.current > (proctoringConfig.face_missing_sustain_ms || 7000)) {
          handleCheatAttemptRef.current?.('Face Not Visible — Please Stay in Frame', 'person_not_visible', 12000);
          captureScreenshot('Face Not Visible');
          faceMissingTimerRef.current = null;
        }
      }

      // ── Multiple people ───────────────────────────────────────────────────
      if (faces.length >= 2 && proctoringConfig.multiple_people) {
        if (!multiFaceStartRef.current) {
          multiFaceStartRef.current = now;
          multiFaceSamplesRef.current = 1;
        } else {
          multiFaceSamplesRef.current += 1;
          if (
            now - multiFaceStartRef.current > (proctoringConfig.multiple_people_sustain_ms || 10000) &&
            multiFaceSamplesRef.current >= (proctoringConfig.multiple_people_min_samples || 4)
          ) {
            handleCheatAttemptRef.current?.(`Multiple People in Camera (${faces.length} faces)`, 'proctoring_violation', 60000);
            multiFaceStartRef.current = 0;
            multiFaceSamplesRef.current = 0;
          }
        }
      } else {
        multiFaceStartRef.current = 0;
        multiFaceSamplesRef.current = 0;
      }

      // ── Gaze (eyes off screen) & head turn, per primary face ───────────────
      if (faces.length >= 1) {
        const lm = faces[0];
        const noseTip  = lm[1];
        const leftFace = lm[234];  // face left edge
        const rightFace = lm[454]; // face right edge

        // Gaze detection uses TWO complementary signals so brief "here and there"
        // glances are caught reliably:
        //  (a) MediaPipe blendshapes — trained eye-gaze scores (down/up/out/in).
        //      When glancing sideways, one eye looks OUT and the OTHER looks IN,
        //      so we must combine both directions to capture side glances.
        //  (b) Iris geometry — how far the pupil sits from the eye centre.
        //      A very direct proxy: pupil near the corner => looking that way.
        const bs = getBlendshapes(result);
        if (proctoringConfig.eye_tracking) {
          // (a) blendshapes
          const down = (bs?.eyeLookDownLeft || 0) + (bs?.eyeLookDownRight || 0);
          const up   = (bs?.eyeLookUpLeft || 0) + (bs?.eyeLookUpRight || 0);
          // look LEFT => left eye out + right eye in ; look RIGHT => right eye out + left eye in
          const left  = (bs?.eyeLookOutLeft || 0) + (bs?.eyeLookInRight || 0);
          const right = (bs?.eyeLookOutRight || 0) + (bs?.eyeLookInLeft || 0);
          const bsHoriz = Math.max(left, right);
          const bsVert  = down + up;
          // Thresholds come from proctoringConfig (set per-strictness level).
          // Lower values = more sensitive; catches eyes-only glances while the
          // head is still forward-facing. Previously hardcoded at 0.15/0.20 (too high).
          const bsHorizThr = proctoringConfig.gaze_bs_horiz_threshold ?? 0.08;
          const bsVertThr  = proctoringConfig.gaze_bs_vert_threshold  ?? 0.14;
          const bsAway = bsHoriz > bsHorizThr || bsVert > bsVertThr;

          // (b) iris geometry — normalised pupil offset within the eye opening.
          let irisAway = false;
          let irisDir = '';
          let gxVal = 0, gyVal = 0, irisAvail = false;
          // Calculate each pupil against its own eye, not the entire face.
          // This catches eye-only side glances while the head is still centred.
          const rightOuter = lm[33], rightInner = lm[133], leftInner = lm[362], leftOuter = lm[263];
          const rightIris = lm[468], leftIris = lm[473];
          const rightTop = lm[159], rightBottom = lm[145], leftTop = lm[386], leftBottom = lm[374];
          if (rightOuter && rightInner && leftInner && leftOuter && rightIris && leftIris && rightTop && rightBottom && leftTop && leftBottom) {
            irisAvail = true;
            const pupilOffset = (iris, outer, inner, top, bottom) => ({
              x: (iris.x - (outer.x + inner.x) / 2) / (Math.abs(inner.x - outer.x) || 1),
              y: (iris.y - (top.y + bottom.y) / 2) / (Math.abs(bottom.y - top.y) || 1),
            });
            const rightEye = pupilOffset(rightIris, rightOuter, rightInner, rightTop, rightBottom);
            const leftEye = pupilOffset(leftIris, leftOuter, leftInner, leftTop, leftBottom);
            const gx = (rightEye.x + leftEye.x) / 2;
            const gxClamped = Math.max(-0.5, Math.min(0.5, gx));
            const gy = (rightEye.y + leftEye.y) / 2;
            gxVal = gxClamped; gyVal = gy;
            const irisXThr = proctoringConfig.gaze_iris_x_threshold ?? 0.08;
            const irisYThr = proctoringConfig.gaze_iris_y_threshold ?? 0.12;
            irisAway = Math.abs(gxClamped) > irisXThr || Math.abs(gy) > irisYThr;
            irisDir = Math.abs(gxClamped) > Math.abs(gy) ? (gxClamped > 0 ? 'right' : 'left') : (gy > 0 ? 'down' : 'up');
          }

          const gazeOff = bsAway || irisAway;
          if (isAssessmentTestMode) {
            setProctorDebug({
              faces: faces.length,
              model: faceLandmarkerReadyRef.current,
              bsLen: result?.faceBlendshapes?.length ?? -1,
              bsCount: bs ? Object.keys(bs).length : 0,
              L: +left.toFixed(2), R: +right.toFixed(2), D: +down.toFixed(2), U: +up.toFixed(2),
              bsHorizThr: +(bsHorizThr).toFixed(2), bsVertThr: +(bsVertThr).toFixed(2),
              bsAway,
              irisAvail, gx: +gxVal.toFixed(2), gy: +gyVal.toFixed(2), irisAway,
              gazeOff,
              nose: noseTip ? +noseTip.x.toFixed(2) : null,
            });
          }
          // Single debounce: sustain timer only. Previously had a redundant
          // gazeSamplesRef >= 4 guard (2.8 s at 700ms/frame) on top of the sustain
          // timer, causing eyes-only glances to be silently ignored. Removed.
          if (gazeOff) {
            if (!gazeStrikeTimerRef.current) {
              gazeStrikeTimerRef.current = now;
            } else if (now - gazeStrikeTimerRef.current > (proctoringConfig.gaze_averted_sustain_ms || 4000)) {
              const dir = irisAway ? irisDir
                : (bsHoriz > bsVert ? (left > right ? 'left' : 'right') : (down >= up ? 'down' : 'up'));
              handleCheatAttemptRef.current?.(`Candidate Looking Away From Screen (${dir})`, 'gaze_averted', 20000);
              gazeStrikeTimerRef.current = null;
            }
          } else {
            gazeStrikeTimerRef.current = null;
          }
        } else {
          gazeStrikeTimerRef.current = null;
        }

        if (noseTip && leftFace && rightFace) {
          // Head turn proxy: nose horizontal offset from the face centre,
          // normalised by face width. Large offset => head turned sideways.
          const faceCentreX = (leftFace.x + rightFace.x) / 2;
          const faceW = Math.abs(rightFace.x - leftFace.x) || 1;
          const headTurn = (noseTip.x - faceCentreX) / faceW;

          if (Math.abs(headTurn) > 0.40 && proctoringConfig.head_turn) {
            if (!headTurnStrikeTimerRef.current) headTurnStrikeTimerRef.current = now;
            else if (now - headTurnStrikeTimerRef.current > (proctoringConfig.head_turn_sustain_ms || 6000)) {
              handleCheatAttemptRef.current?.(`Excessive Head Turning Detected (${headTurn > 0 ? 'right' : 'left'})`, 'head_turn', 20000);
              headTurnStrikeTimerRef.current = null;
            }
          } else {
            headTurnStrikeTimerRef.current = null;
          }
        }
      } else {
        gazeStrikeTimerRef.current = null;
        gazeSamplesRef.current = 0;
        headTurnStrikeTimerRef.current = null;
      }
    }, 700);

    return () => {
      cancelled = true;
      clearTimeout(seedTimer);
      clearInterval(audioInterval);
      clearInterval(cvInterval);
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onend = null;
        try { speechRecognitionRef.current.abort(); } catch { /* ignore */ }
        speechRecognitionRef.current = null;
      }
      audioViolationTimer.current = null;
      audioStateRef.current = { quietSamples: 0, lockedUntil: 0 };
      cameraTrackViolationTimer.current = null;
      cameraObstructedTimerRef.current = null;
      faceMissingTimerRef.current = null;
      gazeStrikeTimerRef.current = null;
      headTurnStrikeTimerRef.current = null;
      multiFaceStartRef.current = 0;
      multiFaceSamplesRef.current = 0;
      faceLandmarkerReadyRef.current = false;
    };
  }, [hasStarted, handleCheatAttempt, captureScreenshot]);



  useEffect(() => {
    const handler = () => {
      if (!proctoringConfig.tab_switch) return;
      if (!hasStarted || submittingRef.current) return;
      if (document.hidden) handleCheatAttempt('Tab Switching', 'tab_switch', proctoringConfig.tab_switch_cooldown_ms || 15000);
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [hasStarted, handleCheatAttempt]);

  useEffect(() => {
    const onFSChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      if (!proctoringConfig.full_screen) return;
      if (!hasStarted || submittingRef.current) return;
      if (!isFS) handleCheatAttempt('Exiting Fullscreen', 'proctoring_violation', 15000);
    };
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, [hasStarted, handleCheatAttempt]);

  const handleSubmit = useCallback(async (isMalpractice = false) => {
    if (submitting) return;
    setSubmitting(true);
    submittingRef.current = true;
    try {
      const formattedAnswers = { ...answers };
      (assessment?.questions || []).forEach(q => {
        if (q.question_type === 'coding') {
          const st = getCodingAnswerState(formattedAnswers[q.id], q);
          // Pull latest code from Monaco if this is the currently displayed question
          const liveCode = (currentQ === (assessment?.questions || []).indexOf(q) && editorRef.current)
            ? editorRef.current.getValue()
            : st.code;
          formattedAnswers[q.id] = JSON.stringify({ language: st.language || 'python', code: liveCode || '' });
        }
      });
      const res = await verifyApi.submitAssessment({
        assessment_id: parseInt(id),
        answers: formattedAnswers,
        time_taken_seconds: startTime.current ? Math.floor((Date.now() - startTime.current) / 1000) : 0,
        proctoring_events: pgEvents.current,
        is_malpractice: isMalpractice,
      });
      toast.success('Assessment submitted!');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      nav(`/verify/result/${res.data.data.result_id}`);
    } catch (err) {
      const errorDetail = err.response?.data?.detail;
      toast.error(typeof errorDetail === 'string' ? errorDetail : 'Submission failed. Please try again.', { duration: 5000 });
      setSubmitting(false);
      submittingRef.current = false;
    }
  }, [id, answers, submitting, nav, assessment, currentQ]);

  useEffect(() => { submitRef.current = handleSubmit; }, [handleSubmit]);
  // Keep the cheat-attempt ref always pointing to the latest callback
  useEffect(() => { handleCheatAttemptRef.current = handleCheatAttempt; }, [handleCheatAttempt]);

  const requestFS = useCallback(async () => {
    if (!document.documentElement.requestFullscreen) return;

    // ── Tell the server this session is starting (idempotent — safe to call on resume)
    // Passing assessment_id (not assignment_id) so the endpoint can auto-create
    // an AssessmentAssignment row if the user doesn't have one yet.
    const assessmentId = assessment?.id || parseInt(id);
    setStartingSession(true);
    try {
      const res = await verifyApi.startSession({ assessment_id: assessmentId });
      const sdata = res.data?.data;
      if (sdata) {
        // Store the canonical assignment_id for recordStrike calls
        if (sdata.assignment_id) {
          assignmentIdRef.current = sdata.assignment_id;
          // Patch it into the assessment object so handleCheatAttempt can read it
          setAssessment(prev => prev ? { ...prev, assignment_id: sdata.assignment_id } : prev);
        }
        // Sync strikes from server (may differ from client if network was lost)
        if (sdata.strike_count !== undefined) {
          strikes.current = sdata.strike_count;
          setStrikeCount(sdata.strike_count);
        }
        // Override the timer with the server-authoritative remaining seconds
        if (sdata.time_remaining_seconds !== null && sdata.time_remaining_seconds !== undefined) {
          setTimeLeft(sdata.time_remaining_seconds);
        }
        // Track resume info for the start gate banner
        if (sdata.is_resume) {
          setResumeInfo({
            count: sdata.resume_count || 0,
            max: sdata.max_resumes || 0,
            limited: sdata.limit_resumes || false,
            limitReached: false,
          });
        }
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 429) {
        // Resume limit hit — show locked screen, don't proceed
        setResumeInfo({ count: 0, max: 0, limitReached: true, message: detail || 'You have used all your allowed re-opens for this test.' });
        setStartingSession(false);
        return;
      }
      if (err?.response?.status === 403) {
        toast.error(detail || 'This assessment was terminated due to proctoring violations.', { duration: 8000 });
        setStartingSession(false);
        return;
      }
      // Non-fatal: log and continue so the candidate isn't stuck on the start gate
      console.error('start-session failed:', err);
      toast.error('Could not sync session with server. Timer may not be preserved.', { duration: 4000 });
    } finally {
      setStartingSession(false);
    }

    document.documentElement.requestFullscreen()
      .then(() => {
        const now = Date.now();
        sessionStartedAtRef.current = now;
        if (!startTime.current) startTime.current = now;
        setIsFullscreen(true);
        setHasStarted(true);
        // Resume AudioContext now that the user has interacted with the page
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(e => console.warn('Audio resume failed:', e));
        }
      })
      .catch(() => toast.error('Fullscreen blocked. Please click again.'));
  }, [assessment, id]);

  // Check if clipboard event came from inside Monaco (avoid false cheat strikes)
  const isMonacoEvent = (e) => {
    let node = e.target;
    while (node) {
      if (node.classList && (node.classList.contains('monaco-editor') || node.classList.contains('inputarea'))) return true;
      node = node.parentElement;
    }
    return false;
  };

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="spinner spinner-lg" /></div>;
  if (!assessment) return <div style={{ padding: 32 }}>Assessment not found.</div>;

  // ── Mandatory Start Gate ───────────────────────────────────────────────────
  if (!hasStarted) {
    const resumeTimeStr = timeLeft !== null ? `${String(Math.floor(timeLeft / 60)).padStart(2, '0')}:${String(timeLeft % 60).padStart(2, '0')}` : null;

    // ── Resume limit exceeded — show a locked screen ────────────────────────
    if (resumeInfo.limitReached) {
      return (
        <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #020108 0%, #1E1B4B 50%, #020108 100%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
          <div className="animate-scale-in" style={{ maxWidth: 480 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239,68,68,0.2)', border: '2px solid rgba(239,68,68,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px' }}>
              <AlertOctagon size={40} color="#ef4444" />
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: 12, color: '#ef4444', fontWeight: 800 }}>Test Access Locked</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 24, fontSize: '1rem', lineHeight: 1.7 }}>
              {resumeInfo.message || 'You have used all your allowed re-opens for this test.'}
            </p>
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                The maximum number of re-opens set by the test organiser has been reached. Please contact your assessment coordinator if you believe this is an error.
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #020108 0%, #1E1B4B 50%, #020108 100%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div className="animate-scale-in" style={{ maxWidth: 540 }}>

          {/* ── RESUME WARNING BANNER ─────────────────────────────────────── */}
          {sessionAlreadyStarted && (
            <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <AlertOctagon size={22} color="#ef4444" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ color: '#ef4444', fontWeight: 800, fontSize: '0.95rem', marginBottom: 6 }}>⚠️ Resuming a Previous Session</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.85rem', lineHeight: 1.6 }}>
                  You have already started this assessment. Your previous session is still active.
                  Closing and reopening the page does <strong style={{ color: '#ef4444' }}>not reset your timer or strikes</strong>.
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {resumeTimeStr && <span style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '4px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, fontFamily: 'monospace' }}>⏱ {resumeTimeStr} remaining</span>}
                  <span style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '4px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700 }}>⚡ {strikeCount}/{MAX_STRIKES} strikes carried over</span>
                  {resumeInfo.limited && (
                    <span style={{ background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '4px 12px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700 }}>
                      🔄 {resumeInfo.count} of {resumeInfo.max} re-opens used
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 0 40px rgba(124,58,237,0.3)' }}>
            <Maximize size={36} color="#fff" />
          </div>
          <h2 style={{ fontSize: '2.2rem', marginBottom: 12, color: '#fff', fontWeight: 800 }}>{assessment.title}</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontSize: '1rem', lineHeight: 1.6 }}>
            This is a <strong style={{ color: '#A855F7' }}>proctored assessment</strong>. The following conditions apply:
          </p>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginTop: 16, marginBottom: 28, textAlign: 'left' }}>
            <div style={{ display: 'grid', gap: 12, fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>
              {proctoringConfig.full_screen && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>🖥️</span> Fullscreen mode is mandatory</div>}
              {(proctoringConfig.multiple_people || proctoringConfig.face_not_visible || proctoringConfig.audio_detect) && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span>📹</span> {proctoringConfig.audio_detect ? 'Webcam and 🎤 Microphone' : 'Webcam'} will be monitored
                </div>
              )}
              {proctoringConfig.eye_tracking && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>👁️</span> You must keep your eyes on the screen</div>}
              {proctoringConfig.head_turn && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>🙆</span> Excessive head turning is not allowed</div>}
              {proctoringConfig.tab_switch && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>🚫</span> Tab switching is restricted</div>}
              {(proctoringConfig.full_screen || proctoringConfig.multiple_people || proctoringConfig.face_not_visible || proctoringConfig.audio_detect || proctoringConfig.tab_switch) && (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>⚠️</span> {MAX_STRIKES} violations = automatic termination</div>
              )}
              {assessment.time_limit_minutes && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>⏱️</span> Total time: <strong>{assessment.time_limit_minutes} minutes</strong></div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>📝</span> {(assessment.questions || []).length} questions</div>
            </div>
            {/* Section breakdown */}
            {sections.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>
                  Assessment Sections
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sections.filter(s => s.id !== 'uncategorized').map((sec, idx) => {
                    const secQCount = (assessment.questions || []).filter(q => q.section_id === sec.id).length;
                    return (
                      <div key={sec.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: 8, fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>{idx + 1}</div>
                          <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}>{sec.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
                          {secQCount > 0 && <span>{secQCount} Q</span>}
                          {sec.time_limit_minutes && <span style={{ color: '#A78BFA' }}>⏱ {sec.time_limit_minutes} min</span>}
                          {sec.time_limit_minutes && <span style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '1px 6px', borderRadius: 4, fontSize: '0.7rem' }}>🔒 Locked</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button
            className="btn btn-primary btn-lg btn-block"
            onClick={requestFS}
            disabled={startingSession}
            style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: 700 }}
          >
            {startingSession
              ? <><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2, marginRight: 8 }} /> Connecting...</>
              : <><Maximize size={20} /> {sessionAlreadyStarted ? 'Resume Assessment' : 'Enter Fullscreen \u0026 Start Assessment'}</>
            }
          </button>
          <p style={{ marginTop: 20, color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>
            {sessionAlreadyStarted
              ? 'Your session data is preserved on our servers. You cannot reset your timer or strikes.'
              : 'By starting, you agree to the proctoring terms above.'}
          </p>
        </div>
      </div>
    );
  }


  const questions = sectionQuestions; // Alias for compatibility with rest of file
  const q = questions[currentQ];

  // Parse test cases from string if needed
  if (q && q.question_type === 'coding' && typeof q.test_cases === 'string') {
    try { q.test_cases = JSON.parse(q.test_cases); } catch { q.test_cases = []; }
  }
  // Smart-extract test cases from problem text if none in DB
  if (q && q.question_type === 'coding' && (!q.test_cases || q.test_cases.length === 0)) {
    q.test_cases = smartExtractTestCases(q.question_text || '');
  }

  const codingState = q?.question_type === 'coding' ? getCodingAnswerState(answers[q.id], q) : null;
  const answered = Object.keys(answers).length;
  const isLastQuestionInSection = currentQ === questions.length - 1;
  const isLastSection = sections.length === 0 || currentSectionIndex === sections.length - 1;
  const timerClass = timeLeft === null ? '' : timeLeft < 60 ? 'danger' : timeLeft < 300 ? 'warning' : '';
  const sectionTimerClass = sectionTimeLeft === null ? '' : sectionTimeLeft < 60 ? 'danger' : sectionTimeLeft < 300 ? 'warning' : '';
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--bg-page)', position: 'relative' }}
      onCopy={isAssessmentTestMode ? undefined : (e => { if (!proctoringConfig.block_paste || isMonacoEvent(e)) return; e.preventDefault(); handleCheatAttempt('Copying text'); })}
      onPaste={isAssessmentTestMode ? undefined : (e => { if (!proctoringConfig.block_paste || isMonacoEvent(e)) return; e.preventDefault(); handleCheatAttempt('Pasting text'); })}
      onCut={isAssessmentTestMode ? undefined : (e => { if (!proctoringConfig.block_paste || isMonacoEvent(e)) return; e.preventDefault(); handleCheatAttempt('Cutting text'); })}
      onContextMenu={isAssessmentTestMode ? undefined : (e => { if (!proctoringConfig.block_paste || isMonacoEvent(e)) return; e.preventDefault(); handleCheatAttempt('Right Click'); })}
    >
      <style>{leetcodeStyle}</style>

      {isAssessmentTestMode && (
        <div style={{ position: 'sticky', top: 64, zIndex: 45, background: '#FEF3C7', color: '#92400E', borderBottom: '1px solid #F59E0B', padding: '10px 24px', fontSize: '0.85rem', fontWeight: 600 }}>
          ⚠️ Assessment test mode active — copy/paste allowed in this session.
        </div>
      )}

      {!isFullscreen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,1,8,0.98)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, backdropFilter: 'blur(10px)' }}>
          <div className="animate-scale-in" style={{ maxWidth: 450 }}>
            <AlertOctagon size={64} color="#ef4444" style={{ marginBottom: 24 }} />
            <h2 style={{ fontSize: '2rem', marginBottom: 16 }}>Screen Lock Required</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
              You must stay in Fullscreen Mode during this assessment. Exiting fullscreen has been logged as a strike.
            </p>
            <button className="btn btn-primary btn-lg btn-block" onClick={requestFS}><Maximize size={20} /> Resume In Fullscreen</button>
            <p style={{ marginTop: 24, color: '#ef4444', fontWeight: 600, fontSize: '0.9rem' }}>Strikes: {strikeCount} / {MAX_STRIKES}</p>
          </div>
        </div>
      )}

      <div className="page-bg" />

      {/* ── Section Complete Overlay ──────────────────────────────────────────
          Shows when a section's time expires. Gives the candidate a 3-second
          countdown before advancing, so it never feels abrupt or buggy.      */}
      {sectionComplete && (
        <SectionCompleteOverlay
          sections={sections}
          currentSectionIndex={currentSectionIndex}
          isFinalSection={currentSectionIndex === sections.length - 1}
          onAdvance={() => {
            setSectionComplete(false);
            if (currentSectionIndex < sections.length - 1) {
              setCurrentSectionIndex(i => i + 1);
              setCurrentQ(0);
            } else {
              handleSubmit(false);
            }
          }}
        />
      )}

      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 50 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{assessment.title}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{answered}/{questions.length} answered</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999, background: strikeCount > 0 ? '#FEF2F2' : '#F1F5F9', color: strikeCount > 0 ? '#B91C1C' : '#475569', fontSize: '0.78rem', fontWeight: 700 }}>
            <AlertTriangle size={14} /> Strikes {strikeCount}/{MAX_STRIKES}
          </span>
          {sectionTimeLeft !== null && (
            <div className={`timer ${sectionTimerClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, padding: '4px 12px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {formatTime(sectionTimeLeft)}</div>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Section</div>
            </div>
          )}
          {timeLeft !== null && (
            <div className={`timer ${timerClass}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.1, padding: '4px 12px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={14} /> {formatTime(timeLeft)}</div>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</div>
            </div>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => {
          if (currentSection?.time_limit_minutes && sectionTimeLeft > 0) {
            setSectionLockedMsg(true);
            return;
          }
          handleSubmit(false);
        }} disabled={submitting}><Send size={15} /> {submitting ? 'Submitting…' : 'Submit'}</button>
      </div>

      <div style={{ maxWidth: q?.question_type === 'coding' ? 1400 : 860, width: '100%', margin: '0 auto', padding: q?.question_type === 'coding' ? '24px' : '32px 24px', transition: 'max-width 0.3s ease' }}>
        {sections.length > 0 && (
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
            {sections.map((sec, idx) => {
              const isDone = idx < currentSectionIndex;
              const isActive = idx === currentSectionIndex;
              const isFuture = idx > currentSectionIndex;
              // Level 2: no timers → all pills are freely clickable
              // Level 3: timer on current section → future pills trigger lock banner
              const isFreeSwitchable = !sec.time_limit_minutes && !currentSection?.time_limit_minutes;
              const isClickable = !isActive && (isDone || isFreeSwitchable);
              return (
                <div
                  key={sec.id}
                  onClick={() => {
                    if (isActive) return;
                    if (isFreeSwitchable) {
                      // Level 2 — jump directly to clicked section
                      setCurrentSectionIndex(idx);
                      setCurrentQ(0);
                    } else if (isFuture && currentSection?.time_limit_minutes && sectionTimeLeft > 0) {
                      // Level 3 — section is time-locked
                      setSectionLockedMsg(true);
                    }
                  }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: 20,
                    fontSize: '0.85rem',
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'var(--primary)' : isDone ? 'var(--success)' : 'var(--bg-card)',
                    color: isActive ? '#fff' : isDone ? '#fff' : 'var(--text-muted)',
                    border: isActive ? 'none' : isDone ? 'none' : '1px solid var(--border)',
                    opacity: isFuture && !isFreeSwitchable ? 0.55 : 1,
                    boxShadow: isActive ? '0 4px 12px rgba(124, 58, 237, 0.25)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 7,
                    transition: 'all 0.2s ease',
                    cursor: isClickable ? 'pointer' : 'default',
                    userSelect: 'none',
                    transform: isClickable ? undefined : undefined,
                  }}
                  onMouseEnter={e => { if (isClickable) e.currentTarget.style.transform = 'scale(1.04)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: isActive ? 'rgba(255,255,255,0.2)' : isDone ? 'rgba(255,255,255,0.25)' : 'var(--bg-page)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.68rem', fontWeight: 800
                  }}>
                    {isDone ? '✓' : isFuture && sec.time_limit_minutes ? '🔒' : idx + 1}
                  </div>
                  {sec.title}
                  {sec.time_limit_minutes && isActive && sectionTimeLeft !== null && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.8 }}>· {Math.ceil(sectionTimeLeft / 60)}m left</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Progress bar */}
        <div className="progress-bar" style={{ marginBottom: 24 }}>
          <div className="progress-fill" style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>

        {/* ── Question Card ─────────────────────────────────────────────────── */}
        {q && (
          <div className="question-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="badge badge-primary">Question {currentQ + 1} of {questions.length}</span>
                {/* Question tags — visible to candidate so they know the category */}
                {(q.tags || []).map(tag => (
                  <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'var(--primary-lightest)', color: 'var(--primary)', borderRadius: 999, padding: '3px 9px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                    🏷 {tag}
                  </span>
                ))}
              </div>
              <span className="badge badge-muted">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
            </div>

            {/* Images (for non-coding questions) */}
            {q.images && q.images.length > 0 && q.question_type !== 'coding' && (
              <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
                {q.images.map((imgUrl, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-page)', borderRadius: 12, padding: 12, border: '1px solid var(--border)', width: '100%', maxWidth: 700 }}>
                    <img src={imgUrl} alt={`Attachment ${idx + 1}`} style={{ width: '100%', maxHeight: 500, borderRadius: 8, objectFit: 'contain', display: 'block' }} />
                  </div>
                ))}
              </div>
            )}

            {q.question_type !== 'coding' && <h3 style={{ marginBottom: 24, lineHeight: 1.5 }}>{q.question_text}</h3>}

            {/* MCQ */}
            {(q.question_type === 'mcq' || q.question_type === 'mcq_multi') && q.options && (
              <div>
                {q.options.map((opt, i) => {
                  const isSelected = q.question_type === 'mcq'
                    ? answers[q.id] === opt
                    : Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                  const toggle = () => {
                    if (q.question_type === 'mcq') {
                      setAnswers(a => ({ ...a, [q.id]: opt }));
                    } else {
                      setAnswers(a => {
                        const cur = Array.isArray(a[q.id]) ? a[q.id] : [];
                        return { ...a, [q.id]: cur.includes(opt) ? cur.filter(x => x !== opt) : [...cur, opt] };
                      });
                    }
                  };
                  return (
                    <div key={i} className={`option-item ${isSelected ? 'selected' : ''}`} onClick={toggle}>
                      <div style={{ width: 28, height: 28, borderRadius: q.question_type === 'mcq' ? '50%' : '4px', border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: isSelected ? 'var(--primary)' : 'var(--text-muted)', background: isSelected ? 'var(--primary-lightest)' : 'white', flexShrink: 0 }}>
                        {q.question_type === 'mcq' ? String.fromCharCode(65 + i) : (isSelected ? '✓' : '')}
                      </div>
                      <span style={{ flex: 1 }}>{opt}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Written */}
            {q.question_type === 'written' && (
              <textarea className="form-control" rows={8} placeholder="Write your answer here…" value={answers[q.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))} />
            )}

            {/* Fill in the Blank */}
            {q.question_type === 'fill_in' && (
              <input
                type="text"
                className="form-control"
                style={{ fontSize: '1rem', padding: '12px 14px' }}
                placeholder="Type your answer here…"
                value={answers[q.id] || ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
            )}

            {/* ── Coding Question ─────────────────────────────────────────────── */}
            {q.question_type === 'coding' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 0, alignItems: 'stretch', height: 'calc(100vh - 240px)', background: 'var(--bg-card)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                {/* Left: Problem Description */}
                <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', background: 'var(--bg-page)', borderBottom: '1px solid var(--border)', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--primary)' }}>
                    <Info size={16} /> PROBLEM DESCRIPTION
                  </div>
                  <div style={{ padding: 24, overflowY: 'auto', flex: 1, lineHeight: 1.6 }}>
                    <h3 style={{ marginBottom: 16, fontSize: '1.25rem' }}>{assessment?.title || 'Coding Challenge'}</h3>
                    {q.images && q.images.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                        {q.images.map((imgUrl, idx) => (
                          <div key={idx} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <img src={imgUrl} alt={`Viz ${idx + 1}`} style={{ width: '100%', height: 'auto', display: 'block' }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="leetcode-q-container">
                      <ReactMarkdown remarkPlugins={[remarkBreaks]}>{q.question_text}</ReactMarkdown>
                    </div>
                  </div>
                </div>

                {/* Right: Editor + Console */}
                <div style={{ display: 'flex', flexDirection: 'column', background: '#1e1e1e', overflow: 'hidden' }}>
                  {/* Editor Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 16px', background: '#252526', borderBottom: '1px solid #3c3c3c', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                      </div>
                      <div style={{ height: 20, width: 1, background: '#3c3c3c', margin: '0 4px' }} />
                      {/* Language selector */}
                      <select
                        style={{ background: 'transparent', color: '#ccc', border: '1px solid transparent', padding: '2px 8px', borderRadius: 4, fontSize: '0.75rem', outline: 'none', cursor: 'pointer' }}
                        value={codingState?.language || 'python'}
                        onChange={e => {
                          const nextLang = e.target.value;
                          const currentLang = codingState?.language || 'python';
                          // Save whatever the user has written in the current language
                          // before switching, so it can be restored if they come back.
                          const currentCode = editorRef.current?.getValue() ?? codingState?.code ?? '';
                          setAnswers(a => {
                            const prev = a[q.id] || {};
                            // Per-language code cache: { python: '...', java: '...', cpp: '...' }
                            const codeCache = { ...(prev.codeCache || {}), [currentLang]: currentCode };
                            // Restore cached code for the target language if the user
                            // has already written something there; otherwise blank editor
                            // (Python falls back to the DB starter if nothing cached yet)
                            const nextCode = codeCache[nextLang] !== undefined
                              ? codeCache[nextLang]
                              : nextLang === 'python' ? (q.starter_code || '') : '';
                            return {
                              ...a,
                              [q.id]: { ...prev, language: nextLang, code: nextCode, codeCache },
                            };
                          });
                        }}
                      >
                        <option value="python">Python 3</option>
                        <option value="javascript">JavaScript</option>
                        <option value="java">Java</option>
                        <option value="cpp">C++</option>
                      </select>
                    </div>

                    {/* Run Code button */}
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ padding: '4px 12px', fontSize: '0.75rem', gap: 6 }}
                      onClick={async () => {
                        if (runningCode) return;
                        // ── Key fix: read code DIRECTLY from Monaco, not from React state ──
                        const selectedLanguage = answers[q.id]?.language || codingState?.language || q.programming_language || 'python';
                        const codeStr = editorRef.current?.getValue() || answers[q.id]?.code || starterForLanguage(selectedLanguage, q.starter_code) || '';
                        if (!codeStr.trim()) { toast.error('Please write some code first'); return; }

                        const lang = selectedLanguage;
                        const testCases = q.test_cases || [];
                        if (!Array.isArray(testCases) || testCases.length === 0) {
                          toast.error('No test cases are configured for this question. Please contact the assessment owner.', { duration: 5000 });
                          return;
                        }

                        try {
                          setRunningCode(true);
                          toast.loading(lang === 'cpp' ? 'Compiling C++ and running test cases…' : 'Running test cases…', { id: 'run-code' });
                          const res = await verifyApi.runCode({ language: lang, code: codeStr, test_cases: testCases });

                          const structuredResults = Array.isArray(res.data?.data?.test_results) ? res.data.data.test_results : [];
                          const rawStdout = res.data?.data?.run?.stdout || '';
                          const rawStderr = res.data?.data?.run?.stderr || '';

                          // ── Only update results — NEVER overwrite the code field ──
                          setAnswers(a => {
                            const prev = a[q.id] || {};
                            return {
                              ...a,
                              [q.id]: {
                                ...prev,
                                // Preserve whatever Monaco currently has
                                code: editorRef.current?.getValue() ?? prev.code ?? codeStr,
                                results: structuredResults,
                                raw_stdout: rawStdout,
                                raw_stderr: rawStderr,
                                last_run_at: new Date().toISOString(),
                              },
                            };
                          });

                          setConsoleTab('result');
                          setSelectedCase(0);

                          const passed = structuredResults.filter(r => r.passed).length;
                          const total = structuredResults.length;
                          if (total > 0) {
                            toast.success(`${passed}/${total} test cases passed`, { id: 'run-code' });
                          } else {
                            toast.success('Run complete', { id: 'run-code' });
                          }
                        } catch (e) {
                          toast.error(e?.response?.data?.detail || e?.message || 'Execution failed', { id: 'run-code', duration: 5000 });
                        } finally {
                          setRunningCode(false);
                        }
                      }}
                    >
                      {runningCode 
                        ? <><div className="spinner" style={{ width: 10, height: 10, borderWidth: 2 }} /> Running…</>
                        : <><Play size={12} fill="currentColor" /> Run Code</>}
                    </button>
                  </div>

                  {/* ── Monaco Editor (UNCONTROLLED) ─────────────────────────────
                      key={q.id + language} forces a remount only when question or
                      language changes, not on every state update. This prevents the
                      editor from ever resetting while the user is typing/pasting.
                  ──────────────────────────────────────────────────────────────── */}
                  <div style={{ flex: 1, borderBottom: '1px solid #3c3c3c' }}>
                    <Editor
                      key={`editor-${q.id}-${codingState?.language || 'python'}`}
                      height="100%"
                      defaultLanguage={codingState?.language || 'python'}
                      language={codingState?.language || 'python'}
                      defaultValue={codingState?.code || starterForLanguage(codingState?.language || 'python', q.starter_code) || ''}
                      theme="vs-dark"
                      onMount={(editor) => {
                        editorRef.current = editor;
                        // If there's saved code that differs from starter, restore it
                        const saved = answers[q.id]?.code;
                        if (saved && saved !== (q.starter_code || '')) {
                          editor.setValue(saved);
                          // Move cursor to end
                          const lastLine = editor.getModel().getLineCount();
                          editor.setPosition({ lineNumber: lastLine, column: editor.getModel().getLineMaxColumn(lastLine) });
                        }

                        // ── Anti-paste (Block Copy/Paste proctoring feature) ──
                        // Monaco handles paste internally, so the container-level
                        // handler can't reliably block it. Capture the pre-paste
                        // value on the raw paste event, then revert it on paste.
                        if (proctoringConfig.block_paste) {
                          let prePasteValue = editor.getValue();
                          const domNode = editor.getDomNode();
                          const onNativePaste = () => { prePasteValue = editor.getValue(); };
                          domNode?.addEventListener('paste', onNativePaste, true);
                          editor.onDidPaste(() => {
                            editor.setValue(prePasteValue); // undo the pasted content
                            handleCheatAttempt('Pasting text');
                          });
                        }
                      }}
                      onChange={val => {
                        // Sync to state so submission captures it; never revert from here
                        const nextText = val || '';
                        setAnswers(a => {
                          const prev = a[q.id] || {};
                          return {
                            ...a,
                            [q.id]: {
                              language: prev.language || codingState?.language || q.programming_language || 'python',
                              code: nextText,
                              results: prev.results || [],
                              raw_stdout: prev.raw_stdout || '',
                              raw_stderr: prev.raw_stderr || '',
                              last_run_at: prev.last_run_at || null,
                            },
                          };
                        });
                      }}
                      options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                        lineHeight: 1.5,
                        automaticLayout: true,
                        tabSize: 4,
                        wordWrap: 'on',
                        padding: { top: 16 },
                      }}
                    />
                  </div>

                  {/* ── Console Section ──────────────────────────────────────── */}
                  <div style={{ height: 200, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
                    <div style={{ display: 'flex', background: '#252526', borderBottom: '1px solid #3c3c3c' }}>
                      <button onClick={() => setConsoleTab('testcase')} style={{ padding: '8px 20px', fontSize: '0.75rem', border: 'none', background: consoleTab === 'testcase' ? '#1e1e1e' : 'transparent', color: consoleTab === 'testcase' ? 'var(--primary-light)' : '#888', borderBottom: consoleTab === 'testcase' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: 600 }}>Testcase</button>
                      <button onClick={() => setConsoleTab('result')} style={{ padding: '8px 20px', fontSize: '0.75rem', border: 'none', background: consoleTab === 'result' ? '#1e1e1e' : 'transparent', color: consoleTab === 'result' ? 'var(--primary-light)' : '#888', borderBottom: consoleTab === 'result' ? '2px solid var(--primary)' : '2px solid transparent', cursor: 'pointer', fontWeight: 600 }}>Test Result</button>
                    </div>

                    <div style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
                      {consoleTab === 'testcase' ? (
                        <div>
                          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                            {(q.test_cases || []).map((_, i) => (
                              <button key={i} onClick={() => setSelectedCase(i)} style={{ padding: '4px 12px', fontSize: '0.7rem', borderRadius: 4, border: 'none', background: selectedCase === i ? '#3e3e3e' : 'transparent', color: selectedCase === i ? '#fff' : '#888', cursor: 'pointer' }}>Case {i + 1}</button>
                            ))}
                          </div>
                          {q.test_cases?.[selectedCase] && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700 }}>INPUT</div>
                              <div style={{ background: '#2d2d2d', padding: 12, borderRadius: 6, color: '#eee', fontSize: '0.8rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{q.test_cases[selectedCase].input}</div>
                              <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700 }}>EXPECTED OUTPUT</div>
                              <div style={{ background: '#2d2d2d', padding: 12, borderRadius: 6, color: '#eee', fontSize: '0.8rem', fontFamily: 'monospace' }}>{q.test_cases[selectedCase].expected_output || q.test_cases[selectedCase].expected || '—'}</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {answers[q.id]?.results && answers[q.id].results.length > 0 ? (
                            <div>
                              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                                {answers[q.id].results.map((r, i) => (
                                  <button key={i} onClick={() => setSelectedCase(i)} style={{ padding: '4px 12px', fontSize: '0.7rem', borderRadius: 4, border: 'none', background: selectedCase === i ? '#3e3e3e' : 'transparent', color: r.passed ? '#10b981' : '#f43f5e', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: r.passed ? '#10b981' : '#f43f5e' }} />
                                    Case {i + 1}
                                  </button>
                                ))}
                              </div>
                              {answers[q.id].results[selectedCase] && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                  <div style={{ fontSize: '1rem', fontWeight: 700, color: answers[q.id].results[selectedCase].passed ? '#10b981' : '#f43f5e' }}>
                                    {answers[q.id].results[selectedCase].passed ? '✅ Accepted' : '❌ Wrong Answer'}
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700, marginBottom: 4 }}>INPUT</div>
                                      <div style={{ background: '#2d2d2d', padding: 8, borderRadius: 4, color: '#eee', fontSize: '0.75rem', fontFamily: 'monospace' }}>{answers[q.id].results[selectedCase].input}</div>
                                    </div>
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700, marginBottom: 4 }}>EXPECTED</div>
                                      <div style={{ background: '#2d2d2d', padding: 8, borderRadius: 4, color: '#eee', fontSize: '0.75rem', fontFamily: 'monospace' }}>{answers[q.id].results[selectedCase].expected}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700, marginBottom: 4 }}>ACTUAL OUTPUT</div>
                                    <div style={{ background: answers[q.id].results[selectedCase].passed ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', padding: 8, borderRadius: 4, color: '#eee', fontSize: '0.75rem', fontFamily: 'monospace', border: `1px solid ${answers[q.id].results[selectedCase].passed ? '#059669' : '#e11d48'}` }}>
                                      {answers[q.id].results[selectedCase].stdout || '(no output)'}
                                    </div>
                                  </div>
                                  {answers[q.id].results[selectedCase].stderr && (
                                    <div>
                                      <div style={{ fontSize: '0.7rem', color: '#f43f5e', fontWeight: 700, marginBottom: 4 }}>RUNTIME ERROR</div>
                                      <div style={{ background: 'rgba(244,63,94,0.1)', padding: 8, borderRadius: 4, color: '#f43f5e', fontSize: '0.75rem', fontFamily: 'monospace' }}>{answers[q.id].results[selectedCase].stderr}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : answers[q.id]?.raw_stderr ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f43f5e', fontSize: '0.85rem', fontWeight: 600 }}><AlertTriangle size={16} /> Runtime error</div>
                              <pre style={{ background: 'rgba(244,63,94,0.1)', padding: 12, borderRadius: 6, color: '#fda4af', fontSize: '0.75rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', border: '1px solid #e11d48' }}>{answers[q.id].raw_stderr}</pre>
                            </div>
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', flexDirection: 'column', gap: 12 }}>
                              <TerminalSquare size={32} opacity={0.5} />
                              <div style={{ fontSize: '0.85rem' }}>Click "Run Code" to check your implementation against test cases.</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section Locked Banner — shown when candidate tries to leave before time is up */}
        {sectionLockedMsg && currentSection?.time_limit_minutes && sectionTimeLeft > 0 && (
          <SectionLockedBanner
            sectionTitle={currentSection.title}
            sectionTimeLeft={sectionTimeLeft}
            formatTime={formatTime}
            onClose={() => setSectionLockedMsg(false)}
          />
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={() => setCurrentQ(q => q - 1)} disabled={currentQ === 0}><ChevronLeft size={16} /> Previous</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {questions.map((qItem, i) => {
              const isAnswered = !!answers[qItem.id];
              const isCurrent = i === currentQ;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentQ(i)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: `2px solid ${isCurrent ? 'var(--primary)' : isAnswered ? 'var(--success)' : 'var(--border)'}`,
                    background: isCurrent ? 'var(--primary)' : isAnswered ? '#DCFCE7' : 'white',
                    color: isCurrent ? 'white' : isAnswered ? 'var(--success)' : 'var(--text-muted)',
                    fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', transition: 'var(--transition)',
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          {isLastQuestionInSection
            ? (isLastSection
                ? <button className="btn btn-primary" onClick={() => {
                    if (currentSection?.time_limit_minutes && sectionTimeLeft > 0) {
                      setSectionLockedMsg(true);
                      return;
                    }
                    handleSubmit(false);
                  }} disabled={submitting}><Send size={15} /> Submit Assessment</button>
                : <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => {
                    if (currentSection?.time_limit_minutes && sectionTimeLeft > 0) {
                      setSectionLockedMsg(true);
                      return;
                    }
                    setCurrentSectionIndex(i => i + 1);
                    setCurrentQ(0);
                  }}>Next Section <ChevronRight size={16} /></button>
              )
            : <button className="btn btn-primary" onClick={() => setCurrentQ(q => q + 1)}>Next <ChevronRight size={16} /></button>
          }
        </div>
      </div>

      {/* Proctoring PIP Camera */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, width: 220, height: 160, background: '#000', borderRadius: 'var(--radius)', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', zIndex: 100, border: '2px solid rgba(255,255,255,0.1)' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{ position: 'absolute', top: 12, left: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.6)', padding: '4px 10px', borderRadius: 16, fontSize: '0.7rem', color: '#fff', fontWeight: 600, letterSpacing: '0.5px' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444', animation: 'pulse 2s infinite' }} />
          A/V MONITORED
        </div>
        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>
          Session ID: {id}-{assessment?.id}
        </div>
      </div>

      {/* Live proctoring debug HUD — only in testMode so we can verify signals */}
      {isAssessmentTestMode && proctorDebug && (
        <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 1000, background: 'rgba(0,0,0,0.82)', color: '#0f0', fontFamily: 'monospace', fontSize: '0.7rem', padding: '10px 12px', borderRadius: 8, lineHeight: 1.5, border: '1px solid #0f0', maxWidth: 260 }}>
          <div style={{ color: '#fff', fontWeight: 700, marginBottom: 4 }}>PROCTOR DEBUG</div>
          model: {String(proctorDebug.model)}<br />
          faces: {proctorDebug.faces}<br />
          blendshapes present: len={proctorDebug.bsLen} keys={proctorDebug.bsCount}<br />
          eyeLook L:{proctorDebug.L} R:{proctorDebug.R} D:{proctorDebug.D} U:{proctorDebug.U} away:{String(proctorDebug.bsAway)}<br />
          iris avail:{String(proctorDebug.irisAvail)} gx:{proctorDebug.gx} gy:{proctorDebug.gy} away:{String(proctorDebug.irisAway)}<br />
          <span style={{ color: proctorDebug.gazeOff ? '#ff0' : '#0f0' }}>GAZE_OFF: {String(proctorDebug.gazeOff)}</span>
        </div>
      )}
    </div>
  );
}
