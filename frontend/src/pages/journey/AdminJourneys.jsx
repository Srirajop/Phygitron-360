import React, { useEffect, useState } from 'react';
import { journeyApi, verifyApi, forgeApi } from '../../api';
import { Plus, Trash2, ChevronRight, BookOpen, ShieldCheck, Layers, Save, X, Edit2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import AssignJourneyModal from '../../components/AssignJourneyModal';

export default function AdminJourneys() {
  const { user } = useAuth();
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeJourney, setActiveJourney] = useState(null);
  
  // Create Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState([]); // { type, reference_id, title }

  // selection data
  const [availableAssessments, setAvailableAssessments] = useState([]);
  const [availableCourses, setAvailableCourses] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const jRes = await journeyApi.listJourneys();
      setJourneys(jRes.data.data || []);
      
      const aRes = await verifyApi.listAssessments();
      setAvailableAssessments(aRes.data.data || []);
      
      const cRes = await forgeApi.listCourses();
      setAvailableCourses(cRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load journeys');
    } finally {
      setLoading(false);
    }
  };

  const canEdit = ['hr', 'admin'].includes(user?.role);

  useEffect(() => { loadData(); }, []);

  const openAssignModal = (journey) => {
    setActiveJourney(journey);
    setShowAssignModal(true);
  };

  const openEdit = async (journey) => {
    setLoading(true);
    try {
      const res = await journeyApi.getJourney(journey.id);
      const data = res.data.data;
      setTitle(data.title);
      setDescription(data.description || '');
      setSteps(data.steps || []);
      setEditingId(journey.id);
      setShowCreate(true);
    } catch {
      toast.error('Failed to load journey details');
    } finally {
      setLoading(false);
    }
  };

  const addStep = (type, item) => {
    if (steps.find(s => s.type === type && s.reference_id === item.id)) {
      toast.error('Step already added');
      return;
    }
    setSteps([...steps, { type, reference_id: item.id, title: item.title }]);
  };

  const removeStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    if (!title) return toast.error('Title is required');
    if (steps.length === 0) return toast.error('Add at least one step');

    try {
      const payload = {
        title,
        description,
        steps: steps.map((s, i) => ({ type: s.type, reference_id: s.reference_id, order_index: i }))
      };

      if (editingId) {
        await journeyApi.updateJourney(editingId, payload);
        toast.success('Journey updated!');
      } else {
        await journeyApi.createJourney(payload);
        toast.success('Journey created!');
      }
      
      setShowCreate(false);
      resetForm();
      loadData();
    } catch {
      toast.error(editingId ? 'Failed to update journey' : 'Failed to create journey');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSteps([]);
    setEditingId(null);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary-lightest)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.75rem', letterSpacing: '-0.02em' }}>Journey Management</h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>Create structured learning and assessment paths for candidates</p>
          </div>
        </div>
        {!showCreate && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus size={18} /> Create New Journey
          </button>
        )}
      </div>

      <div className="page-body">
        {showCreate ? (
          <div className="card animate-scale-up" style={{ maxWidth: '1000px', margin: '0 auto', padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ 
              padding: '24px 32px', 
              background: 'linear-gradient(135deg, var(--primary) 0%, #9333EA 100%)',
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>{editingId ? 'Update Journey' : 'Build New Journey'}</h3>
                <p style={{ margin: 0, opacity: 0.8, fontSize: '0.9rem' }}>Configure the sequence of assessments and learning materials</p>
              </div>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)} style={{ color: 'white' }}><X size={24} /></button>
            </div>

            <div className="card-body" style={{ padding: '32px' }}>
              {/* Metadata Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', marginBottom: '32px', paddingBottom: '32px', borderBottom: '1px solid var(--border)' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Journey Name</label>
                  <input 
                    className="form-control" 
                    placeholder="e.g. AI Specialist Path" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    style={{ fontSize: '1.1rem', fontWeight: 600 }}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>Purpose & Description</label>
                  <input 
                    className="form-control" 
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Describe what the candidate will achieve..."
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '40px' }}>
                {/* Left: Component Discovery */}
                <div>
                  <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                      <Plus size={18} className="text-gradient" /> Add Components
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Assessments Source */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Available Assessments</label>
                        <div style={{ 
                          maxHeight: '220px', 
                          overflowY: 'auto', 
                          background: 'var(--bg-page)', 
                          borderRadius: '12px', 
                          border: '1px solid var(--border)',
                          padding: '4px'
                        }}>
                          {availableAssessments.map(a => (
                            <div key={a.id} className="list-item" style={{ 
                              padding: '10px 12px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              borderRadius: '8px',
                              margin: '2px 0'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{a.title}</span>
                              </div>
                              <button className="btn btn-ghost btn-sm" onClick={() => addStep('verify', a)} style={{ padding: '4px' }}><Plus size={16} /></button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Courses Source */}
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase' }}>Educational Courses</label>
                        <div style={{ 
                          maxHeight: '220px', 
                          overflowY: 'auto', 
                          background: 'var(--bg-page)', 
                          borderRadius: '12px', 
                          border: '1px solid var(--border)',
                          padding: '4px'
                        }}>
                          {availableCourses.map(c => (
                            <div key={c.id} className="list-item" style={{ 
                              padding: '10px 12px', 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              borderRadius: '8px',
                              margin: '2px 0'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{c.title}</span>
                              </div>
                              <button className="btn btn-ghost btn-sm" onClick={() => addStep('forge', c)} style={{ padding: '4px' }}><Plus size={16} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: The Pipeline Sequence */}
                <div style={{ 
                  background: 'var(--primary-lightest)', 
                  borderRadius: '20px', 
                  padding: '32px',
                  border: '1px solid var(--primary-lighter)',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Layers size={20} className="text-gradient" /> Journey Pipeline
                    </h4>
                    <div className="badge badge-primary">{steps.length} Steps</div>
                  </div>

                  {steps.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', border: '2px dashed var(--primary-lighter)', borderRadius: '16px' }}>
                      <p style={{ color: 'var(--primary)', fontWeight: 600 }}>Your journey is empty.</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Add components from the sidebar to build your track.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {steps.map((step, idx) => (
                        <div key={idx} className="animate-fade-in" style={{ 
                          background: 'white', 
                          padding: '16px 20px', 
                          borderRadius: '14px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '16px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                          border: '1px solid var(--border)',
                          position: 'relative'
                        }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            borderRadius: '10px', 
                            background: step.type === 'verify' ? '#FEE2E2' : '#DBEAFE',
                            color: step.type === 'verify' ? '#EF4444' : '#3B82F6',
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            fontSize: '0.9rem',
                            fontWeight: 800
                          }}>
                            {idx + 1}
                          </div>

                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{step.title}</div>
                            <div style={{ 
                              fontSize: '0.7rem', 
                              textTransform: 'uppercase', 
                              letterSpacing: '0.05em',
                              fontWeight: 800,
                              color: step.type === 'verify' ? '#EF4444' : '#3B82F6',
                              marginTop: '2px'
                            }}>
                              {step.type === 'verify' ? 'Verification Step' : 'Learning Module'}
                            </div>
                          </div>

                          <button className="btn btn-ghost btn-sm" onClick={() => removeStep(idx)}>
                            <Trash2 size={16} color="var(--danger)" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: '40px', display: 'flex', gap: '12px' }}>
                    <button className="btn btn-primary" style={{ flex: 1, height: '48px', fontSize: '1rem' }} onClick={handleCreate} disabled={!title || steps.length === 0}>
                       <Save size={18} /> {editingId ? 'Update Journey' : 'Save Journey'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setShowCreate(false)} style={{ height: '48px' }}>Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {journeys.map((j, i) => (
              <div key={j.id} className={`card animate-fade-in stagger-${Math.min(i+1, 5)}`} style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
                <div style={{ padding: '24px', flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--primary-lightest)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Layers size={24} />
                    </div>
                    {canEdit && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--text-muted)' }} onClick={() => openEdit(j)}><Edit2 size={16} /></button>}
                  </div>
                  
                  <h3 style={{ marginBottom: '8px', fontSize: '1.25rem' }}>{j.title}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px', minHeight: '3em' }}>
                    {j.description || 'No description provided.'}
                  </p>
                  
                  <div style={{ display: 'flex', gap: '20px', alignItems: 'center', padding: '12px 0', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 600 }}>
                      <ShieldCheck size={16} className="text-gradient" /> {j.steps_count} Steps
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <Clock size={16} /> {new Date(j.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                
                <div style={{ 
                  padding: '16px 24px', 
                  background: 'var(--bg-card-alt)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  borderTop: '1px solid var(--border)'
                }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontWeight: 600 }} onClick={() => openEdit(j)}>View Details</button>
                  <button 
                    className="btn btn-primary btn-sm" 
                    style={{ borderRadius: '24px', padding: '8px 20px' }}
                    onClick={() => openAssignModal(j)}
                  >
                    Assign <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}
            
            {journeys.length === 0 && !loading && (
              <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px' }}>
                <Layers size={48} color="var(--border)" style={{ marginBottom: '16px' }} />
                <h3>No Journeys Created</h3>
                <p>Start by creating a structured path for candidate evaluation and learning.</p>
                <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={() => setShowCreate(true)}>Create Journey</button>
              </div>
            )}
          </div>
        )}
      </div>
      
      {showAssignModal && (
        <AssignJourneyModal 
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          journeyId={activeJourney?.id}
        />
      )}
    </div>
  );
}
