import React, { useEffect, useState } from 'react';
import { journeyApi } from '../../api';
import { 
  CheckCircle2, 
  Circle, 
  ChevronRight, 
  BookOpen, 
  ShieldCheck, 
  Clock, 
  TrendingUp, 
  Activity,
  Milestone
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function UserJourney() {
  const [journeys, setJourneys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJourney, setSelectedJourney] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await journeyApi.myJourneys();
      const data = res.data.data || [];
      setJourneys(data);
      if (data.length > 0 && !selectedJourney) {
        // Load full details for the first journey
        const fullRes = await journeyApi.getJourney(data[0].journey_id);
        setSelectedJourney({ ...data[0], ...fullRes.data.data });
      }
    } catch {
      toast.error('Failed to load journeys');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectJourney = async (j) => {
    setLoading(true);
    try {
      const fullRes = await journeyApi.getJourney(j.journey_id);
      setSelectedJourney({ ...j, ...fullRes.data.data });
    } catch {
      toast.error('Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  if (loading && journeys.length === 0) return <div className="page-loader"><div className="spinner" /></div>;

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>My Learning Journeys</h1>
          <p>Track your professional growth and evaluation paths</p>
        </div>
      </div>

      <div className="page-body">
        {journeys.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '80px 40px' }}>
             <Milestone size={64} color="var(--border)" style={{ marginBottom: '24px' }} />
             <h3 style={{ marginBottom: '12px' }}>No Journeys Assigned</h3>
             <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
                Your organization hasn't assigned any structured learning or assessment paths to you yet.
             </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '32px' }}>
            {/* Sidebar: Journey List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Active Assignments</h4>
              {journeys.map(j => (
                <div 
                  key={j.assignment_id} 
                  onClick={() => selectJourney(j)}
                  className={`card ${selectedJourney?.assignment_id === j.assignment_id ? 'active' : ''}`}
                  style={{ 
                    padding: '20px', 
                    cursor: 'pointer', 
                    borderRadius: '16px',
                    border: `1.5px solid ${selectedJourney?.assignment_id === j.assignment_id ? 'var(--primary)' : 'var(--border)'}`,
                    background: selectedJourney?.assignment_id === j.assignment_id ? 'var(--primary-lightest)' : 'var(--bg-card)',
                    transition: 'all 0.2s ease',
                    transform: selectedJourney?.assignment_id === j.assignment_id ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  <div style={{ fontWeight: 800, fontSize: '0.95rem', marginBottom: '12px' }}>{j.title}</div>
                  
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '100px', marginBottom: '8px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${j.progress_percent}%`, background: 'var(--primary)', transition: 'width 1s ease' }} />
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>{j.progress_percent}% Complete</span>
                     <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{j.completed_steps}/{j.total_steps} Steps</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Content: Journey Detail */}
            {selectedJourney && (
              <div className="animate-slide-up">
                <div className="card" style={{ marginBottom: '32px', padding: '32px' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                      <div style={{ flex: 1 }}>
                        <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>{selectedJourney.title}</h2>
                        <p style={{ color: 'var(--text-muted)', maxWidth: '800px' }}>{selectedJourney.description}</p>
                      </div>
                      <div className={`badge ${selectedJourney.status === 'completed' ? 'badge-success' : 'badge-primary'}`} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                         {selectedJourney.status.replace('_', ' ')}
                      </div>
                   </div>

                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                      <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-page)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                         <Activity size={24} color="var(--primary)" />
                         <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{selectedJourney.progress_percent}%</div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>Completion</div>
                         </div>
                      </div>
                      <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-page)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                         <Clock size={24} color="var(--accent)" />
                         <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{selectedJourney.deadline ? new Date(selectedJourney.deadline).toLocaleDateString() : 'No Limit'}</div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>Next Deadline</div>
                         </div>
                      </div>
                      <div style={{ padding: '16px', borderRadius: '14px', background: 'var(--bg-page)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                         <TrendingUp size={24} color="var(--success)" />
                         <div>
                            <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{selectedJourney.completed_steps} / {selectedJourney.total_steps}</div>
                            <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-muted)' }}>Current Progress</div>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="journey-steps-timeline" style={{ position: 'relative', paddingLeft: '48px' }}>
                  <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '20px', width: '2px', background: 'var(--border)', zIndex: 0 }} />
                  
                  {selectedJourney.steps?.map((step, idx) => {
                    const isCompleted = idx < selectedJourney.completed_steps;
                    const isCurrent = idx === selectedJourney.completed_steps;
                    
                    return (
                      <div key={idx} className="animate-fade-in" style={{ position: 'relative', marginBottom: '24px', zIndex: 1 }}>
                         <div style={{ 
                            position: 'absolute', 
                            left: '-38px', 
                            top: '12px', 
                            width: '20px', 
                            height: '20px', 
                            borderRadius: '50%', 
                            background: isCompleted ? 'var(--success)' : (isCurrent ? 'var(--primary)' : 'var(--bg-page)'),
                            border: `2px solid ${isCompleted ? 'var(--success)' : (isCurrent ? 'var(--primary)' : 'var(--border)')}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                         }}>
                            {isCompleted ? <CheckCircle2 size={12} /> : (isCurrent ? <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} /> : null)}
                         </div>

                         <div className={`card ${isCurrent ? 'pulse-border' : ''}`} style={{ 
                            padding: '20px', 
                            borderRadius: '16px', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            borderColor: isCurrent ? 'var(--primary)' : 'var(--border)',
                            opacity: (isCompleted || isCurrent) ? 1 : 0.6
                         }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                               <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--bg-page)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  {step.type === 'verify' ? <ShieldCheck size={24} color="var(--primary)" /> : <BookOpen size={24} color="var(--accent-2)" />}
                               </div>
                               <div>
                                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{step.title}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                                    Step {idx + 1}: {step.type}
                                  </div>
                               </div>
                            </div>

                            <div>
                               {isCompleted ? (
                                 <span className="badge badge-success" style={{ padding: '6px 12px' }}>Completed</span>
                               ) : (
                                 <Link 
                                   to={step.type === 'verify' ? `/verify/assessment/${step.reference_id}` : `/forge/course/${step.reference_id}`}
                                   className={`btn ${isCurrent ? 'btn-primary' : 'btn-disabled btn-ghost'}`}
                                   style={{ borderRadius: '100px', padding: '10px 24px', fontSize: '0.85rem' }}
                                   onClick={e => !isCurrent && e.preventDefault()}
                                 >
                                   {isCurrent ? <>Start Step <ChevronRight size={16} /></> : 'Locked'}
                                 </Link>
                               )}
                            </div>
                         </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
