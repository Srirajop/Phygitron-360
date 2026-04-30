import React, { useEffect, useState } from 'react';
import { deployApi } from '../../api';
import { Users, Briefcase, Brain, TrendingUp, Award, BookOpen, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

function HorizontalBar({ label, value, max, color = 'var(--primary)' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <div style={{ width: 120, fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 20, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 999, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8,
        }}>
          {pct > 20 && <span style={{ color: 'white', fontSize: '0.68rem', fontWeight: 700 }}>{value}</span>}
        </div>
        {pct <= 20 && <span style={{ position: 'absolute', left: `${pct}%`, paddingLeft: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>}
      </div>
    </div>
  );
}

function DonutChart({ data, size = 140 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div style={{ width: size, height: size, borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>No data</div>;

  let angle = 0;
  const slices = data.map(item => {
    const slice = { ...item, startAngle: angle, sweep: (item.value / total) * 360 };
    angle += slice.sweep;
    return slice;
  });

  const r = size / 2;
  const inner = r * 0.55;
  const polarToXY = (cx, cy, r, deg) => ({
    x: cx + r * Math.cos(deg * Math.PI / 180 - Math.PI / 2),
    y: cy + r * Math.sin(deg * Math.PI / 180 - Math.PI / 2),
  });

  return (
    <svg width={size} height={size}>
      {slices.map((slice, i) => {
        if (slice.sweep < 0.5) return null;
        const start = polarToXY(r, r, r - 4, slice.startAngle);
        const end = polarToXY(r, r, r - 4, slice.startAngle + slice.sweep);
        const startI = polarToXY(r, r, inner, slice.startAngle + slice.sweep);
        const endI = polarToXY(r, r, inner, slice.startAngle);
        const large = slice.sweep > 180 ? 1 : 0;
        const path = `M ${start.x} ${start.y} A ${r - 4} ${r - 4} 0 ${large} 1 ${end.x} ${end.y} L ${startI.x} ${startI.y} A ${inner} ${inner} 0 ${large} 0 ${endI.x} ${endI.y} Z`;
        return <path key={i} d={path} fill={slice.color} opacity={0.9} />;
      })}
      <text x={r} y={r - 6} textAnchor="middle" style={{ fontSize: '1.4rem', fontWeight: 900, fill: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}>{total}</text>
      <text x={r} y={r + 14} textAnchor="middle" style={{ fontSize: '0.55rem', fill: 'var(--text-muted)', fontFamily: 'Inter, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Employees</text>
    </svg>
  );
}

export default function WorkforceAnalytics() {
  const [summary, setSummary] = useState(null);
  const [detailed, setDetailed] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([deployApi.analytics(), deployApi.analyticsDetailed()])
      .then(([s, d]) => {
        setSummary(s.data.data || {});
        setDetailed(d.data.data || {});
      })
      .catch(() => toast.error('Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div>
      <div className="page-header"><h1>Workforce Analytics</h1></div>
      <div className="page-body"><div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div></div>
    </div>
  );

  const statusColors = { 
    active: '#10B981', 
    on_leave: '#F59E0B', 
    deployed: '#3B82F6', 
    notice_period: '#FCD34D',
    exited: '#F43F5E',
    offboarded: '#9CA3AF' 
  };
  const statusData = Object.entries(detailed?.status_distribution || {}).map(([k, v]) => ({
    label: k.replace(/_/g, ' '), value: v, color: statusColors[k] || '#9CA3AF',
  }));

  const depts = detailed?.department_distribution || [];
  const maxDept = Math.max(...depts.map(d => d.count), 1);

  const topSkills = detailed?.top_skills || [];
  const maxSkill = Math.max(...topSkills.map(s => s.count), 1);

  const learning = detailed?.learning || {};

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <h1>Workforce Analytics</h1>
        <p>Real-time insights into your organisation's talent, skills, and learning performance</p>
      </div>

      <div className="page-body">
        {/* Top Stats */}
        <div className="stats-grid animate-fade-in" style={{ marginBottom: 32 }}>
          {[
            { label: 'Total Employees', value: summary?.total_employees || 0, icon: <Users size={18} /> },
            { label: 'Active Deployments', value: summary?.active_deployments || 0, icon: <Briefcase size={18} /> },
            { label: 'Avg Capability Index', value: summary?.avg_capability_index ? `${summary.avg_capability_index}%` : '—', icon: <Brain size={18} /> },
            { label: 'Total Enrollments', value: learning.total_enrollments || 0, icon: <BookOpen size={18} /> },
            { label: 'Completions', value: learning.total_completions || 0, icon: <Shield size={18} /> },
            { label: 'Certificates Issued', value: learning.total_certificates || 0, icon: <Award size={18} /> },
            { label: 'Completion Rate', value: learning.completion_rate ? `${learning.completion_rate}%` : '0%', icon: <TrendingUp size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${Math.min(i+1,5)}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          {/* Employee Status Donut */}
          <div className="card animate-fade-in">
            <div className="card-header"><h4 style={{ margin: 0 }}>Employee Status Distribution</h4></div>
            <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              <DonutChart data={statusData} size={140} />
              <div style={{ flex: 1 }}>
                {statusData.map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{item.label}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.value}</span>
                  </div>
                ))}
                {statusData.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No data yet</p>}
              </div>
            </div>
          </div>

          {/* Learning Summary */}
          <div className="card animate-fade-in stagger-2">
            <div className="card-header"><h4 style={{ margin: 0 }}>Learning Overview</h4></div>
            <div className="card-body">
              {[
                { label: 'Have enrolled', value: learning.total_enrollments, max: learning.total_employees, color: '#3B82F6' },
                { label: 'Completions', value: learning.total_completions, max: learning.total_enrollments || 1, color: '#10B981' },
                { label: 'Certificates', value: learning.total_certificates, max: learning.total_completions || 1, color: '#F59E0B' },
              ].map((item, i) => (
                <div key={i} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.value || 0}</span>
                  </div>
                  <div style={{ height: 10, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${item.max > 0 ? Math.min(((item.value || 0) / item.max) * 100, 100) : 0}%`,
                      background: item.color, borderRadius: 999, transition: 'width 1s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
                    {item.max > 0 ? `${Math.round(((item.value || 0) / item.max) * 100)}%` : '0%'} rate
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Top Departments */}
          <div className="card animate-fade-in stagger-3">
            <div className="card-header"><h4 style={{ margin: 0 }}>Top Departments by Headcount</h4></div>
            <div className="card-body">
              {depts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No department data</p>
              ) : depts.map((dept, i) => (
                <HorizontalBar
                  key={i}
                  label={dept.department}
                  value={dept.count}
                  max={maxDept}
                  color={['#7C3AED','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#0891B2'][i % 7]}
                />
              ))}
            </div>
          </div>

          {/* Top Skills */}
          <div className="card animate-fade-in stagger-4">
            <div className="card-header"><h4 style={{ margin: 0 }}>Most Common Skills</h4></div>
            <div className="card-body">
              {topSkills.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No skill data yet</p>
              ) : topSkills.map((skill, i) => (
                <HorizontalBar
                  key={i}
                  label={skill.skill}
                  value={skill.count}
                  max={maxSkill}
                  color={['#7C3AED','#EC4899','#0891B2','#10B981','#F59E0B','#EF4444','#9333EA'][i % 7]}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
          {/* Attendance Alert */}
          <div className="card animate-fade-in stagger-5">
            <div className="card-header"><h4 style={{ margin: 0 }}>Attendance Compliance</h4></div>
            <div className="card-body">
               <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                     <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--success)' }}>{summary?.attendance_today?.present || 0}</div>
                     <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>PRESENT</div>
                  </div>
                  <div style={{ height: 40, width: 1, background: 'var(--border)' }} />
                  <div style={{ textAlign: 'center' }}>
                     <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--danger)' }}>{summary?.attendance_today?.absent || 0}</div>
                     <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>ABSENT</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Organization compliance today</div>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--primary)', marginTop: 8 }}>View Daily Ledger</button>
                  </div>
               </div>
            </div>
          </div>

          {/* Performance Summary */}
          <div className="card animate-fade-in stagger-6">
            <div className="card-header"><h4 style={{ margin: 0 }}>Performance (KRA) Overview</h4></div>
            <div className="card-body">
               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Average KRA Score</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900 }}>{summary?.avg_kra_score?.toFixed(1) || '0.0'} / 10</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reviews Finalized</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900 }}>{summary?.finalized_assessments || 0}</div>
                  </div>
               </div>
               <div className="progress-bar" style={{ height: 10 }}>
                  <div className="progress-fill" style={{ width: `${(summary?.avg_kra_score || 0) * 10}%` }} />
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
