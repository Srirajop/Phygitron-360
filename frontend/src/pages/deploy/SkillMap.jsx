import React from 'react';
import { deployApi } from '../../api';
export default function SkillMap() {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => { deployApi.skillMap().then(r => setData(r.data.data || [])).finally(() => setLoading(false)); }, []);
  return (
    <div>
      <div className="page-header"><h1>Org-Wide Skill Map</h1><p>Visual overview of skills across your organisation</p></div>
      <div className="page-body">
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div> : (
          <div className="card animate-fade-in">
            <div className="table-container">
              <table>
                <thead><tr><th>Skill</th><th>Category</th><th>Beginner</th><th>Intermediate</th><th>Advanced</th><th>Expert</th><th>Total</th></tr></thead>
                <tbody>
                  {data.map((s, i) => (
                    <tr key={i} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><span className="badge badge-muted">{s.category}</span></td>
                      {['beginner','intermediate','advanced','expert'].map(level => (
                        <td key={level}>
                          {s[level] > 0 ? (
                            <div className={`heat-cell heat-${Math.min(s[level], 3)}`}>{s[level]}</div>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      ))}
                      <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{s.total}</td>
                    </tr>
                  ))}
                  {data.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No skill data yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
