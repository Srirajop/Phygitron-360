import React, { useEffect, useState } from 'react';
import { deployApi } from '../../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import { TrendingUp, Users, Target, Activity } from 'lucide-react';

export default function WorkforceAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    deployApi.analytics().then(r => setData(r.data.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return null;

  const deptData = Object.entries(data.department_skill_avg || {}).map(([name, score]) => ({ name, score }));

  return (
    <div>
      <div className="page-header">
        <h1>Workforce Intelligence 📈</h1>
        <p>Org-wide capability trends, skill health, and deployment metrics</p>
      </div>
      <div className="page-body">
        <div className="stats-grid animate-fade-in">
          {[
            { label: 'Org Capability Index', value: `${data.avg_capability_index?.toFixed(1)}%`, icon: <TrendingUp size={18} /> },
            { label: 'Total Deployments', value: data.total_deployments, icon: <Target size={18} /> },
            { label: 'Utilization Rate', value: `${((data.total_deployments / data.total_employees) * 100).toFixed(0)}%`, icon: <Activity size={18} /> },
            { label: 'Active Projects', value: data.active_projects || 0, icon: <Users size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="card animate-fade-in stagger-2">
            <div className="card-header"><h4>Departmental Capability Heatmap</h4></div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={deptData} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="score" fill="var(--primary)" name="Avg Index" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card animate-fade-in stagger-3">
            <div className="card-header"><h4>Skill Health Alerts</h4></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Stagnant Skills', val: data.stagnant_skills_count || 0, color: 'var(--warning)', desc: 'Skills with no activity in 90 days' },
                  { label: 'High Decay Rate', val: data.high_decay_count || 0, color: 'var(--danger)', desc: 'Employees whose scores dropped >15%' },
                  { label: 'Skill Gaps', val: data.skill_gaps_count || 0, color: 'var(--primary)', desc: 'Required project skills not in inventory' },
                ].map((alert, i) => (
                  <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center', padding: 16, background: 'var(--bg-page)', borderRadius: 'var(--radius)', borderLeft: `4px solid ${alert.color}` }}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 900, color: alert.color, minWidth: 40 }}>{alert.val}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{alert.label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{alert.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card animate-fade-in stagger-4">
          <div className="card-header"><h4>High-Growth Employees</h4></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Employee</th><th>Growth % (30d)</th><th>Current Index</th><th>Certifications</th></tr></thead>
              <tbody>
                {(data.high_growth || []).map((e, i) => (
                  <tr key={i}>
                    <td><strong>{e.name}</strong></td>
                    <td style={{ color: 'var(--success)', fontWeight: 700 }}>+{e.growth}%</td>
                    <td>{e.index}%</td>
                    <td><span className="badge badge-primary">{e.certs} certs</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
