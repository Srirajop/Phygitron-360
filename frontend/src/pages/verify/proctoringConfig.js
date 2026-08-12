// Shared proctoring configuration helpers.
//
// The proctoring engine in AssessmentTaker is driven entirely by the thresholds
// below. HR configures a single `strictness` slider (lenient / balanced / strict)
// plus boolean feature toggles. The strictness level expands into concrete
// detection thresholds (sustain times, sensitivity, strike limits) so the same
// detection code behaves "harder" or "softer" without HR touching raw numbers.

export const STRICTNESS_LEVELS = {
  lenient: {
    label: 'Lenient',
    description: 'Relaxed monitoring. Only clear, sustained violations are flagged. Good for low-stakes practice.',
    max_strikes: 8,
    grace_ms: 12000,
    // CV detection
    face_missing_sustain_ms: 10000,
    multiple_people_sustain_ms: 15000,
    multiple_people_min_samples: 3,
    gaze_averted_sustain_ms: 9000,
    head_turn_sustain_ms: 9000,
    // audio
    voice_sustain_ms: 4500,
    audio_cooldown_ms: 60000,
    // behaviour
    tab_switch_cooldown_ms: 20000,
  },
  balanced: {
    label: 'Balanced',
    description: 'Recommended default. Reasonable sensitivity with anti-false-positive guards.',
    max_strikes: 5,
    grace_ms: 8000,
    face_missing_sustain_ms: 7000,
    multiple_people_sustain_ms: 6000,
    multiple_people_min_samples: 3,
    gaze_averted_sustain_ms: 4000,
    head_turn_sustain_ms: 6000,
    voice_sustain_ms: 3200,
    audio_cooldown_ms: 45000,
    tab_switch_cooldown_ms: 15000,
  },
  strict: {
    label: 'Strict',
    description: 'High-security exam. Any deviation is flagged quickly and strikes accumulate fast.',
    max_strikes: 3,
    grace_ms: 5000,
    face_missing_sustain_ms: 4000,
    multiple_people_sustain_ms: 6000,
    multiple_people_min_samples: 3,
    gaze_averted_sustain_ms: 3500,
    head_turn_sustain_ms: 3500,
    voice_sustain_ms: 2000,
    audio_cooldown_ms: 30000,
    tab_switch_cooldown_ms: 10000,
  },
};

export const PROCTORING_FEATURES = [
  { key: 'full_screen', label: 'Enforce Full Screen' },
  { key: 'tab_switch', label: 'Detect Tab Switching / Window Change' },
  { key: 'multiple_people', label: 'Detect Multiple People in Camera' },
  { key: 'face_not_visible', label: 'Detect Face Not Visible' },
  { key: 'eye_tracking', label: 'Detect Candidate Looking Away from Screen (Gaze)' },
  { key: 'head_turn', label: 'Detect Excessive Head Turning' },
  { key: 'audio_detect', label: 'Detect Speaking / Background Audio' },
];

// Build a complete proctoring config from a strictness level + toggles.
// Pass `current` to preserve earlier thresholds if present (merge-on-resume).
export function buildProctoringConfig(strictness = 'balanced', toggles = {}, current = null) {
  const level = STRICTNESS_LEVELS[strictness] ? strictness : 'balanced';
  const base = STRICTNESS_LEVELS[level];
  const features = {};
  PROCTORING_FEATURES.forEach(f => {
    features[f.key] = toggles[f.key] !== undefined
      ? !!toggles[f.key]
      : (current && current[f.key] !== undefined ? current[f.key] : true);
  });
  return {
    strictness: level,
    full_screen: features.full_screen,
    tab_switch: features.tab_switch,
    multiple_people: features.multiple_people,
    face_not_visible: features.face_not_visible,
    eye_tracking: features.eye_tracking,
    head_turn: features.head_turn,
    audio_detect: features.audio_detect,
    max_strikes: base.max_strikes,
    grace_ms: base.grace_ms,
    face_missing_sustain_ms: base.face_missing_sustain_ms,
    multiple_people_sustain_ms: base.multiple_people_sustain_ms,
    multiple_people_min_samples: base.multiple_people_min_samples,
    gaze_averted_sustain_ms: base.gaze_averted_sustain_ms,
    head_turn_sustain_ms: base.head_turn_sustain_ms,
    voice_sustain_ms: base.voice_sustain_ms,
    audio_cooldown_ms: base.audio_cooldown_ms,
    tab_switch_cooldown_ms: base.tab_switch_cooldown_ms,
  };
}

// Resolve a saved config (may be the old 5-boolean shape) into a full config.
export function normalizeProctoringConfig(saved) {
  if (!saved) return buildProctoringConfig('balanced', {});
  const strictness = saved.strictness && STRICTNESS_LEVELS[saved.strictness] ? saved.strictness : 'balanced';
  return buildProctoringConfig(strictness, saved, saved);
}
