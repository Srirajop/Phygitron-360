import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deployApi } from '../../api';
import { Target, Search, UserCheck, Briefcase, Calendar, Users, Star, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProjectMatching() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ title: '', client: '', headcount: 1, start_date: '' });
  const [requirementId, setRequirementId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const createAndMatch = async () => {
    if (!form.title.trim()) { toast.error('Project title is required'); return; }
    setLoading(true);
    try {
      const res = await deployApi.createProject({ ...form, headcount: parseInt(form.headcount) });
      const reqId = res.data.data.id;
      setRequirementId(reqId);
      
      const matchRes = await deployApi.matchProject(reqId);
      const matchedData = matchRes.data.data || [];
      setMatches(Array.isArray(matchedData) ? matchedData : []);
      
      // Auto-select top N matches based on headcount
      const hc = parseInt(form.headcount);
      const newSelected = new Set();
      matchedData.slice(0, hc).forEach(m => newSelected.add(m.employee_id));
      setSelected(newSelected);
      
      setStep(2);
      toast.success('AI Matching complete!');
    } catch (err) {
      toast.error('Failed to create project and run matching');
    } finally {
      setLoading(false);
    }
  };

  const assignSelected = async () => {
    if (selected.size === 0) { toast.error('Select at least one employee'); return; }
    setLoading(true);
    try {
      await deployApi.assign([...selected], requirementId);
      toast.success(`${selected.size} employee(s) successfully assigned!`);
      setStep(3);
    } catch {
      toast.error('Assignment failed');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => setSelected(s => { 
    const ns = new Set(s); 
    ns.has(id) ? ns.delete(id) : ns.add(id); 
    return ns; 
  });

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>AI Project Matching</h1>
          <p>Define new project requirements and let AI match you with the best available talent</p>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Progress Steps Indicator */}
        <div style={{ display: 'flex', marginBottom: 32, background: 'var(--primary-lightest)', borderRadius: 12, padding: 6 }}>
          {[
            { id: 1, name: 'Define Project', icon: <Briefcase size={16} /> },
            { id: 2, name: 'AI Talent Match', icon: <Target size={16} /> },
            { id: 3, name: 'Assignment Complete', icon: <UserCheck size={16} /> }
          ].map((s) => {
            const isActive = step === s.id;
            const isCompleted = step > s.id;
            return (
              <div key={s.id} 
                style={{ 
                  flex: 1, textAlign: 'center', padding: '12px 16px', borderRadius: 8, 
                  fontWeight: isActive ? 700 : 600, fontSize: '0.85rem', 
                  background: isActive ? 'var(--primary)' : 'transparent', 
                  color: isActive ? 'white' : isCompleted ? 'var(--primary)' : 'var(--text-muted)', 
                  transition: 'all 0.3s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {isCompleted ? <span style={{ color: 'var(--success)' }}>✓</span> : s.icon}
                <span className="sm-show">{s.name}</span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Definition */}
        {step === 1 && (
          <div className="card animate-fade-in" style={{ borderTop: '4px solid var(--primary)' }}>
            <div className="card-header" style={{ padding: '24px 32px' }}>
              <h3 style={{ margin: 0 }}>Project Requirements</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Enter details to guide the AI matching algorithm</p>
            </div>
            <div className="card-body" style={{ padding: '0 32px 32px 32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Project Title *</label>
                  <input className="form-control form-control-lg" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g., Global E-Commerce Platform Rewrite" autoFocus />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Client Name (Optional)</label>
                  <input className="form-control" value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} placeholder="e.g., Acme Corp" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Headcount Needed</label>
                    <div style={{ position: 'relative' }}>
                      <Users size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input type="number" className="form-control" min={1} max={50} value={form.headcount} onChange={e => setForm(f => ({ ...f, headcount: e.target.value }))} style={{ paddingLeft: 40 }} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Start Date (Optional)</label>
                    <div style={{ position: 'relative' }}>
                      <Calendar size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input type="date" className="form-control" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={{ paddingLeft: 40 }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-footer" style={{ background: 'var(--bg-card)', padding: '16px 32px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-shimmer" onClick={createAndMatch} disabled={loading || !form.title.trim()}>
                {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Target size={15} /> Find the Best Matches</>}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: AI Match Results */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-body" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--primary-lightest)', borderRadius: 12 }}>
                <div>
                  <h4 style={{ margin: 0, color: 'var(--primary)' }}>{form.title}</h4>
                  <div style={{ display: 'flex', gap: 16, marginTop: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {form.client && <span>Client: <strong>{form.client}</strong></span>}
                    <span>Target Headcount: <strong>{form.headcount}</strong></span>
                    <span>Selected: <strong style={{ color: selected.size === parseInt(form.headcount) ? 'var(--success)' : 'var(--primary)' }}>{selected.size}</strong></span>
                  </div>
                </div>
                <button className="btn btn-primary" onClick={assignSelected} disabled={loading || selected.size === 0}>
                  {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><UserCheck size={16} /> Deploy {selected.size} Employee{selected.size !== 1 ? 's' : ''}</>}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>🤖 AI-Ranked Candidates</h3>
              <span className="badge badge-muted">{matches.length} profiles analysed</span>
            </div>

            {matches.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <p>No employees matched the criteria. Consider broadening requirements or wait for more talent data.</p>
                <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setStep(1)}><ArrowLeft size={14} /> Back to Search</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {matches.map((m, i) => (
                  <div 
                    key={m.employee_id} 
                    className={`card animate-fade-in stagger-${Math.min(i+1,5)}`} 
                    style={{ 
                      cursor: 'pointer', 
                      transition: 'all 0.2s', 
                      borderColor: selected.has(m.employee_id) ? 'var(--primary)' : 'var(--border)',
                      boxShadow: selected.has(m.employee_id) ? '0 0 0 1px var(--primary)' : 'var(--shadow-sm)'
                    }} 
                    onClick={() => toggle(m.employee_id)}
                  >
                    <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
                      <input 
                        type="checkbox" 
                        checked={selected.has(m.employee_id)} 
                        readOnly 
                        style={{ accentColor: 'var(--primary)', width: 22, height: 22, cursor: 'pointer' }} 
                        onClick={(e) => e.stopPropagation()} 
                        onChange={() => toggle(m.employee_id)}
                      />
                      
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.2rem', flexShrink: 0 }}>
                        {m.name.substring(0,2).toUpperCase()}
                      </div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                          <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{m.name}</span>
                          <span className={`badge ${i === 0 ? 'badge-warning' : 'badge-muted'}`} style={{ fontSize: '0.65rem' }}>
                            {i === 0 ? '⭐ Top Match' : `Rank #${i+1}`}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(m.skills || []).slice(0, 5).map((s, j) => (
                            <span key={j} className="badge" style={{ background: '#F3F4F6', color: 'var(--text-primary)', fontSize: '0.7rem' }}>{s.name}</span>
                          ))}
                          {(m.skills || []).length > 5 && <span className="badge badge-muted" style={{ fontSize: '0.7rem' }}>+{(m.skills||[]).length - 5}</span>}
                        </div>
                      </div>
                      
                      {m.fit_score != null && (
                        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border)', paddingLeft: 24, marginLeft: 8 }}>
                          <div style={{ fontWeight: 900, fontSize: '1.8rem', color: m.fit_score >= 80 ? 'var(--success)' : m.fit_score >= 60 ? 'var(--warning)' : 'var(--danger)', lineHeight: 1 }}>
                            {Math.round(m.fit_score)}%
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>Fit Score</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="card animate-scale-in" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <div style={{ fontSize: '5rem', marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
              <div style={{ background: '#ECFCCB', width: 120, height: 120, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🎉
              </div>
            </div>
            <h2 style={{ marginBottom: 12 }}>Project Team Deployed!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 400, margin: '0 auto 32px auto' }}>
              <strong>{selected.size}</strong> employees have been securely assigned to <strong>{form.title}</strong>. Their statuses are now <span className="badge badge-info" style={{ fontSize: '0.8rem' }}>Deployed</span> in the database.
            </p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => nav('/deploy')}>
                View Employee Database
              </button>
              <button className="btn btn-primary" onClick={() => { 
                setStep(1); 
                setForm({ title: '', client: '', headcount: 1, start_date: '' }); 
                setSelected(new Set()); 
                setMatches([]); 
              }}>
                Match Another Project <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
