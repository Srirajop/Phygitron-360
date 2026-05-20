import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { verifyApi } from '../../api';
import { Terminal, TerminalSquare, Play, Info, CheckCircle, Upload, ChevronLeft, ChevronRight, Send, AlertTriangle, Clock, Maximize, AlertOctagon, Lock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';

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

// ── Component ─────────────────────────────────────────────────────────────────
export default function AssessmentTaker() {
  const { id } = useParams();
  const nav = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const isAssessmentTestMode = searchParams.get('testMode') === '1' || localStorage.getItem('assessment_test_mode') === 'true';

  const [assessment, setAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQ, setCurrentQ] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fileUploading, setFileUploading] = useState({});
  const [consoleTab, setConsoleTab] = useState('testcase');
  const [selectedCase, setSelectedCase] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);

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
  const speechSustainTimer = useRef(null);
  const audioCtxRef = useRef(null);          // Web Audio API — catches murmurs
  const analyserRef = useRef(null);
  const audioCalibrationRef = useRef({ samples: [], baseline: null });
  const lastFrameRef = useRef(null);
  const audioViolationTimer = useRef(null);
  const cameraViolationTimer = useRef(null);
  const motionViolationTimer = useRef(null);
  const backgroundMovementTimer = useRef(null);
  const cameraTrackViolationTimer = useRef(null);
  const multipleFacesTimerRef = useRef(null);
  const seenFaceOnceRef = useRef(false);
  const strikes = useRef(0);
  const submitRef = useRef(null);
  const handleCheatAttemptRef = useRef(null);
  const lastStrikeTime = useRef(0);
  const violationCooldownsRef = useRef({});
  const faceDetectorRef = useRef(null);
  const MAX_STRIKES = 5;
  const PROCTORING_START_GRACE_MS = 8000;

  // Load assessment
  useEffect(() => {
    verifyApi.getAssessment(id).then(r => {
      setAssessment(r.data.data);
      if (r.data.data.time_limit_minutes) setTimeLeft(r.data.data.time_limit_minutes * 60);
    }).finally(() => setLoading(false));
  }, [id]);

  // Timer
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) { submitRef.current?.(); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

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
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (hasStarted && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [hasStarted]);

  const captureScreenshot = useCallback((label = 'Snapshot') => {
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
    if (now - lastForThisViolation < cooldownMs) return false;   // blocked by cooldown
    if (now - lastStrikeTime.current < 2500) return false;        // too soon after any strike
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
    if (strikes.current >= MAX_STRIKES) {
      toast.error('Assessment terminated due to repeated proctoring violations.', { duration: 6000 });
      submitRef.current?.(true);
    } else {
      toast.error(`Warning: ${actionName}! (Strike ${strikes.current}/${MAX_STRIKES})`, { icon: '⚠️', duration: 4000 });
    }
    return true;  // strike was issued
  }, [captureScreenshot, hasStarted]);

  // ── Proctoring Analysis: Speech (SpeechRecognition) + CV/Face (every 2500ms) ─
  useEffect(() => {
    if (!hasStarted) return;

    // Initialise the native FaceDetector (Chrome 80+, no libraries needed)
    if ('FaceDetector' in window && !faceDetectorRef.current) {
      try { faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 4 }); }
      catch (e) { faceDetectorRef.current = null; }
    }

    // ── LAYER 1: SpeechRecognition — catches clear/loud speech ──────────────
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = '';   // auto-detect any language
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        // Only flag on FINAL confirmed results — not interim guesses.
        // Interim results fire on every partial hypothesis including background
        // noise the ASR is uncertain about; final results require the engine
        // to have committed to a transcription, drastically reducing false positives.
        const last = event.results[event.results.length - 1];
        if (!last.isFinal) return;
        const transcript = (last[0]?.transcript || '').trim();
        // Require at least 2 characters — rules out single-phoneme noise hits
        if (transcript.length < 2) return;
        handleCheatAttemptRef.current?.('Speaking Detected During Assessment', 'audio_detected', 20000);
      };
      recognition.onerror = (e) => {
        if (e.error !== 'no-speech' && e.error !== 'aborted')
          console.warn('SpeechRecognition error:', e.error);
      };
      recognition.onend = () => { try { recognition.start(); } catch (_) {} };
      try { recognition.start(); } catch (_) {}
      speechRecognitionRef.current = recognition;
    }

    // ── LAYER 2: Web Audio voice-frequency analyser — catches murmurs ─────────
    // Human voice lives in 300–3400 Hz. We calibrate a room-noise baseline first,
    // then flag sustained energy above it. This catches whispers and nearby speech
    // that SpeechRecognition won't transcribe.
    const audioInterval = setInterval(() => {
      if (!analyserRef.current) return;
      const fftSize = analyserRef.current.fftSize;
      const sampleRate = audioCtxRef.current?.sampleRate || 44100;
      const binHz = sampleRate / fftSize;
      const voiceLow  = Math.floor(300  / binHz);
      const voiceHigh = Math.floor(3400 / binHz);
      const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(buf);
      const voiceBand = buf.slice(voiceLow, voiceHigh + 1);
      const voiceAvg  = voiceBand.reduce((a, b) => a + b, 0) / voiceBand.length;
      const activeBins = voiceBand.filter(v => v > 28).length;
      const voiceRatio = activeBins / voiceBand.length; // spread across frequencies
      const timeBuf = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(timeBuf);
      let rmsSum = 0;
      for (const sample of timeBuf) {
        const centered = (sample - 128) / 128;
        rmsSum += centered * centered;
      }
      const rms = Math.sqrt(rmsSum / timeBuf.length);

      const cal = audioCalibrationRef.current;
      // Calibrate for ~15 s (30 samples × 500 ms) — long enough to capture real
      // room ambience including fan, AC, and keyboard baseline noise.
      if (cal.samples.length < 16) {
        cal.samples.push(voiceAvg);
        cal.baseline = cal.samples.reduce((a, b) => a + b, 0) / cal.samples.length;
        return;
      }
      const baseline = cal.baseline || 0;
      // Conservative thresholds to avoid false positives from ambient noise:
      //   +35 above baseline  (was +20) — requires a clear spike above room noise
      //   voiceRatio > 0.40   (was 0.25) — voice has wide harmonic spread; noise is narrow
      const energeticVoice = voiceAvg > Math.max(baseline + 24, 30) && voiceRatio > 0.26;
      const loudMicActivity = voiceAvg > Math.max(baseline + 18, 24) && rms > 0.085;
      const isVoiceLike = energeticVoice || loudMicActivity;
      if (isVoiceLike) {
        if (!audioViolationTimer.current) audioViolationTimer.current = Date.now();
        // Sustained for 2.5 s to catch obvious speaking or singing without
        // punishing a single cough or tap.
        if (Date.now() - audioViolationTimer.current > 2500) {
          const fired = handleCheatAttemptRef.current?.('Voice / Murmur Detected Near Microphone', 'audio_detected', 12000);
          if (fired) audioViolationTimer.current = null;
        }
      } else {
        audioViolationTimer.current = null;
        // Slowly drift baseline to adapt to room ambience
        cal.baseline = baseline * 0.98 + voiceAvg * 0.02;
      }
    }, 500);

    // ── CV / FACE: check every 2500 ms ────────────────────────────────────────
    const cvInterval = setInterval(async () => {
      const vid = videoRef.current;
      const videoTrack = streamRef.current?.getVideoTracks?.()[0];
      const trackDead = !videoTrack || videoTrack.readyState !== 'live' || videoTrack.muted || !videoTrack.enabled;

      if (trackDead) {
        if (!cameraTrackViolationTimer.current) cameraTrackViolationTimer.current = Date.now();
        if (Date.now() - cameraTrackViolationTimer.current > 3000) {
          handleCheatAttempt('Camera Disabled or Unavailable', 'camera_disabled');
          cameraTrackViolationTimer.current = null;
        }
        return;
      }
      cameraTrackViolationTimer.current = null;
      if (!vid || vid.readyState < 2 || vid.videoWidth === 0) return;

      // ── Native FaceDetector (preferred) ──────────────────────────────────────
      if (faceDetectorRef.current && vid.readyState >= 2) {
        try {
          const faces = await faceDetectorRef.current.detect(vid);

          const frameArea = (vid.videoWidth || 1) * (vid.videoHeight || 1);
          const significantFaces = faces.filter(face => {
            const box = face.boundingBox;
            if (!box) return false;
            const areaRatio = (box.width * box.height) / frameArea;
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;
            const reasonablyCentered = centerX >= vid.videoWidth * 0.08 && centerX <= vid.videoWidth * 0.92 && centerY >= vid.videoHeight * 0.08 && centerY <= vid.videoHeight * 0.92;
            return areaRatio >= 0.015 && reasonablyCentered;
          });
          const hasPrimaryFace = significantFaces.length >= 1;
          const hasMultipleSignificantFaces = significantFaces.length >= 2;

          if (!hasPrimaryFace) {
            multipleFacesTimerRef.current = null;
            // Only strike after we've confirmed a face at least once in this session.
            if (!seenFaceOnceRef.current) {
              motionViolationTimer.current = null;
            } else if (!motionViolationTimer.current) {
              motionViolationTimer.current = Date.now();
            } else if (Date.now() - motionViolationTimer.current > 12000) {
              handleCheatAttempt('Face Not Visible in Camera', 'person_not_visible', 20000);
              captureScreenshot('Face Not Visible');
              motionViolationTimer.current = null;
            }
          } else {
            seenFaceOnceRef.current = true;
            motionViolationTimer.current = null;
            if (hasMultipleSignificantFaces) {
              if (!multipleFacesTimerRef.current) multipleFacesTimerRef.current = Date.now();
              if (Date.now() - multipleFacesTimerRef.current > 4000) {
                handleCheatAttempt(`Multiple Faces Detected (${significantFaces.length})`, 'proctoring_violation', 30000);
                multipleFacesTimerRef.current = null;
              }
            } else {
              multipleFacesTimerRef.current = null;
            }
          }

          // ── Brightness check (camera covered / lid closed) ─────────────────
          if (canvasRef.current && vid.readyState === vid.HAVE_ENOUGH_DATA) {
            const can = canvasRef.current;
            const ctx = can.getContext('2d', { willReadFrequently: true });
            can.width = 80; can.height = 60;
            ctx.drawImage(vid, 0, 0, 80, 60);
            const px = ctx.getImageData(0, 0, 80, 60).data;
            let bright = 0;
            for (let i = 0; i < px.length; i += 4) bright += (px[i] + px[i+1] + px[i+2]) / 3;
            const avgBright = bright / (80 * 60);
            if (avgBright < 8) {
              if (!cameraViolationTimer.current) cameraViolationTimer.current = Date.now();
              if (Date.now() - cameraViolationTimer.current > 4000) {
                handleCheatAttempt('Camera Obstructed / Covered', 'camera_obstructed');
                cameraViolationTimer.current = null;
              }
            } else {
              cameraViolationTimer.current = null;
            }
          }
          return; // FaceDetector handled it
        } catch (_) { /* fall through to heuristics */ }
      }

      // ── Pixel-heuristic fallback (when FaceDetector unavailable) ─────────────
      // Analyzes skin pixels horizontally to create a skin-pixel histogram.
      // Scans ONLY the top 65% of the frame to exclude hands on keyboards.
      // Identifies multiple distinct horizontal peaks (faces) separated by gaps.
      if (vid && canvasRef.current && vid.readyState === vid.HAVE_ENOUGH_DATA) {
        const can = canvasRef.current;
        const ctx = can.getContext('2d', { willReadFrequently: true });
        const W = 160, H = 120;
        can.width = W; can.height = H;
        ctx.drawImage(vid, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        let brightness = 0;
        const skinHistogram = new Array(W).fill(0);
        let totalSkinPixels = 0;
        let centerSkinPixels = 0;

        // Top 65% of frame to capture faces, ignoring lower area (hands/keyboard)
        const faceZoneH = Math.floor(H * 0.65);
        const centerStartX = Math.floor(W * 0.25);
        const centerEndX = Math.floor(W * 0.75);
        const centerWidth = centerEndX - centerStartX;

        for (let i = 0; i < data.length; i += 4) {
          const px = i / 4, x = px % W, y = Math.floor(px / W);
          const r = data[i], g = data[i+1], b = data[i+2];
          brightness += (r + g + b) / 3;

          if (y > faceZoneH) continue;

          // Skin color heuristic
          const isSkin = r > 60 && g > 30 && b > 15 && r > g * 1.05 && r > b * 1.1 && (r - g) > 8;
          if (isSkin) {
            skinHistogram[x]++;
            totalSkinPixels++;
            if (x >= centerStartX && x < centerEndX) centerSkinPixels++;
          }
        }

        const avgBright = brightness / (W * H);
        const overallRatio = totalSkinPixels / (W * faceZoneH);
        const centerRatio = centerSkinPixels / (centerWidth * faceZoneH);

        // ── Brightness checks ─────────────────
        if (avgBright < 8) {
          if (!cameraViolationTimer.current) cameraViolationTimer.current = Date.now();
          if (Date.now() - cameraViolationTimer.current > 4000) {
            handleCheatAttempt('Camera Obstructed / Covered', 'camera_obstructed');
            cameraViolationTimer.current = null;
          }
        } else { cameraViolationTimer.current = null; }

        // ── Face presence check ─────────────────

        // ── Peak detection for multiple people ──
        // Smooth the histogram slightly
        const smoothed = [...skinHistogram];
        for (let x = 1; x < W - 1; x++) {
          smoothed[x] = (skinHistogram[x - 1] + skinHistogram[x] + skinHistogram[x + 1]) / 3;
        }

        // Find peaks (areas of significant skin presence)
        const peaks = [];
        let inPeak = false;
        let currentPeakStart = 0;
        let peakMaxVal = 0;
        // Minimum pixels in a column to be considered part of a skin peak
        const threshold = faceZoneH * 0.15; 

        for (let x = 0; x < W; x++) {
          if (smoothed[x] > threshold) {
            if (!inPeak) {
              inPeak = true;
              currentPeakStart = x;
              peakMaxVal = smoothed[x];
            } else {
              if (smoothed[x] > peakMaxVal) peakMaxVal = smoothed[x];
            }
          } else {
            if (inPeak) {
              inPeak = false;
              // Filter out extremely narrow noise peaks (less than 10px wide)
              if (x - currentPeakStart > 10) {
                peaks.push({ start: currentPeakStart, end: x, max: peakMaxVal });
              }
            }
          }
        }
        if (inPeak && (W - currentPeakStart > 10)) {
          peaks.push({ start: currentPeakStart, end: W, max: peakMaxVal });
        }

        const centralFacePeak = peaks.find(p => {
          const width = p.end - p.start;
          const centerX = (p.start + p.end) / 2;
          return width >= 18 && width <= 110 && centerX >= W * 0.2 && centerX <= W * 0.8;
        });
        const likelyFacePresent = avgBright > 12 && peaks.length <= 1 && overallRatio > 0.018 && centerRatio > 0.012 && !!centralFacePeak;
        const stronglyMissingFace = avgBright > 14 && peaks.length === 0 && overallRatio < 0.004 && centerRatio < 0.002;

        if (likelyFacePresent) {
          seenFaceOnceRef.current = true;
          motionViolationTimer.current = null;
        } else {
          const longEnoughSinceStart = sessionStartedAtRef.current && (Date.now() - sessionStartedAtRef.current > 20000);
          const canStrikeForMissingFace = seenFaceOnceRef.current || longEnoughSinceStart;
          if (canStrikeForMissingFace && stronglyMissingFace) {
            if (!motionViolationTimer.current) motionViolationTimer.current = Date.now();
            if (Date.now() - motionViolationTimer.current > 15000) {
              handleCheatAttempt('Person Not Visible in Camera', 'person_not_visible', 30000);
              captureScreenshot('Person Not Visible');
              motionViolationTimer.current = null;
            }
          } else {
            motionViolationTimer.current = null;
          }
        }

        // If we see multiple distinct wide peaks separated by gaps, it's multiple faces
        const strongPeaks = peaks.filter(p => {
          const width = p.end - p.start;
          const centerX = (p.start + p.end) / 2;
          return width >= 14 && width <= 90 && centerX >= W * 0.05 && centerX <= W * 0.95;
        });
        if (strongPeaks.length >= 2 && avgBright > 10 && overallRatio > 0.02) {
          if (!backgroundMovementTimer.current) backgroundMovementTimer.current = Date.now();
          // Still require sustained evidence, but not so long that a real second
          // person in frame is missed during testing.
          if (Date.now() - backgroundMovementTimer.current > 5000) {
            const fired = handleCheatAttempt('Multiple People Detected in Camera', 'proctoring_violation', 30000);
            if (fired) backgroundMovementTimer.current = null;
          }
        } else {
          backgroundMovementTimer.current = null;
        }
      }
    }, 2500);

    return () => {
      clearInterval(audioInterval);
      clearInterval(cvInterval);
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onend = null;
        try { speechRecognitionRef.current.abort(); } catch (_) {}
        speechRecognitionRef.current = null;
      }
      audioViolationTimer.current = null;
    };
  }, [hasStarted, handleCheatAttempt, captureScreenshot]);

  useEffect(() => {
    const handler = () => {
      if (!hasStarted || submittingRef.current) return;
      if (document.hidden) handleCheatAttempt('Tab Switching');
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [hasStarted, handleCheatAttempt]);

  useEffect(() => {
    const onFSChange = () => {
      const isFS = !!document.fullscreenElement;
      setIsFullscreen(isFS);
      if (!hasStarted || submittingRef.current) return;
      if (!isFS) handleCheatAttempt('Exiting Fullscreen');
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

  const requestFS = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen()
        .then(() => {
          const now = Date.now();
          sessionStartedAtRef.current = now;
          if (!startTime.current) startTime.current = now;
          setIsFullscreen(true);
          setHasStarted(true);
        })
        .catch(() => toast.error('Fullscreen blocked. Please click again.'));
    }
  };

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
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'linear-gradient(135deg, #020108 0%, #1E1B4B 50%, #020108 100%)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div className="animate-scale-in" style={{ maxWidth: 520 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #7C3AED, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 28px', boxShadow: '0 0 40px rgba(124,58,237,0.3)' }}>
            <Maximize size={36} color="#fff" />
          </div>
          <h2 style={{ fontSize: '2.2rem', marginBottom: 12, color: '#fff', fontWeight: 800 }}>{assessment.title}</h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 8, fontSize: '1rem', lineHeight: 1.6 }}>
            This is a <strong style={{ color: '#A855F7' }}>proctored assessment</strong>. The following conditions apply:
          </p>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 20, marginTop: 16, marginBottom: 28, textAlign: 'left' }}>
            <div style={{ display: 'grid', gap: 12, fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>🖥️</span> Fullscreen mode is mandatory throughout</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>📹</span> Webcam and 🎤 Microphone will be monitored</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>🚫</span> Tab switching and background movement are restricted</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>⚠️</span> {MAX_STRIKES} violations = automatic termination</div>
              {assessment.time_limit_minutes && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>⏱️</span> Time limit: <strong>{assessment.time_limit_minutes} minutes</strong></div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span>📝</span> {(assessment.questions || []).length} questions</div>
            </div>
          </div>
          <button className="btn btn-primary btn-lg btn-block" onClick={requestFS} style={{ padding: '16px 32px', fontSize: '1.1rem', fontWeight: 700 }}>
            <Maximize size={20} /> Enter Fullscreen &amp; Start Assessment
          </button>
          <p style={{ marginTop: 20, color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem' }}>By starting, you agree to the proctoring terms above.</p>
        </div>
      </div>
    );
  }

  const questions = assessment.questions || [];
  const q = questions[currentQ];

  // Parse test cases from string if needed
  if (q && q.question_type === 'coding' && typeof q.test_cases === 'string') {
    try { q.test_cases = JSON.parse(q.test_cases); } catch (e) { q.test_cases = []; }
  }
  // Smart-extract test cases from problem text if none in DB
  if (q && q.question_type === 'coding' && (!q.test_cases || q.test_cases.length === 0)) {
    q.test_cases = smartExtractTestCases(q.question_text || '');
  }

  const codingState = q?.question_type === 'coding' ? getCodingAnswerState(answers[q.id], q) : null;
  const answered = Object.keys(answers).length;
  const isLast = currentQ === questions.length - 1;
  const timerClass = timeLeft === null ? '' : timeLeft < 60 ? 'danger' : timeLeft < 300 ? 'warning' : '';
  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div
      style={{ minHeight: '100vh', background: 'var(--bg-page)', position: 'relative' }}
      onCopy={isAssessmentTestMode ? undefined : (e => { if (isMonacoEvent(e)) return; e.preventDefault(); handleCheatAttempt('Copying text'); })}
      onPaste={isAssessmentTestMode ? undefined : (e => { if (isMonacoEvent(e)) return; e.preventDefault(); handleCheatAttempt('Pasting text'); })}
      onCut={isAssessmentTestMode ? undefined : (e => { if (isMonacoEvent(e)) return; e.preventDefault(); handleCheatAttempt('Cutting text'); })}
      onContextMenu={isAssessmentTestMode ? undefined : (e => { if (isMonacoEvent(e)) return; e.preventDefault(); handleCheatAttempt('Right Click'); })}
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
          {timeLeft !== null && <div className={`timer ${timerClass}`}><Clock size={16} /> {formatTime(timeLeft)}</div>}
        </div>
        <button className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={submitting}><Send size={15} /> {submitting ? 'Submitting…' : 'Submit'}</button>
      </div>

      <div style={{ maxWidth: q?.question_type === 'coding' ? 1400 : 860, width: '100%', margin: '0 auto', padding: q?.question_type === 'coding' ? '24px' : '32px 24px', transition: 'max-width 0.3s ease' }}>
        {/* Progress bar */}
        <div className="progress-bar" style={{ marginBottom: 24 }}>
          <div className="progress-fill" style={{ width: `${(answered / questions.length) * 100}%` }} />
        </div>

        {/* ── Question Card ─────────────────────────────────────────────────── */}
        {q && (
          <div className="question-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span className="badge badge-primary">Question {currentQ + 1} of {questions.length}</span>
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

            {/* File Upload */}
            {q.question_type === 'file_upload' && (
              <div className="form-group">
                <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: 32, textAlign: 'center', background: 'var(--bg-page)', position: 'relative' }}>
                  <input type="file" id={`file-upload-${q.id}`} style={{ display: 'none' }} disabled={fileUploading[q.id]}
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const tId = q.id;
                      setFileUploading(prev => ({ ...prev, [tId]: true }));
                      try {
                        toast.loading(`Uploading ${file.name}...`, { id: `up-${tId}` });
                        const res = await verifyApi.uploadSubmissionFile(file);
                        setAnswers(a => ({ ...a, [tId]: res.data.data.file_url }));
                        toast.success('File uploaded!', { id: `up-${tId}` });
                      } catch (err) {
                        toast.error(err.response?.data?.detail || 'Upload failed', { id: `up-${tId}` });
                      } finally {
                        setFileUploading(prev => ({ ...prev, [tId]: false }));
                      }
                    }}
                  />
                  {fileUploading[q.id] ? (
                    <div style={{ padding: 16 }}><div className="spinner" style={{ margin: '0 auto 16px' }} /><div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Uploading...</div></div>
                  ) : (
                    <>
                      <label htmlFor={`file-upload-${q.id}`} className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                        <Upload size={16} style={{ marginRight: 8 }} /> {answers[q.id] ? 'Change File' : 'Choose File to Upload'}
                      </label>
                      {answers[q.id] && (
                        <div style={{ marginTop: 16, border: '1px solid var(--success-light)', background: 'var(--success-lightest)', padding: '12px 20px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                          <CheckCircle size={18} color="var(--success)" />
                          <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)' }}>File attached</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {answers[q.id].split('/').pop().split('_').slice(1).join('_') || 'Submission Uploaded'}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>Accepted formats: PDF, DOCX, ZIP, JPG, PNG (Max 5MB)</p>
                </div>
              </div>
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
                          toast.loading('Running test cases...', { id: 'run-code' });
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
                        }
                      }}
                    >
                      <Play size={12} fill="currentColor" /> Run Code
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

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
          <button className="btn btn-secondary" onClick={() => setCurrentQ(q => q - 1)} disabled={currentQ === 0}><ChevronLeft size={16} /> Previous</button>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {questions.map((qItem, i) => (
              <button key={i} onClick={() => setCurrentQ(i)} style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${i === currentQ ? 'var(--primary)' : answers[qItem.id] ? 'var(--success)' : 'var(--border)'}`, background: i === currentQ ? 'var(--primary)' : answers[qItem.id] ? '#DCFCE7' : 'white', color: i === currentQ ? 'white' : answers[qItem.id] ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', transition: 'var(--transition)' }}>
                {i + 1}
              </button>
            ))}
          </div>
          {isLast
            ? <button className="btn btn-primary" onClick={() => handleSubmit(false)} disabled={submitting}><Send size={15} /> Submit</button>
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
    </div>
  );
}
