import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import {
  Save, Eye, Mic, User, Users, MonitorOff, ScreenShare,
  RotateCcw, Activity, CheckCircle,
  AlertTriangle, SlidersHorizontal, ClipboardX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  STRICTNESS_LEVELS, NOT_APPLICABLE_STRICTNESS, PROCTORING_FEATURES,
} from './proctoringConfig';

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Config                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

const LEVELS = ['lenient', 'balanced', 'strict'];

const LEVEL_CFG = {
  lenient:  {
    label: 'Lenient', emoji: '🟢', color: '#22c55e',
    bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.30)',
    desc: 'Relaxed — only obvious, sustained violations are flagged. Good for low-stakes or practice tests.',
  },
  balanced: {
    label: 'Balanced', emoji: '🔵', color: '#6366f1',
    bg: 'rgba(99,102,241,0.10)', border: 'rgba(99,102,241,0.30)',
    desc: 'Recommended — reasonable monitoring with protection against false positives. Ideal for most assessments.',
  },
  strict: {
    label: 'Strict', emoji: '🔴', color: '#ef4444',
    bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.30)',
    desc: 'High-security — any deviation is flagged quickly. Use for high-stakes or certification exams.',
  },
};

const RULE_ICONS = {
  full_screen: ScreenShare, tab_switch: MonitorOff,
  multiple_people: Users, face_not_visible: User,
  eye_tracking: Eye, head_turn: Activity, audio_detect: Mic,
  block_paste: ClipboardX,
};

const RULE_DESC = {
  full_screen:      'Candidate must stay in full-screen mode. Exiting triggers an instant violation.',
  tab_switch:       'Switching browser tabs or windows triggers an instant violation.',
  multiple_people:  'A second face appearing on camera triggers a violation after the timer below.',
  face_not_visible: 'If the candidate face disappears from the camera, a violation is issued after the timer below.',
  eye_tracking:     'Looking away from the screen triggers a violation after the timer below.',
  head_turn:        'Turning the head away from the screen triggers a violation after the timer below.',
  audio_detect:     'Speaking or sustained background audio triggers a violation after the timer below.',
  block_paste:      'Stops candidates from pasting text into written and coding answers — prevents pre-copied answers from the web. Pasting triggers a violation.',
};

const RULE_PARAMS = {
  face_not_visible: [
    { key: 'face_missing_sustain_ms', label: 'Flag after face is missing for', min: 1, max: 20, step: 0.5, ms: true },
  ],
  multiple_people: [
    { key: 'multiple_people_sustain_ms', label: 'Flag after second face is visible for', min: 1, max: 20, step: 0.5, ms: true },
  ],
  eye_tracking: [
    { key: 'gaze_averted_sustain_ms', label: 'Flag after candidate looks away for', min: 0.5, max: 12, step: 0.5, ms: true },
  ],
  head_turn: [
    { key: 'head_turn_sustain_ms', label: 'Flag after head is turned for', min: 0.5, max: 12, step: 0.5, ms: true },
  ],
  audio_detect: [
    { key: 'voice_sustain_ms',  label: 'Flag after voice is detected for', min: 0.5, max: 8,   step: 0.5, ms: true },
    { key: 'audio_cooldown_ms', label: 'Wait before flagging audio again', min: 5,   max: 120, step: 5,   ms: true },
  ],
};

const GENERAL_PARAMS = [
  { key: 'max_strikes',           label: 'Max violations before test is auto-submitted',         min: 1, max: 20, step: 1, ms: false },
  { key: 'grace_ms',              label: 'Monitoring starts this many seconds after test begins', min: 0, max: 30, step: 1, ms: true  },
  { key: 'tab_switch_cooldown_ms', label: 'Tab switch — wait before it can flag again',           min: 5, max: 60, step: 5, ms: true  },
];

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                     */
/* ─────────────────────────────────────────────────────────────────────────── */

const toDisp  = (val, ms) => ms ? +(val / 1000).toFixed(1) : val;
const toStore = (val, ms) => ms ? Math.round(val * 1000)   : val;

function Toggle({ checked, onChange }) {
  return (
    <div
      role="switch" aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 99, flexShrink: 0, cursor: 'pointer',
        background: checked ? '#6366f1' : 'rgba(150,150,170,0.25)',
        position: 'relative', transition: 'background .2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 4, left: checked ? 22 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left .18s', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }} />
    </div>
  );
}

