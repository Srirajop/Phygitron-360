import React, { useEffect, useState } from 'react';
import { journeyApi, adminApi } from '../api';
import { Calendar, ChevronRight, Layers, X, Search, CheckSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AssignJourneyModal({ isOpen, onClose, userIds: initialUserIds, userName, journeyId: initialJourneyId }) {
  const [journeys, setJourneys] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJourneyId, setSelectedJourneyId] = useState(initialJourneyId || '');
  const [selectedUserIds, setSelectedUserIds] = useState(initialUserIds || []);
  const [deadline, setDeadline] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      const promises = [];
      if (!initialJourneyId) promises.push(journeyApi.listJourneys().then(r => setJourneys(r.data.data || [])));
      if (!initialUserIds || initialUserIds.length === 0) {
        promises.push(adminApi.listUsers({ role: 'candidate' }).then(r => {
           setCandidates((r.data.data || []).filter(u => u.email && !u.email.includes('.local')));
        }));
      }
      
      Promise.all(promises).finally(() => setLoading(false));
    }
  }, [isOpen, initialJourneyId, initialUserIds]);

  const handleAssign = async () => {
    const jId = initialJourneyId || selectedJourneyId;
    const uIds = initialUserIds || selectedUserIds;

    if (!jId) return toast.error('Please select a journey');
    if (!uIds || uIds.length === 0) return toast.error('Please select at least one candidate');

    try {
      await journeyApi.assignJourney(jId, {
        user_ids: uIds,
        deadline: deadline || null
      });
      toast.success('Journey assigned successfully!');
      onClose();
    } catch {
      toast.error('Failed to assign journey');
    }
  };

  const toggleUser = (id) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal animate-scale-up" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
             <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--primary-lightest)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Layers size={18} />
             </div>
             <div>
                <h4 style={{ margin: 0 }}>Assign Learning Path</h4>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                   {initialUserIds?.length === 1 ? `Assign to ${userName}` : initialJourneyId ? 'Assigning specific path' : 'Bulk assignment'}
                </p>
             </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          
          {/* User Selection if not provided */}
          {(!initialUserIds || initialUserIds.length === 0) && (
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Step 1: Select Candidates ({selectedUserIds.length} selected)</label>
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  className="form-control" 
                  style={{ paddingLeft: '38px' }} 
                  placeholder="Search candidates..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '12px' }}>
                {candidates.filter(c => (c.full_name || '').toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase())).map(c => {
                  const initials = (c.full_name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
                  const isSelected = selectedUserIds.includes(c.id);
                  return (
                    <div 
                      key={c.id} 
                      onClick={() => toggleUser(c.id)}
                      style={{ 
                        padding: '12px 16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '14px', 
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        background: isSelected ? 'var(--primary-lightest)' : 'transparent',
                        transition: 'var(--transition)'
                      }}
                    >
                      <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-primary)' }}>{c.full_name || 'Candidate'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.email}</div>
                      </div>
                      <div style={{ width: '20px', height: '20px', borderRadius: '6px', border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, background: isSelected ? 'var(--primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                        {isSelected && <CheckSquare size={14} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Journey Selection if not provided */}
          {!initialJourneyId && (
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">{initialUserIds ? 'Select Learning Path' : 'Step 2: Select Learning Path'}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {journeys.length === 0 && !loading ? (
                  <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-page)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No journeys available</p>
                  </div>
                ) : (
                  journeys.map(j => (
                    <div 
                      key={j.id} 
                      onClick={() => setSelectedJourneyId(j.id)}
                      style={{ 
                        padding: '12px 16px', 
                        borderRadius: '10px', 
                        border: `2px solid ${selectedJourneyId === j.id ? 'var(--primary)' : 'var(--border)'}`,
                        background: selectedJourneyId === j.id ? 'var(--primary-lightest)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{j.title}</div>
                      {selectedJourneyId === j.id && <CheckSquare size={16} color="var(--primary)" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Completion Deadline (Optional)</label>
            <div className="form-date-group">
               <Calendar size={18} className="calendar-icon" />
               <input 
                 type="date" 
                 className="form-control" 
                 value={deadline}
                 onChange={e => setDeadline(e.target.value)}
                 style={{ paddingRight: '40px' }}
               />
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Click the icon or field to open calendar. You can also type YYYY-MM-DD.</p>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAssign} disabled={loading}>
             Confirm Assignment <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
