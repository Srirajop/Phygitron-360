import React, { useEffect, useState, useCallback } from 'react';
import { deployApi } from '../../api';
import { Map, Filter, Download, Brain, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SkillMap() {
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [skillsRes, deptsRes] = await Promise.all([
        deployApi.skillMap(deptFilter ? { department: deptFilter } : {}),
        deployApi.departments(),
      ]);
      const sd = skillsRes.data.data;
      const dd = deptsRes.data.data;
      setData(Array.isArray(sd) ? sd : []);
      setDepartments(Array.isArray(dd) ? dd : []);
    } catch {
      toast.error('Failed to load skill map');
    } finally {
      setLoading(false);
    }
  }, [deptFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group data by category
  const grouped = data.reduce((acc, skill) => {
    const cat = skill.category || 'Uncategorised';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(skill);
    return acc;
  }, {});

  const maxTotal = Math.max(...data.map(s => s.total || 0), 1);

  const exportCsv = () => {
    const rows = [
      ['Category', 'Skill', 'Beginner', 'Intermediate', 'Advanced', 'Expert', 'Total'],
      ...data.map(s => [s.category || 'Uncategorised', s.name, s.beginner || 0, s.intermediate || 0, s.advanced || 0, s.expert || 0, s.total || 0])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'org_skill_map.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const getIntensityColor = (value, max) => {
    if (value === 0) return 'rgba(243, 244, 246, 0.5)'; // very light gray
    const intensity = Math.max(0.15, Math.min(value / max, 1));
    return `rgba(124, 58, 237, ${intensity})`; // using --primary color #7C3AED with varying opacity
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Organisation Skill Map</h1>
          <p>Visual overview of capabilities and skill density across your workforce</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={exportCsv} disabled={data.length === 0}>
            <Download size={15} /> Export Data
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)' }}>
              <Filter size={16} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Filter by Department:</span>
            </div>
            <select 
              className="form-control" 
              value={deptFilter} 
              onChange={e => setDeptFilter(e.target.value)}
              style={{ width: 250 }}
            >
              <option value="">All Departments (Entire Org)</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><div className="spinner spinner-lg" /></div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🗺️</div>
            <p>No skill data available for this selection.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {Object.entries(grouped).map(([category, skills], cIdx) => (
              <div key={category} className={`card animate-fade-in stagger-${Math.min(cIdx+1, 5)}`} style={{ overflow: 'hidden' }}>
                <div className="card-header" style={{ background: 'var(--primary-lightest)' }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Brain size={16} /> {category}
                  </h4>
                </div>
                <div className="table-container">
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: '25%' }}>Skill</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Beginner</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Intermediate</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Advanced</th>
                        <th style={{ width: '15%', textAlign: 'center' }}>Expert</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skills.map((s, i) => {
                        const rowMax = Math.max(s.beginner || 0, s.intermediate || 0, s.advanced || 0, s.expert || 0, 1);
                        return (
                          <tr key={s.skill_id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            {[s.beginner, s.intermediate, s.advanced, s.expert].map((val, idx) => (
                              <td key={idx} style={{ padding: '6px' }}>
                                <div style={{ 
                                  background: getIntensityColor(val || 0, rowMax),
                                  borderRadius: 6,
                                  padding: '10px 0',
                                  textAlign: 'center',
                                  fontWeight: (val || 0) > 0 ? 700 : 400,
                                  color: (val || 0) > 0 ? ((val || 0)/rowMax > 0.6 ? 'white' : 'var(--text-primary)') : 'var(--text-muted)',
                                  transition: 'var(--transition)'
                                }}>
                                  {val || 0}
                                </div>
                              </td>
                            ))}
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                                {s.total}
                                <div style={{ width: 40, height: 6, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${((s.total || 0) / maxTotal) * 100}%`, background: 'var(--primary)', borderRadius: 999 }} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
