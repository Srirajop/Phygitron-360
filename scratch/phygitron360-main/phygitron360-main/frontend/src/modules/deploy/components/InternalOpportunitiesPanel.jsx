import React, { useState, useEffect } from 'react';
import { Briefcase, Clock, CheckCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function InternalOpportunitiesPanel({ user }) {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/source/candidates/my-applications', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch internal applications');
      const data = await res.json();
      setApplications(data || []);
    } catch (e) {
      toast.error(e.message || 'Could not load your opportunities');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 animate-pulse">
        <div className="w-10 h-10 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7C3AED]">Loading Opportunities</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-[#faf8ff] border border-[#ebe4ff] rounded-[2rem] p-8 md:p-10 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-black tracking-tight leading-none mb-2">My Opportunities</h2>
          <p className="text-sm font-bold text-black/50">Track your internal job applications and pipeline status.</p>
        </div>
        <button
          onClick={fetchApplications}
          className="bg-white border border-[#ebe4ff] p-3 rounded-xl shadow-sm hover:shadow-md transition-all text-[#7C3AED]"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {applications.length === 0 ? (
          <div className="col-span-full bg-white border border-[#ebe4ff] rounded-[2rem] p-12 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-[#f3f0ff] flex items-center justify-center text-[#7C3AED] mb-4">
              <Briefcase size={24} />
            </div>
            <h3 className="text-lg font-black mb-2 text-black">No Active Applications</h3>
            <p className="text-xs font-bold text-black/50 max-w-sm">
              You haven't applied for any internal roles yet. Internal mobility opportunities will appear here when you apply.
            </p>
          </div>
        ) : (
          applications.map((app) => (
            <div key={app.id} className="bg-white border border-[#ebe4ff] rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-[#7C3AED]/5 to-transparent rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                  <h3 className="text-xl font-black text-black leading-tight mb-1">{app.job_title || 'Internal Role'}</h3>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#7C3AED]">
                    Applied {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#f5f0ff] flex items-center justify-center text-[#7C3AED]">
                  <Briefcase size={18} />
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#faf8ff] border border-[#f5f0ff]">
                  <div className="flex items-center gap-2">
                    <Clock size={14} className="text-amber-500" />
                    <span className="text-xs font-bold text-black/60">Profile Status</span>
                  </div>
                  <span className="text-xs font-black text-black">{app.status || 'New'}</span>
                </div>

                {app.invite_status && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-emerald-500" />
                      <span className="text-xs font-bold text-emerald-800">Pipeline</span>
                    </div>
                    <span className="text-xs font-black text-emerald-600 uppercase">{app.invite_status}</span>
                  </div>
                )}
              </div>

              {app.invite_status && (
                <div className="mt-6 pt-6 border-t border-[#ebe4ff] relative z-10">
                  <button 
                    onClick={() => window.open('/login', '_blank')}
                    className="w-full py-3 rounded-xl bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-black/80 transition-colors"
                  >
                    Go To Assessments <ExternalLink size={14} />
                  </button>
                  <p className="text-[9px] font-bold text-center text-black/40 mt-2 uppercase tracking-wider">
                    Check your email for direct links
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
