import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Users, Loader2, Play } from 'lucide-react';
import { useLocation } from 'react-router-dom';

export default function LiveMonitor() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const asmId = params.get('asm_id');
  
  const [events, setEvents] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch initial assigned candidates
  useEffect(() => {
    if (!asmId) return;
    fetch(`/api/verify/assignments/${asmId}/candidates`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) setCandidates(d.data);
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [asmId]);

  // Connect to WebSocket
  useEffect(() => {
    if (!asmId) return;
    
    // Use proper ws/wss protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/verify/live-monitor/${asmId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('Connected to Live Monitor WebSocket');
    };
    
    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);
        setEvents(prev => [event, ...prev].slice(0, 50)); // keep last 50 events
        
        // Update candidate status based on event
        if (event.event_type === 'session_started') {
          setCandidates(prev => prev.map(c => 
            c.user_id === event.user_id ? { ...c, status: 'in_progress', started_at: new Date().toISOString() } : c
          ));
        } else if (event.event_type === 'strike_recorded') {
          setCandidates(prev => prev.map(c => 
            c.user_id === event.user_id ? { 
              ...c, 
              strike_count: event.details.strike_count, 
              status: event.details.terminated_by_proctor ? 'terminated' : c.status 
            } : c
          ));
        }
      } catch(e) { console.error('WebSocket msg error', e); }
    };
    
    ws.onerror = (e) => {
      setError('Live connection error.');
    };
    
    return () => ws.close();
  }, [asmId]);

  if (!asmId) return <div className="p-10 text-center text-gray-500">No Assessment ID provided</div>;
  if (loading) return <div className="p-20 text-center"><Loader2 className="animate-spin text-purple-600 inline" /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="text-rose-500 animate-pulse" /> Live Monitor
          </h2>
          <p className="text-sm text-gray-500 mt-1">Real-time proctoring alerts and candidate status.</p>
        </div>
        {error && <div className="text-xs text-rose-500 font-medium bg-rose-50 px-3 py-1.5 rounded">{error}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Users size={16}/> Candidate Status</h3>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3">Candidate</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Strikes</th>
                  <th className="px-4 py-3">Time Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {candidates.map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-gray-800">{c.candidate_name || c.candidate_email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider ${
                        c.status === 'in_progress' ? 'bg-amber-50 text-amber-600' :
                        c.status === 'terminated' ? 'bg-rose-50 text-rose-600' :
                        c.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.strike_count > 0 ? (
                        <span className="flex items-center gap-1 text-rose-600 font-bold"><AlertTriangle size={14}/> {c.strike_count}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {c.started_at ? new Date(c.started_at).toLocaleTimeString() : '—'}
                    </td>
                  </tr>
                ))}
                {candidates.length === 0 && (
                  <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-400">No candidates assigned.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Activity size={16}/> Live Activity Log</h3>
          <div className="bg-gray-900 rounded-xl border border-gray-800 shadow-sm p-4 h-[500px] overflow-y-auto font-mono text-xs flex flex-col gap-2">
            {events.length === 0 ? (
              <div className="text-gray-600 text-center py-10 italic">Awaiting events...</div>
            ) : (
              events.map((ev, i) => {
                const isStrike = ev.event_type === 'strike_recorded';
                const cName = candidates.find(c => c.user_id === ev.user_id)?.candidate_name || `User ${ev.user_id}`;
                return (
                  <div key={i} className={`p-2 rounded border ${isStrike ? 'bg-rose-950/30 border-rose-900/50 text-rose-400' : 'bg-gray-800/50 border-gray-700/50 text-emerald-400'}`}>
                    <div className="flex justify-between mb-1 opacity-70">
                      <span>{new Date().toLocaleTimeString()}</span>
                      <span>{ev.event_type}</span>
                    </div>
                    <div>
                      {isStrike ? (
                        <span><AlertTriangle size={12} className="inline mr-1"/> {cName} triggered a strike. Total: {ev.details?.strike_count}</span>
                      ) : (
                        <span><Play size={12} className="inline mr-1"/> {cName} started the assessment.</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
