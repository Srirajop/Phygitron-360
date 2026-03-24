import React, { useState } from 'react';
import { deployApi } from '../../api';
import { Target, Search, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectMatching() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', client: '', headcount: 1, start_date: '' });
  const [requirementId, setRequirementId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const createAndMatch = async () => {
    if (!form.title) { toast.error('Project title required'); return; }
    setLoading(true);
    try {
      const res = await deployApi.createProject({ ...form, headcount: parseInt(form.headcount) });
      const reqId = res.data.data.id;
      setRequirementId(reqId);
      const matchRes = await deployApi.matchProject(reqId);
      setMatches(matchRes.data.data || []);
      setStep(2);
    } catch (err) { toast.error('Failed to match'); }
    finally { setLoading(false); }
  };

  const assignSelected = async () => {
    try {
      await deployApi.assign([...selected], requirementId);
      toast.success(`${selected.size} employee(s) assigned!`);
      setStep(3);
    } catch { toast.error('Assignment failed'); }
  };

  const toggle = (id) => setSelected(s => { const ns = new Set(s); ns.has(id) ? ns.delete(id) : ns.add(id); return ns; });

  return (
    <div>
      <div className="page-header"><h1>AI Project Matching</h1><p>Define project requirements and let AI match the right employees</p></div>
      <div className="page-body" style={{ maxWidth: 860 }}>
        {/* Progress steps */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, background: 'var(--primary-lightest)', borderRadius: 'var(--radius-lg)', padding: 4 }}>
          {['Define Project', 'AI Match', 'Assign'].map((s, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 16px', borderRadius: 'var(--radius)', fontWeight: 600, fontSize: '0.85rem', background: step === i+1 ? 'var(--primary)' : 'transparent', color: step === i+1 ? 'white' : step > i+1 ? 'var(--success)' : 'var(--text-muted)', transition: 'var(--transition)' }}>{step > i+1 ? '✅ ' : ''}{s}</div>
          ))}
        </div>

        {step === 1 && (
          <div className="card animate-fade-in">
            <div className="card-header"><h4>Project Requirements</h4></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group"><label className="form-label">Project Title *</label><input className="form-control" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., E-Commerce Platform Build" /></div>
                <div className="form-group"><label className="form-label">Client Name</label><input className="form-control" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Headcount Needed</label><input type="number" className="form-control" min={1} value={form.headcount} onChange={e => setForm(f => ({ ...f, headcount: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-control" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              </div>
              <button className="btn btn-shimmer" onClick={createAndMatch} disabled={loading}>{loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Matching…</> : <><Target size={16} /> Find Best Matches with AI</>}</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>🤖 AI-Ranked Matches</h3>
              {selected.size > 0 && <button className="btn btn-primary" onClick={assignSelected}><UserCheck size={16} /> Assign {selected.size} Employee{selected.size !== 1 ? 's' : ''}</button>}
            </div>
            {matches.map((m, i) => (
              <div key={m.employee_id} className={`candidate-card animate-fade-in stagger-${Math.min(i+1,5)} ${selected.has(m.employee_id) ? 'selected' : ''}`} style={{ marginBottom: 12, cursor: 'pointer' }} onClick={() => toggle(m.employee_id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <input type="checkbox" checked={selected.has(m.employee_id)} readOnly style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>{i+1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{m.name}</div>
                    <div className="chip-list" style={{ marginTop: 6 }}>{(m.skills || []).slice(0, 4).map((s, j) => <span key={j} className="skill-tag">{s.name}</span>)}</div>
                  </div>
                  {m.fit_score != null && <div style={{ fontWeight: 900, fontSize: '1.5rem', color: m.fit_score >= 70 ? 'var(--success)' : 'var(--warning)' }}>{Math.round(m.fit_score)}%</div>}
                </div>
              </div>
            ))}
            {matches.length === 0 && <div className="empty-state"><div className="empty-icon">🔍</div><p>No employees matched. Consider broadening requirements.</p></div>}
          </div>
        )}

        {step === 3 && (
          <div className="card animate-scale-in" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
            <h2 style={{ marginBottom: 8 }}>Project Team Assigned!</h2>
            <p>Employees have been assigned to <strong>{form.title}</strong> and their status updated to <span className="badge badge-info" style={{ fontSize: '0.9rem' }}>Deployed</span></p>
            <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => { setStep(1); setForm({ title: '', client: '', headcount: 1, start_date: '' }); setSelected(new Set()); setMatches([]); }}>Match Another Project</button>
          </div>
        )}
      </div>
    </div>
  );
}
