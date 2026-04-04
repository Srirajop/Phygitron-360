import React, { useEffect, useState } from 'react';
import { journeyApi } from '../api';
import { Calendar, ChevronRight, Layers, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssignJourneyModal({ isOpen, onClose, userIds, userName }) {
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJourneyId, setSelectedJourneyId] = useState('');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    if (isOpen) {
      journeyApi.listJourneys().then(r => {
        setJourneys(r.data.data || []);
      }).finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleAssign = async () => {
    if (!selectedJourneyId) return toast.error('Please select a journey');

    try {
      await journeyApi.assignJourney(selectedJourneyId, {
        user_ids: userIds,
        deadline: deadline || null
      });
      toast.success('Journey assigned successfully!');
      onClose();
    } catch {
      toast.error('Failed to assign journey');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
             <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-lightest)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
             </div>
             <div>
                <h4 style={{ margin: 0 }}>Assign Journey</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                   {userIds.length === 1 ? `Assign path for ${userName}` : `Assign path for ${userIds.length} candidates`}
                </p>
             </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Select Learning Path</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {journeys.length === 0 && !loading ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-page)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>No journeys available</p>
                  <a href="/admin/journeys" style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>Create your first journey</a>
                </div>
              ) : (
                journeys.map(j => (
                  <div 
                    key={j.id} 
                    onClick={() => setSelectedJourneyId(j.id)}
                    style={{ 
                      padding: '16px', 
                      borderRadius: '12px', 
                      border: `2px solid ${selectedJourneyId === j.id ? 'var(--primary)' : 'var(--border)'}`,
                      background: selectedJourneyId === j.id ? 'var(--primary-lightest)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedJourneyId === j.id ? 'var(--primary)' : 'var(--text-primary)' }}>{j.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{j.steps_count} Steps in sequence</div>
                    </div>
                    {selectedJourneyId === j.id && <div style={{ color: 'var(--primary)', fontWeight: 800 }}>SELECTED</div>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Completion Deadline (Optional)</label>
            <div style={{ position: 'relative' }}>
               <Calendar size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
               <input 
                 type="date" 
                 className="form-control" 
                 style={{ paddingLeft: '40px' }} 
                 value={deadline}
                 onChange={e => setDeadline(e.target.value)}
               />
            </div>
          </div>
        </div>

        <div className="modal-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
          <button className="btn btn-ghost" onClick={onClose}>Discard</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAssign} disabled={!selectedJourneyId}>
             Confirm Assignment <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
