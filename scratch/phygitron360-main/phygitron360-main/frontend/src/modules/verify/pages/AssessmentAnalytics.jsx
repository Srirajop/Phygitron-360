import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Award, ShieldAlert, Clock, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AssessmentAnalytics({ assessmentId }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assessmentId) return;
    setLoading(true);
    fetch(`/api/verify/builder/assessments/${assessmentId}/stats`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setStats(d.data);
        else toast.error('Failed to load analytics');
      })
      .catch(() => toast.error('Error loading analytics'))
      .finally(() => setLoading(false));
  }, [assessmentId]);

  if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="animate-spin text-purple-600" /></div>;
  if (!stats) return <div className="p-10 text-center text-gray-400">No data available</div>;

  const { metrics, performance, top_performers } = stats;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-800">Analytics</h3>
          <p className="text-sm text-gray-500 mt-1">Real-time performance metrics</p>
        </div>
        <button className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors">
          Export CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} className="text-purple-400" />
            <p className="text-xs font-medium text-gray-500">Assigned</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{metrics.total_assigned}</p>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-purple-400" />
            <p className="text-xs font-medium text-gray-500">Submitted</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{metrics.total_submitted}</p>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Award size={16} className="text-emerald-500" />
            <p className="text-xs font-medium text-gray-500">Passed</p>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{metrics.total_passed}</p>
        </div>
        
        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={16} className="text-rose-500" />
            <p className="text-xs font-medium text-gray-500">Flagged</p>
          </div>
          <p className="text-3xl font-bold text-rose-600">{metrics.total_malpractice}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Averages */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Averages</h4>
          <div className="space-y-6">
            <div>
              <p className="text-sm text-gray-500 mb-1">Pass Rate</p>
              <span className="text-3xl font-bold text-gray-800">{performance.pass_rate_pct.toFixed(1)}%</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Average Score</p>
              <span className="text-3xl font-bold text-purple-600">{performance.average_score.toFixed(1)}%</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Average Time</p>
              <div className="flex items-center gap-2">
                <Clock size={20} className="text-gray-400" />
                <span className="text-2xl font-bold text-gray-800">{Math.floor(performance.average_time_taken / 60)}m {Math.floor(performance.average_time_taken % 60)}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
            <BarChart3 size={14} className="text-purple-600" /> Top Performers
          </h4>
          
          {top_performers.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400 italic">No submissions yet</div>
          ) : (
            <div className="space-y-3">
              {top_performers.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      i === 0 ? 'bg-amber-100 text-amber-700' : 
                      i === 1 ? 'bg-gray-200 text-gray-600' : 
                      i === 2 ? 'bg-amber-100 text-amber-600' : 
                      'bg-gray-100 text-gray-400'
                    }`}>
                      #{i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{p.user_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${p.is_malpractice ? 'text-rose-600' : 'text-purple-600'}`}>
                      {Math.round(p.total_score)}%
                    </p>
                    {p.is_malpractice && <p className="text-[10px] font-semibold text-rose-600 uppercase tracking-wider">Flagged</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}