import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { Settings, Save, Shield, Sliders, Eye, Mic, User, Users, MonitorOff, ScreenShare, ChevronDown, ChevronUp, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { STRICTNESS_LEVELS, NOT_APPLICABLE_STRICTNESS, PROCTORING_FEATURES } from '../verify/proctoringConfig';

// ── Per-rule icons ──────────────────────────────────────────────────────────
const RULE_ICONS = {
  full_screen: ScreenShare,
  tab_switch: MonitorOff,
  multiple_people: Users,
  face_not_visible: User,
  eye_tracking: Eye,
  head_turn: Eye,
  audio_detect: Mic,
};

// ── Strictness colours ──────────────────────────────────────────────────────
const STRICTNESS_COLORS = {
  lenient:  { bg: 'rgba(34,197,94,0.12)',   text: '#22c55e', border: 'rgba(34,197,94,0.35)' },
  balanced: { bg: 'rgba(99,102,241,0.12)',  text: '#6366f1', border: 'rgba(99,102,241,0.35)' },
  strict:   { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', border: 'rgba(239,68,68,0.35)' },
};

function StrictnessPill({ level }) {
  const c = STRICTNESS_COLORS[level] || STRICTNESS_COLORS.balanced;
  return (
    <span style={{ display:'inline-block', padding:'2px 10px', borderRadius:99, fontSize:'0.72rem',
      fontWeight:700, letterSpacing:'.04em', background:c.bg, color:c.text,
      border:`1px solid ${c.border}`, textTransform:'uppercase', marginLeft:8 }}>
      {level}
    </span>
  );
}

// ── Global Strictness Meter ─────────────────────────────────────────────────
function StrictnessMeter({ value, onChange, label, sublabel }) {
  const levels = ['lenient', 'balanced', 'strict'];
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {label && <div style={{ fontWeight:600, marginBottom:2 }}>{label}</div>}
      {sublabel && <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>{sublabel}</div>}
      <div style={{ display:'flex', gap:10 }}>
        {levels.map(lvl => {
          const isActive = value === lvl;
          const c = STRICTNESS_COLORS[lvl];
          return (
            <button key={lvl} type="button" onClick={() => onChange(lvl)}
              style={{
                flex:1, padding:'10px 0', borderRadius:'var(--radius)',
                border:`2px solid ${isActive ? c.text : 'var(--border)'}`,
                background: isActive ? c.bg : 'var(--bg-card)',
                color: isActive ? c.text : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500, fontSize:'0.88rem', cursor:'pointer',
                transition:'all .18s', textTransform:'capitalize',
                boxShadow: isActive ? `0 0 0 3px ${c.border}` : 'none',
              }}>
              {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
            </button>
          );
        })}
      </div>
      {STRICTNESS_LEVELS[value] && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginTop:4, padding:'8px 12px',
          borderRadius:'var(--radius)', background:'var(--bg-card-alt)', fontSize:'0.8rem',
          color:'var(--text-muted)', border:'1px solid var(--border)' }}>
          <Info size={14} style={{ marginTop:1, flexShrink:0 }} />
          <span>{STRICTNESS_LEVELS[value].description}</span>
        </div>
      )}
    </div>
  );
}

// ── Inline toggle switch ────────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{
      width:40, height:22, borderRadius:99, flexShrink:0, cursor:'pointer',
      background: checked ? 'var(--primary)' : 'var(--border)',
      position:'relative', transition:'background .2s',
    }}>
      <div style={{
        position:'absolute', top:3, left: checked ? 20 : 3, width:16, height:16,
        borderRadius:'50%', background:'#fff', transition:'left .2s',
      }} />
    </div>
  );
}

