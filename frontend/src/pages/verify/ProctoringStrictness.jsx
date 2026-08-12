import React from 'react';

const LEVELS = [
  { key: 'lenient', label: 'Lenient', color: '#22c55e' },
  { key: 'balanced', label: 'Balanced', color: '#eab308' },
  { key: 'strict', label: 'Strict', color: '#ef4444' },
];

// A single-select "meter" for proctoring strictness. Controlled via `value`
// (one of lenient/balanced/strict) and `onChange`.
export default function ProctoringStrictness({ value, onChange, descriptions }) {
  const idx = LEVELS.findIndex(l => l.key === value);
  const current = LEVELS[idx] || LEVELS[1];

  return (
    <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>Proctoring Strictness</span>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: current.color }}>{current.label}</span>
      </div>
      <div
        role="slider"
        aria-valuemin={0}
        aria-valuemax={2}
        aria-valuenow={idx < 0 ? 1 : idx}
        aria-label="Proctoring strictness"
        style={{ position: 'relative', display: 'flex', gap: 6, alignItems: 'center' }}
      >
        {LEVELS.map((lvl, i) => {
          const selected = (idx < 0 ? 1 : idx) === i;
          return (
            <button
              key={lvl.key}
              type="button"
              onClick={() => onChange(lvl.key)}
              title={lvl.label}
              style={{
                flex: 1,
                height: 10,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: selected ? lvl.color : 'rgba(255,255,255,0.12)',
                transition: 'background 0.15s',
                boxShadow: selected ? `0 0 0 2px ${lvl.color}55` : 'none',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        {LEVELS.map(l => (
          <span key={l.key} style={{ fontSize: '0.65rem', color: l.key === value ? l.color : 'var(--text-muted)' }}>{l.label}</span>
        ))}
      </div>
      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, lineHeight: 1.4 }}>
        {(descriptions && descriptions[value]) || 'Adjust how aggressively proctoring flags violations.'}
      </p>
    </div>
  );
}
