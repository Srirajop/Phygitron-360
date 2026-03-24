import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { deployApi } from '../../api';
import { Users, Search, Filter } from 'lucide-react';

const STATUS_BADGE = { active: 'badge-success', deployed: 'badge-info', onleave: 'badge-warning', inactive: 'badge-muted' };

export default function EmployeeList() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState('');

  useEffect(() => {
    deployApi.listEmployees({ department: dept || undefined }).then(r => setEmployees(r.data.data || [])).finally(() => setLoading(false));
  }, [dept]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><h1>Employee Directory</h1><p>Skill-first employee profiles and deployment status</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="form-control" placeholder="Filter by department…" value={dept} onChange={e => setDept(e.target.value)} style={{ width: 200 }} />
        </div>
      </div>
      <div className="page-body">
        <div className="stats-grid animate-fade-in">
          {[
            { label: 'Total Employees', value: employees.length, icon: <Users size={18} /> },
            { label: 'Active', value: employees.filter(e => e.status === 'active').length, icon: <Users size={18} /> },
            { label: 'Deployed', value: employees.filter(e => e.status === 'deployed').length, icon: <Filter size={18} /> },
          ].map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="card animate-fade-in">
          <div className="table-container">
            <table>
              <thead><tr><th>Employee</th><th>Department</th><th>Skills</th><th>Capability Index</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                  : employees.map((e, i) => (
                    <tr key={e.id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '0.875rem' }}>
                            {e.name?.[0] || '?'}
                          </div>
                          <div><div style={{ fontWeight: 600 }}>{e.name}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{e.emp_id}</div></div>
                        </div>
                      </td>
                      <td>{e.department || '—'}</td>
                      <td><span className="badge badge-muted">{e.skill_count} skills</span></td>
                      <td>
                        {e.capability_index != null ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{e.capability_index.toFixed(0)}%</div>
                            <div className="progress-bar" style={{ width: 60 }}><div className="progress-fill" style={{ width: `${e.capability_index}%` }} /></div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[e.status] || 'badge-muted'}`}>{e.status}</span></td>
                      <td><Link to={`/deploy/employee/${e.id}`} className="btn btn-secondary btn-sm">View</Link></td>
                    </tr>
                  ))}
                {!loading && employees.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No employees found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
