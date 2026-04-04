import React, { useEffect, useState } from 'react';
import { journeyApi, verifyApi, forgeApi } from '../../api';
import { Plus, Trash2, ChevronRight, BookOpen, ShieldCheck, Layers, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminJourneys() {
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  
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

  useEffect(() => { loadData(); }, []);

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
      await journeyApi.createJourney({
        title,
        description,
        steps: steps.map((s, i) => ({ type: s.type, reference_id: s.reference_id, order_index: i }))
      });
      toast.success('Journey created!');
      setShowCreate(false);
      resetForm();
      loadData();
    } catch {
      toast.error('Failed to create journey');
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setSteps([]);
  };

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1>Journey Management</h1>
          <p>Create structured learning and assessment paths for candidates</p>
        </div>
        {!showCreate && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={18} /> Create New Journey
          </button>
        )}
      </div>

      <div className="page-body">
        {showCreate ? (
          <div className="card" style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3>New Journey Configuration</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}><X size={18} /></button>
            </div>
            
            <div className="form-group">
              <label className="form-label">Journey Title *</label>
              <input 
                className="form-control" 
                placeholder="e.g. Senior Frontend Developer Onboarding" 
                value={title}
                onChange={e => setTitle(e.target.value)}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                className="form-control" 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Explain the purpose of this path..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '32px' }}>
              {/* Selector */}
              <div>
                <h4 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Add Steps</h4>
                
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.85rem' }}>Assessments (Verify)</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    {availableAssessments.map(a => (
                      <div key={a.id} className="list-item" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem' }}>{a.title}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => addStep('verify', a)}><Plus size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, fontSize: '0.85rem' }}>Courses (Forge)</label>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    {availableCourses.map(c => (
                      <div key={c.id} className="list-item" style={{ padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem' }}>{c.title}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => addStep('forge', c)}><Plus size={14} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Steps List */}
              <div style={{ background: 'var(--bg-page)', padding: '20px', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                <h4 style={{ marginBottom: '16px', fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Journey Steps</h4>
                {steps.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: '40px' }}>No steps added yet</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {steps.map((step, idx) => (
                      <div key={idx} style={{ 
                        background: 'var(--bg-card)', 
                        padding: '12px', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px',
                        border: '1px solid var(--border)'
                      }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{step.title}</div>
                          <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--primary)', fontWeight: 700 }}>{step.type}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => removeStep(idx)}><Trash2 size={14} color="var(--danger)" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: '40px', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={!title || steps.length === 0}>
                <Save size={18} /> Save Journey
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
            {journeys.map((j, i) => (
              <div key={j.id} className={`card animate-fade-in stagger-${Math.min(i+1, 5)}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ marginBottom: '8px' }}>{j.title}</h3>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {j.description || 'No description provided.'}
                  </p>
                  
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <Layers size={14} /> <strong>{j.steps_count}</strong> steps
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Created {new Date(j.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
                  <button className="btn btn-ghost btn-sm">Edit Path</button>
                  <button className="btn btn-secondary btn-sm" style={{ gap: '4px' }}>
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
    </div>
  );
}
