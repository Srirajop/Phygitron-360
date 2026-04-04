import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { deployApi, adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft, Briefcase, Award, CheckCircle, AlertTriangle,
  Mail, Calendar, Hash, Edit2, UserCheck, BookOpen, TrendingUp,
  Plus, X, Save, Brain, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const LEVEL_CONFIG = {
  beginner:     { badge: 'badge-muted',    bar: '#9CA3AF', pct: 25 },
  intermediate: { badge: 'badge-info',     bar: '#3B82F6', pct: 50 },
  advanced:     { badge: 'badge-primary',  bar: '#8B5CF6', pct: 75 },
  expert:       { badge: 'badge-success',  bar: '#10B981', pct: 100 },
};
const STATUS_CONFIG = {
  active:     { badge: 'badge-success', label: 'Active',     dot: '#10B981' },
  on_leave:   { badge: 'badge-warning', label: 'On Leave',   dot: '#F59E0B' },
  deployed:   { badge: 'badge-info',    label: 'Deployed',   dot: '#3B82F6' },
  offboarded: { badge: 'badge-muted',   label: 'Offboarded', dot: '#9CA3AF' },
};

function Avatar({ name, size = 72 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--primary), var(--primary-light))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 900, fontSize: size > 50 ? '1.5rem' : '1rem',
      boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
    }}>{initials}</div>
  );
}