function SectionHeader({ num, title, subtitle }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)',
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.8rem', fontWeight: 800, flexShrink: 0,
        }}>{num}</div>
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {title}
        </h4>
      </div>
      {subtitle && (
        <p style={{ margin: '6px 0 0 38px', fontSize: '0.83rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, ms, onChange }) {
  const disp = toDisp(value, ms);
  const pct  = Math.max(0, Math.min(100, ((disp - min) / (max - min)) * 100));
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16,
      alignItems: 'center', padding: '11px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>{min}{ms ? 's' : ''}</span>
          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.88rem' }}>
            {disp}{ms ? 's' : ''}
          </span>
          <span>{max}{ms ? 's' : ''}</span>
        </div>
        <input type="range" min={min} max={max} step={step} value={disp}
          onChange={e => onChange(toStore(parseFloat(e.target.value), ms))}
          style={{
            width: '100%', accentColor: 'var(--primary)', cursor: 'pointer', height: 6, borderRadius: 99,
            background: `linear-gradient(to right, var(--primary) ${pct}%, var(--border) ${pct}%)`,
          }}
        />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main page                                                                   */
/* ─────────────────────────────────────────────────────────────────────────── */

export default function ProctoringSettings() {
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [globalLevel, setGlobalLevel] = useState('balanced');
  const [editTab,     setEditTab]     = useState('balanced');
  const [thresholds,  setThresholds]  = useState(() => {
    const out = {};
    LEVELS.forEach(l => { out[l] = { ...STRICTNESS_LEVELS[l] }; });
    return out;
  });
  const [toggles, setToggles] = useState(() => {
    const d = {};
    PROCTORING_FEATURES.forEach(f => { d[f.key] = true; });
    return d;
  });
  // Default max re-opens for new test assignments (0 = unlimited)
  const [limitResumesDefault, setLimitResumesDefault] = useState(false);
  const [maxResumesDefault, setMaxResumesDefault] = useState(0);

  useEffect(() => {
    adminApi.orgSettings().then(r => {
      const pd  = r.data.data?.proctoring_defaults || {};
      const lvl = pd.global_strictness || 'balanced';
      setGlobalLevel(lvl);
      setEditTab(lvl);
      const t = {};
      PROCTORING_FEATURES.forEach(f => {
        t[f.key] = pd.feature_toggles?.[f.key] !== undefined ? pd.feature_toggles[f.key] : true;
      });
      setToggles(t);
      if (pd.limit_resumes_default !== undefined) setLimitResumesDefault(pd.limit_resumes_default);
      if (pd.max_resumes_default !== undefined) setMaxResumesDefault(pd.max_resumes_default);
      if (pd.custom_thresholds) {
        const merged = {};
        LEVELS.forEach(l => {
          merged[l] = { ...STRICTNESS_LEVELS[l], ...(pd.custom_thresholds[l] || {}) };
        });
        setThresholds(merged);
      }
    }).finally(() => setLoading(false));
  }, []);

  const setParam   = (level, key, val) =>
    setThresholds(prev => ({ ...prev, [level]: { ...prev[level], [key]: val } }));
  const resetLevel = (level) => {
    setThresholds(prev => ({ ...prev, [level]: { ...STRICTNESS_LEVELS[level] } }));
    toast.success(`${LEVEL_CFG[level].label} reset to defaults`);
  };
  const isModified = (level) => {
    const def = STRICTNESS_LEVELS[level];
    return Object.keys(thresholds[level] || {}).some(k => thresholds[level][k] !== def[k]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateOrgSettings({
        proctoring_defaults: {
          global_strictness:    globalLevel,
          feature_toggles:      toggles,
          custom_thresholds:    thresholds,
          rule_overrides:       {},
          limit_resumes_default: limitResumesDefault,
          max_resumes_default:  maxResumesDefault,
        },
      });
      toast.success('Proctoring settings saved!');
    } catch { toast.error('Failed to save'); }
    finally  { setSaving(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  );

  const active  = thresholds[editTab] || {};
  const editCfg = LEVEL_CFG[editTab];

  return (
    <div>
      <div className="page-header">
        <h1>Proctoring Settings &#x1F6E1;&#xFE0F;</h1>
        <p>
          Set your organisation default proctoring behaviour.
          These settings are pre-filled whenever an official assigns a test — they can still be changed per test.
        </p>
      </div>

      <div className="page-body" style={{ maxWidth: 860 }}>

        {/* ── Step 1: Default level ──────────────────────────────────────── */}
        <div className="card animate-fade-in">
          <div className="card-body">
            <SectionHeader
              num="1"
              title="Choose your organisation default strictness"
              subtitle="When an official assigns a test, this is the level that is pre-selected. They can still change it for individual tests."
            />
            <div style={{ display: 'flex', gap: 12 }}>
              {LEVELS.map(lvl => {
                const c        = LEVEL_CFG[lvl];
                const isActive = globalLevel === lvl;
                return (
                  <button key={lvl} type="button" onClick={() => setGlobalLevel(lvl)} style={{
                    flex: 1, padding: '18px 12px', borderRadius: 'var(--radius)',
                    border: `2px solid ${isActive ? c.color : 'var(--border)'}`,
                    background: isActive ? c.bg : 'var(--bg-card)',
                    color: isActive ? c.color : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500, cursor: 'pointer',
                    transition: 'all .18s', textAlign: 'center',
                    boxShadow: isActive ? `0 0 0 3px ${c.border}` : 'none',
                  }}>
                    <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{c.emoji}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{c.label}</div>
                    <div style={{ fontSize: '0.74rem', marginTop: 4, lineHeight: 1.4, opacity: 0.8 }}>
                      {c.desc}
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{
              marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '10px 14px', borderRadius: 'var(--radius)',
              background: 'var(--bg-card-alt)', border: '1px solid var(--border)',
              fontSize: '0.8rem', color: 'var(--text-muted)',
            }}>
              <CheckCircle size={14} style={{ color: '#22c55e', flexShrink: 0, marginTop: 1 }} />
              <span>
                Org default is currently{' '}
                <strong style={{ color: LEVEL_CFG[globalLevel].color }}>{LEVEL_CFG[globalLevel].label}</strong>
                {' '}— {LEVEL_CFG[globalLevel].desc}
              </span>
            </div>
          </div>
        </div>

        {/* ── Step 2: Customise thresholds ───────────────────────────────── */}
        <div className="card animate-fade-in stagger-2" style={{ marginTop: 24 }}>
          <div className="card-body">
            <SectionHeader
              num="2"
              title="Set the timer thresholds for each level"
              subtitle="Pick a level tab and set how long a violation must continue before a strike is given. Shorter time = stricter."
            />

            {/* Level tabs */}
            <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
              {LEVELS.map(lvl => {
                const c        = LEVEL_CFG[lvl];
                const isActive = editTab === lvl;
                return (
                  <button key={lvl} type="button" onClick={() => setEditTab(lvl)} style={{
                    flex: 1, padding: '10px 0', border: 'none', background: 'transparent',
                    borderBottom: `3px solid ${isActive ? c.color : 'transparent'}`,
                    color: isActive ? c.color : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500, fontSize: '0.88rem',
                    cursor: 'pointer', transition: 'all .15s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {c.emoji} {c.label}
                    {isModified(lvl) && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#eab308' }} title="Customised" />
                    )}
                    {lvl === globalLevel && (
                      <span style={{
                        fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px',
                        borderRadius: 99, background: c.bg, color: c.color,
                        border: `1px solid ${c.border}`, textTransform: 'uppercase',
                      }}>org default</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab content header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontWeight: 700, color: editCfg.color }}>
                {editCfg.emoji} {editCfg.label} — editing timer thresholds
              </span>
              {isModified(editTab) && (
                <button type="button" onClick={() => resetLevel(editTab)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                  borderRadius: 'var(--radius)', border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontSize: '0.78rem', cursor: 'pointer',
                }}>
                  <RotateCcw size={13} /> Reset to defaults
                </button>
              )}
            </div>

            {/* Per-rule sliders (tunable rules only) */}
            {PROCTORING_FEATURES.filter(f => !NOT_APPLICABLE_STRICTNESS.has(f.key)).map(f => {
              const Icon       = RULE_ICONS[f.key];
              const params     = RULE_PARAMS[f.key] || [];
              const isDisabled = toggles[f.key] === false;
              return (
                <div key={f.key} style={{
                  marginBottom: 16, padding: '14px 16px', borderRadius: 'var(--radius)',
                  border: `1px solid ${isDisabled ? 'var(--border)' : editCfg.border}`,
                  background: isDisabled ? 'transparent' : editCfg.bg,
                  opacity: isDisabled ? 0.4 : 1, transition: 'all .2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: params.length ? 8 : 0 }}>
                    {Icon && <Icon size={15} style={{ color: editCfg.color, flexShrink: 0 }} />}
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {f.label}
                    </span>
                    {isDisabled && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        (turned off in Step 3)
                      </span>
                    )}
                  </div>
                  {params.map(p => (
                    <SliderRow key={p.key} label={p.label} min={p.min} max={p.max} step={p.step} ms={p.ms}
                      value={active[p.key] ?? STRICTNESS_LEVELS[editTab][p.key]}
                      onChange={val => setParam(editTab, p.key, val)}
                    />
                  ))}
                </div>
              );
            })}

            {/* Binary rules notice */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px',
              borderRadius: 'var(--radius)', background: 'var(--bg-card-alt)',
              border: '1px solid var(--border)', marginBottom: 16,
            }}>
              <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                 <strong style={{ color: 'var(--text-primary)' }}>Full Screen</strong>,{' '}
                 <strong style={{ color: 'var(--text-primary)' }}>Tab Switch</strong>{' '}
                 and{' '}
                 <strong style={{ color: 'var(--text-primary)' }}>Block Copy/Paste</strong>{' '}
                 fire instantly when a violation happens — there is no timer to adjust.
                 You can turn them on or off in Step 3 below.
              </div>
            </div>

            {/* General settings */}
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius)',
              border: '1px solid var(--border)', background: 'var(--bg-card-alt)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
                fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.05em', color: 'var(--text-muted)',
              }}>
                <SlidersHorizontal size={13} /> General settings for this level
              </div>
              {GENERAL_PARAMS.map(p => (
                <SliderRow key={p.key} label={p.label} min={p.min} max={p.max} step={p.step} ms={p.ms}
                  value={active[p.key] ?? STRICTNESS_LEVELS[editTab][p.key]}
                  onChange={val => setParam(editTab, p.key, val)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Step 3: Rules on / off ─────────────────────────────────────── */}
        <div className="card animate-fade-in stagger-3" style={{ marginTop: 24 }}>
          <div className="card-body">
            <SectionHeader
              num="3"
              title="Turn rules on or off"
              subtitle="Disabled rules are completely skipped during proctoring, regardless of the strictness level chosen."
            />
            {PROCTORING_FEATURES.map((f, i) => {
              const Icon    = RULE_ICONS[f.key];
              const enabled = toggles[f.key] !== false;
              const isNA    = NOT_APPLICABLE_STRICTNESS.has(f.key);
              return (
                <div key={f.key} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0',
                  borderBottom: i < PROCTORING_FEATURES.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <Toggle checked={enabled} onChange={v => setToggles(t => ({ ...t, [f.key]: v }))} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      {Icon && (
                        <Icon size={15} style={{ color: enabled ? '#6366f1' : 'var(--text-muted)', flexShrink: 0 }} />
                      )}
                      <span style={{
                        fontWeight: 600, fontSize: '0.88rem',
                        color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}>
                        {f.label}
                      </span>
                      {isNA && (
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                          background: 'var(--bg-card-alt)', color: 'var(--text-muted)',
                          border: '1px solid var(--border)',
                        }}>Instant — no timer</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      {RULE_DESC[f.key]}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0, minWidth: 50, textAlign: 'right' }}>
                    {enabled
                      ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', fontWeight: 600, color: '#22c55e' }}>
                          <CheckCircle size={13} /> Active
                        </span>
                      )
                      : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          Off
                        </span>
                      )
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>

                {/* ── Assessment Resume Limit ────────────────────────────────────────────────── */}
        <div className="card animate-fade-in" style={{ marginTop: 24 }}>
          <div className="card-body">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <SectionHeader
                num="4"
                title="Default test resume limit"
                subtitle="Limit how many times a candidate can re-open a test after closing it. Officials can override this per test when assigning."
              />
              <div style={{ marginTop: 4 }}>
                <Toggle checked={limitResumesDefault} onChange={setLimitResumesDefault} />
              </div>
            </div>
            
            {limitResumesDefault && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, background: 'var(--bg-card-alt)', padding: '16px 20px', borderRadius: 12, border: '1px solid var(--border)' }}>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={maxResumesDefault}
                  onChange={e => setMaxResumesDefault(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{
                    width: 90, padding: '8px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', fontSize: '1rem', textAlign: 'center',
                    fontWeight: 700,
                  }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {maxResumesDefault === 0
                      ? '0 re-opens (once closed, candidate cannot return)'
                      : `Up to ${maxResumesDefault} re-open${maxResumesDefault > 1 ? 's' : ''} per candidate`}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    This is the organisation default. Officials can still change it per test in the Assign modal.
                  </div>
                </div>
              </div>
            )}
            
            {!limitResumesDefault && (
               <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '0 0 0 38px' }}>
                 Currently set to <strong style={{color: 'var(--text-primary)'}}>Unlimited</strong>. Candidates can re-open tests as many times as they want as long as the time limit has not expired.
               </div>
            )}
          </div>
        </div>

        {/* ── Save ───────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            These become the defaults when assigning new tests.
          </span>
          <button type="button" className="btn btn-shimmer btn-lg" disabled={saving} onClick={handleSave}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Save size={18} /> {saving ? 'Saving\u2026' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
}