// ── Per-rule row ─────────────────────────────────────────────────────────────
function RuleRow({ feature, globalStrictness, override, onOverrideChange, enabled, onToggle }) {
  const isNA = NOT_APPLICABLE_STRICTNESS.has(feature.key);
  const Icon = RULE_ICONS[feature.key] || Sliders;
  const levels = ['inherit', 'lenient', 'balanced', 'strict'];

  return (
    <div style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 0',
      borderBottom:'1px solid var(--border)' }}>
      {/* Toggle */}
      <Toggle checked={enabled} onChange={onToggle} />

      {/* Icon + label */}
      <div style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0 }}>
        <Icon size={15} style={{ color:'var(--primary)', flexShrink:0 }} />
        <span style={{ fontWeight:500, fontSize:'0.88rem',
          color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {feature.label}
        </span>
      </div>

      {/* Strictness selector or N/A */}
      <div style={{ flexShrink:0 }}>
        {isNA ? (
          <span style={{ display:'inline-flex', alignItems:'center', padding:'4px 12px',
            borderRadius:99, background:'var(--bg-card-alt)', color:'var(--text-muted)',
            fontSize:'0.75rem', fontWeight:600, border:'1px solid var(--border)' }}>
            Not Applicable
          </span>
        ) : (
          <div style={{ display:'flex', gap:5 }}>
            {levels.map(lvl => {
              const isActive = override === lvl;
              const c = lvl === 'inherit'
                ? { bg:'var(--bg-card-alt)', text:'var(--text-muted)', border:'var(--border)' }
                : STRICTNESS_COLORS[lvl];
              const label = lvl === 'inherit' ? `↩ Global` : lvl.charAt(0).toUpperCase() + lvl.slice(1);
              return (
                <button key={lvl} type="button"
                  title={lvl === 'inherit' ? `Use global (${globalStrictness})` : lvl}
                  onClick={() => onOverrideChange(lvl)}
                  disabled={!enabled}
                  style={{
                    padding:'3px 9px', borderRadius:99,
                    border:`1.5px solid ${isActive ? (c.text || c.border) : 'var(--border)'}`,
                    background: isActive ? (c.bg || 'var(--bg-card-alt)') : 'transparent',
                    color: isActive ? (c.text || 'var(--text-primary)') : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 400, fontSize:'0.72rem',
                    cursor: enabled ? 'pointer' : 'not-allowed',
                    opacity: enabled ? 1 : 0.45,
                    transition:'all .15s', whiteSpace:'nowrap',
                  }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function OrgSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [procOpen, setProcOpen] = useState(true);

  const [globalStrictness, setGlobalStrictness] = useState('balanced');
  const [ruleOverrides, setRuleOverrides] = useState({});
  const [featureToggles, setFeatureToggles] = useState(() => {
    const defaults = {};
    PROCTORING_FEATURES.forEach(f => { defaults[f.key] = true; });
    return defaults;
  });

  useEffect(() => {
    adminApi.orgSettings().then(r => {
      const org = r.data.data;
      setData(org);
      const pd = org.proctoring_defaults || {};
      setGlobalStrictness(pd.global_strictness || 'balanced');
      setRuleOverrides(pd.rule_overrides || {});
      const toggles = {};
      PROCTORING_FEATURES.forEach(f => {
        toggles[f.key] = pd.feature_toggles?.[f.key] !== undefined ? pd.feature_toggles[f.key] : true;
      });
      setFeatureToggles(toggles);
    }).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateOrgSettings({
        name: data.name,
        domain: data.domain,
        primary_color: data.primary_color,
        logo_url: data.logo_url,
        proctoring_defaults: {
          global_strictness: globalStrictness,
          rule_overrides: ruleOverrides,
          feature_toggles: featureToggles,
        },
      });
      toast.success('Settings saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ display:'flex', justifyContent:'center', padding:64 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return <div className="page-body">Organisation not found.</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Organisation Settings ⚙️</h1>
        <p>Customise the platform for your company</p>
      </div>
      <div className="page-body" style={{ maxWidth:900 }}>
        <form onSubmit={handleSave}>

          {/* ── General ── */}
          <div className="card animate-fade-in">
            <div className="card-header">
              <h4><Settings size={18} style={{ verticalAlign:'middle' }} /> General Configuration</h4>
            </div>
            <div className="card-body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="form-group">
                  <label className="form-label">Organisation Name</label>
                  <input className="form-control" value={data.name||''} onChange={e=>setData(d=>({...d,name:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Domain</label>
                  <input className="form-control" value={data.domain||''} onChange={e=>setData(d=>({...d,domain:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Color (Hex)</label>
                  <div style={{ display:'flex', gap:8 }}>
                    <input className="form-control" value={data.primary_color||'#7C3AED'} onChange={e=>setData(d=>({...d,primary_color:e.target.value}))} />
                    <div style={{ width:44, height:44, borderRadius:'var(--radius)', background:data.primary_color||'#7C3AED', border:'1px solid var(--border)' }} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Logo URL</label>
                  <input className="form-control" value={data.logo_url||''} onChange={e=>setData(d=>({...d,logo_url:e.target.value}))} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Security ── */}
          <div className="card animate-fade-in stagger-2" style={{ marginTop:24 }}>
            <div className="card-header">
              <h4><Shield size={18} style={{ verticalAlign:'middle' }} /> Security &amp; Governance</h4>
            </div>
            <div className="card-body">
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={!!data.mfa_enabled} onChange={e=>setData(d=>({...d,mfa_enabled:e.target.checked}))} style={{ width:18,height:18,accentColor:'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight:600 }}>Enforce MFA</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Require multi-factor authentication for all users</div>
                  </div>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                  <input type="checkbox" checked={!!data.sso_enabled} onChange={e=>setData(d=>({...d,sso_enabled:e.target.checked}))} style={{ width:18,height:18,accentColor:'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight:600 }}>SSO Integration</div>
                    <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Enable Google/Microsoft OAuth logins</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* ── Proctoring Defaults ── */}
          <div className="card animate-fade-in stagger-3" style={{ marginTop:24 }}>
            <div className="card-header"
              style={{ cursor:'pointer', userSelect:'none', display:'flex', alignItems:'center', justifyContent:'space-between' }}
              onClick={() => setProcOpen(p => !p)}>
              <h4 style={{ margin:0, display:'flex', alignItems:'center' }}>
                <Sliders size={18} style={{ verticalAlign:'middle', marginRight:8 }} />
                Proctoring Defaults
                <StrictnessPill level={globalStrictness} />
              </h4>
              <div style={{ display:'flex', alignItems:'center', gap:8, color:'var(--text-muted)', fontSize:'0.8rem' }}>
                <span>Org-wide defaults for assessments</span>
                {procOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            {procOpen && (
              <div className="card-body">
                {/* Global strictness */}
                <StrictnessMeter
                  value={globalStrictness}
                  onChange={setGlobalStrictness}
                  label="Global Strictness"
                  sublabel="Sets the default detection sensitivity for all proctoring rules. Override per-rule below."
                />

                <div style={{ borderTop:'1px solid var(--border)', margin:'24px 0 12px' }} />

                {/* Per-rule table */}
                <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={{ fontWeight:600 }}>Per-Rule Overrides</div>
                  <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', maxWidth:340, textAlign:'right' }}>
                    "↩ Global" inherits from the meter above. <strong>Not Applicable</strong> rules are binary on/off — no sensitivity tuning.
                  </div>
                </div>

                {PROCTORING_FEATURES.map(f => (
                  <RuleRow key={f.key} feature={f}
                    globalStrictness={globalStrictness}
                    override={ruleOverrides[f.key] || 'inherit'}
                    onOverrideChange={lvl => setRuleOverrides(r => ({ ...r, [f.key]: lvl }))}
                    enabled={featureToggles[f.key] !== false}
                    onToggle={v => setFeatureToggles(t => ({ ...t, [f.key]: v }))}
                  />
                ))}

                <div style={{ marginTop:16, padding:'10px 14px', borderRadius:'var(--radius)',
                  background:'var(--bg-card-alt)', fontSize:'0.79rem', color:'var(--text-muted)',
                  display:'flex', gap:8, border:'1px solid var(--border)' }}>
                  <Info size={14} style={{ marginTop:1, flexShrink:0 }} />
                  <span>
                    These defaults <strong>pre-populate</strong> the Assign Assessment modal. Admins can still adjust them per assessment.
                    <strong> Full Screen</strong> and <strong>Tab Switch</strong> are event-based — they fire instantly and have no sensitivity window.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Save ── */}
          <div style={{ marginTop:32, textAlign:'right' }}>
            <button type="submit" className="btn btn-shimmer btn-lg" disabled={saving}>
              <Save size={18} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