function SectionCard({ title, icon, children, action }) {
  return (
    <div className="card animate-fade-in" style={{ marginBottom: 20 }}>
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--primary-lightest)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)',
          }}>{icon}</div>
          <h4 style={{ margin: 0 }}>{title}</h4>
        </div>
        {action}
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [skills, setSkills] = useState([]);
  const [allSkills, setAllSkills] = useState([]);
  const [addingSkill, setAddingSkill] = useState(false);
  const [newSkill, setNewSkill] = useState({ skill_id: '', level: 'beginner', verified_by: 'self_reported' });

  const canEdit = ['hr', 'admin'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deployApi.getEmployee(id);
      const d = res.data.data;
      setData(d);
      setSkills(d.skills || []);
      setEditForm({
        emp_id: d.emp_id || '',
        department: d.department || '',
        status: d.status || 'active',
        join_date: d.join_date || '',
      });
    } catch {
      toast.error('Failed to load employee');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    // Load skills taxonomy for add-skill dropdown
    adminApi.listSkills('').then(r => setAllSkills(r.data.data || [])).catch(() => {});
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await deployApi.updateEmployee(id, editForm);
      toast.success('Employee updated');
      setEditing(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.skill_id) { toast.error('Select a skill'); return; }
    try {
      await deployApi.addSkill(id, { ...newSkill, skill_id: parseInt(newSkill.skill_id) });
      toast.success('Skill added');
      setAddingSkill(false);
      setNewSkill({ skill_id: '', level: 'beginner', verified_by: 'self_reported' });
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to add skill');
    }
  };

  const handleRemoveSkill = async (skillId) => {
    if (!confirm('Remove this skill?')) return;
    try {
      await deployApi.removeSkill(id, skillId);
      toast.success('Skill removed');
      setSkills(prev => prev.filter(s => s.skill_id !== skillId));
    } catch {
      toast.error('Failed to remove skill');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <div className="spinner spinner-lg" />
    </div>
  );
  if (!data) return <div className="page-body"><p>Employee not found.</p></div>;

  const statusCfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.active;

  return (
    <div>
      {/* Profile Header */}
      <div style={{ padding: '24px 32px 0' }}>
        <Link to="/deploy" className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }}>
          <ArrowLeft size={15} /> Back to Employee Database
        </Link>

        <div className="card animate-fade-in" style={{ marginBottom: 0, borderRadius: '20px 20px 0 0', overflow: 'visible' }}>
          {/* Banner */}
          <div style={{
            height: 100, borderRadius: '20px 20px 0 0',
            background: 'linear-gradient(135deg, var(--primary) 0%, #9333EA 50%, #EC4899 100%)',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0, opacity: 0.07,
              backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }} />
          </div>

          <div className="card-body" style={{ paddingTop: 0, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: -36, marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                <div style={{ border: '4px solid white', borderRadius: '50%', boxShadow: 'var(--shadow)' }}>
                  <Avatar name={data.user?.full_name} size={72} />
                </div>
                <div style={{ paddingBottom: 4 }}>
                  <h2 style={{ marginBottom: 4 }}>{data.user?.full_name || 'Unknown'}</h2>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {data.user?.email && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{data.user.email}</span>}
                    {data.emp_id && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Hash size={12} />{data.emp_id}</span>}
                    {data.department && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Briefcase size={12} />{data.department}</span>}
                    {data.join_date && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />Joined {new Date(data.join_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusCfg.dot }} />
                  <span className={`badge ${statusCfg.badge}`}>{statusCfg.label}</span>
                </div>
                {data.capability_index != null && (
                  <div style={{ textAlign: 'center', background: 'var(--primary-lightest)', borderRadius: 12, padding: '8px 16px' }}>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{data.capability_index?.toFixed(0)}%</div>
                    <div style={{ fontSize: '0.62rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Capability</div>
                  </div>
                )}
                {canEdit && (
                  <button className={`btn ${editing ? 'btn-success' : 'btn-secondary'} btn-sm`}
                    onClick={() => editing ? handleSave() : setEditing(true)}
                    disabled={saving}
                  >
                    {saving ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      : editing ? <><Save size={13} /> Save</> : <><Edit2 size={13} /> Edit</>}
                  </button>
                )}
                {editing && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                )}
              </div>
            </div>

            {/* Edit form (inline) */}
            {editing && (
              <div className="animate-fade-in" style={{
                background: 'var(--primary-lightest)', borderRadius: 12, padding: 20,
                border: '1px solid var(--primary-lighter)', marginBottom: 8
              }}>
                <h4 style={{ marginBottom: 16 }}>Edit Employee Record</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Employee ID</label>
                    <input className="form-control" value={editForm.emp_id} onChange={e => setEditForm(f => ({ ...f, emp_id: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Department</label>
                    <input className="form-control" value={editForm.department} onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Status</label>
                    <select className="form-control" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Join Date</label>
                    <input type="date" className="form-control" value={editForm.join_date} onChange={e => setEditForm(f => ({ ...f, join_date: e.target.value }))} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          {/* Left column */}
          <div>
            {/* Skills */}
            <SectionCard
              title="Skills Matrix"
              icon={<Brain size={15} />}
              action={canEdit && (
                <button className="btn btn-secondary btn-sm" onClick={() => setAddingSkill(!addingSkill)}>
                  <Plus size={13} /> Add Skill
                </button>
              )}
            >
              {addingSkill && (
                <div className="animate-fade-in" style={{ background: 'var(--primary-lightest)', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid var(--primary-lighter)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 10, alignItems: 'center' }}>
                    <select className="form-control" value={newSkill.skill_id} onChange={e => setNewSkill(s => ({ ...s, skill_id: e.target.value }))}>
                      <option value="">Select skill…</option>
                      {allSkills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select className="form-control" value={newSkill.level} onChange={e => setNewSkill(s => ({ ...s, level: e.target.value }))} style={{ width: 130 }}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={handleAddSkill}><Save size={13} /> Add</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setAddingSkill(false)}><X size={13} /></button>
                  </div>
                </div>
              )}

              {skills.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No skills recorded yet</p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12 }}>
                  {skills.map((s, i) => {
                    const cfg = LEVEL_CONFIG[s.level] || LEVEL_CONFIG.beginner;
                    return (
                      <div key={i} style={{
                        padding: '12px 14px', borderRadius: 10, border: '1px solid var(--border)',
                        background: s.decayed ? '#FEF2F2' : 'rgba(255,255,255,0.7)',
                        position: 'relative',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {s.decayed && <AlertTriangle size={12} color="var(--danger)" />}
                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{s.name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className={`badge ${cfg.badge}`} style={{ fontSize: '0.68rem' }}>{s.level}</span>
                            {canEdit && (
                              <button
                                className="btn btn-ghost"
                                style={{ padding: '2px 4px', minWidth: 0 }}
                                onClick={() => handleRemoveSkill(s.skill_id)}
                              ><X size={10} /></button>
                            )}
                          </div>
                        </div>
                        <div style={{ height: 4, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${cfg.pct}%`, background: cfg.bar, borderRadius: 999, transition: 'width 0.8s ease' }} />
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          via {s.verified_by?.replace(/_/g, ' ')}
                          {s.decayed && <span style={{ color: 'var(--danger)', marginLeft: 8, fontWeight: 600 }}>• Decayed</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>

            {/* Deployment History */}
            <SectionCard title="Deployment History" icon={<Briefcase size={15} />}>
              {(data.deployments || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No deployments recorded</p>
              ) : (
                <div>
                  {data.deployments.map((d, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 0', borderBottom: i < data.deployments.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: d.status === 'active' ? 'linear-gradient(135deg, #10B981, #059669)' : '#F3F4F6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: d.status === 'active' ? 'white' : 'var(--text-muted)',
                        }}>
                          <Briefcase size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d.project_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {d.client_name && <span>{d.client_name} · </span>}
                            {d.start_date && new Date(d.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            {d.end_date && ` → ${new Date(d.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`}
                          </div>
                        </div>
                      </div>
                      <span className={`badge badge-${d.status === 'active' ? 'success' : d.status === 'completed' ? 'info' : 'muted'}`}>
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* Learning Progress */}
            {(data.learning || []).length > 0 && (
              <SectionCard title="Learning Progress" icon={<BookOpen size={15} />}>
                {data.learning.map((e, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: i < data.learning.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ flex: 1, paddingRight: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Course #{e.course_id}</span>
                        {e.completed && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>✓ Done</span>}
                      </div>
                      <div className="progress-bar" style={{ height: 5 }}>
                        <div className="progress-fill" style={{ width: `${e.progress_percent}%` }} />
                      </div>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem' }}>{e.progress_percent?.toFixed(0)}%</span>
                  </div>
                ))}
              </SectionCard>
            )}
          </div>

          {/* Right column */}
          <div>
            {/* Certificates */}
            <SectionCard title="Certificates" icon={<Award size={15} />}>
              {(data.certificates || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No certificates earned yet</p>
              ) : (
                data.certificates.map((c, i) => (
                  <div key={i} style={{
                    background: 'linear-gradient(135deg, var(--primary-lightest), rgba(168,85,247,0.08))',
                    border: '1px solid var(--primary-lighter)', borderRadius: 10,
                    padding: '12px 14px', marginBottom: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '1.5rem' }}>🏆</span>
                      <div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Certificate</div>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{c.verification_code}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(c.issued_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </SectionCard>

            {/* Assessment History */}
            <SectionCard title="Assessment History" icon={<CheckCircle size={15} />}>
              {(data.assessment_history || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No assessments taken</p>
              ) : (
                data.assessment_history.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 0', borderBottom: i < data.assessment_history.length - 1 ? '1px solid var(--border)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: a.pass_status ? '#DCFCE7' : '#FEE2E2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: a.pass_status ? '#15803D' : '#B91C1C', fontWeight: 900, fontSize: '0.85rem',
                      }}>
                        {a.score?.toFixed(0)}%
                      </div>
                      <div>
                        <span className={`badge badge-${a.pass_status ? 'success' : 'danger'}`}>{a.pass_status ? 'Pass' : 'Fail'}</span>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {a.submitted_at && new Date(a.submitted_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <TrendingUp size={14} color={a.pass_status ? 'var(--success)' : 'var(--danger)'} />
                  </div>
                ))
              )}
            </SectionCard>

            {/* Quick Actions */}
            {canEdit && (
              <div className="card animate-fade-in">
                <div className="card-header"><h4 style={{ margin: 0 }}>Quick Actions</h4></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <Link to="/deploy/analytics" className="btn btn-secondary">
                    <TrendingUp size={14} /> Workforce Analytics
                  </Link>
                  <Link to="/deploy/projects" className="btn btn-secondary">
                    <Briefcase size={14} /> Assign to Project
                  </Link>
                  <Link to="/deploy/skill-map" className="btn btn-secondary">
                    <Brain size={14} /> Org Skill Map
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
