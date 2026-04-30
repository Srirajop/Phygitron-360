import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { deployApi, adminApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowUpDown, BarChart2, Briefcase, Shield, FileText, ExternalLink,
  Users, Download, UserPlus, Search
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  active:      { badge: 'badge-success', label: 'Active',      dot: '#10B981' },
  on_leave:    { badge: 'badge-warning', label: 'On Leave',    dot: '#F59E0B' },
  deployed:    { badge: 'badge-info',    label: 'Deployed',    dot: '#3B82F6' },
  offboarded:  { badge: 'badge-muted',   label: 'Offboarded',  dot: '#9CA3AF' },
  exited:      { badge: 'badge-danger',  label: 'Exited',      dot: '#EF4444' },
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function Avatar({ name, size = 38 }) {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const colors = ['#7C3AED','#059669','#D97706','#DC2626','#2563EB','#7C3AED','#0891B2'];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${colors[idx]}, ${colors[(idx+2) % colors.length]})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'white', fontWeight: 700, fontSize: size > 40 ? '1rem' : '0.8rem',
    }}>{initials}</div>
  );
}

function CapabilityBar({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>;
  const color = value >= 75 ? '#10B981' : value >= 50 ? '#3B82F6' : value >= 25 ? '#F59E0B' : '#EF4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 800, color, minWidth: 38, fontSize: '0.9rem' }}>{value.toFixed(0)}%</span>
      <div style={{ flex: 1, height: 6, background: '#F3F4F6', borderRadius: 999, overflow: 'hidden', minWidth: 60 }}>
        <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 999, transition: 'width 0.8s ease' }} />
      </div>
    </div>
  );
}

export default function EmployeeList() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        deployApi.listEmployees({ department: deptFilter || undefined, status: statusFilter || undefined }),
        deployApi.departments(),
      ]);
      const empData = empRes.data.data;
      const deptData = deptRes.data.data;
      setEmployees(Array.isArray(empData) ? empData : []);
      setDepartments(Array.isArray(deptData) ? deptData : []);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [deptFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Client-side search + sort
  const filtered = employees
    .filter(e => {
      if (!search) return true;
      const q = search.toLowerCase();
      return e.name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        e.emp_id?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let va = sortBy === 'capability_index' ? (a.capability_index || -1) : (a[sortBy] || '');
      let vb = sortBy === 'capability_index' ? (b.capability_index || -1) : (b[sortBy] || '');
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      return sortDir === 'asc' ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const handleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const exportCsv = () => {
    const rows = [
      ['Name', 'Email', 'Emp ID', 'Department', 'Status', 'Skills', 'Capability Index', 'Join Date'],
      ...filtered.map(e => [e.name, e.email, e.emp_id || '', e.department || '', e.status, e.skill_count, e.capability_index?.toFixed(0) || '', e.join_date || '']),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'employees.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }) => (
    <ArrowUpDown size={12} style={{ opacity: sortBy === col ? 1 : 0.35, color: sortBy === col ? 'var(--primary)' : 'inherit' }} />
  );

  const stats = [
    { label: 'Total Employees', value: filtered.length, icon: <Users size={18} /> },
    { label: 'Active', value: filtered.filter(e => e.status === 'active').length, icon: <Shield size={18} /> },
    { label: 'Deployed', value: filtered.filter(e => e.status === 'deployed').length, icon: <Briefcase size={18} /> },
    { label: 'Avg Capability', value: (() => { const with_score = filtered.filter(e => e.capability_index != null); return with_score.length ? Math.round(with_score.reduce((s, e) => s + e.capability_index, 0) / with_score.length) + '%' : '—'; })(), icon: <BarChart2 size={18} /> },
  ];

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Employee Database</h1>
          <p>Skill-first talent profiles, deployment status, and workforce insights</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
          {['hr', 'org_admin'].includes(user?.role) && (
            <button className="btn btn-primary" onClick={() => nav('/deploy/add')}>
              <UserPlus size={15} /> Add Employee
            </button>
          )}
        </div>
      </div>

      <div className="page-body">
        {/* Stats Row */}
        <div className="stats-grid animate-fade-in" style={{ marginBottom: 24 }}>
          {stats.map((s, i) => (
            <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card animate-fade-in" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: '16px 20px' }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative', minWidth: 200 }}>
                <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  id="employee-search"
                  className="form-control"
                  placeholder="Search by name, email, ID, department…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 38 }}
                />
              </div>

              <select
                id="dept-filter"
                className="form-control"
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                style={{ width: 180 }}
              >
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                id="status-filter"
                className="form-control"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ width: 150 }}
              >
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>

              {(search || deptFilter || statusFilter) && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setDeptFilter(''); setStatusFilter(''); }}>
                  Clear Filters
                </button>
              )}

              <div style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {filtered.length} of {employees.length} employees
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card animate-fade-in">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Employee <SortIcon col="name" /></span>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('department')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Dept / Role <SortIcon col="department" /></span>
                  </th>
                  <th>Skills</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('capability_index')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Capability Index <SortIcon col="capability_index" /></span>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('status')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Status <SortIcon col="status" /></span>
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('join_date')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Joined <SortIcon col="join_date" /></span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                    {employees.length === 0 ? 'No employees in database yet.' : 'No employees match your filters.'}
                  </td></tr>
                ) : filtered.map((e, i) => {
                  const cfg = STATUS_CONFIG[e.status] || STATUS_CONFIG.active;
                  return (
                    <tr key={e.id} className={`animate-fade-in stagger-${Math.min(i+1,5)}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => nav(`/deploy/employee/${e.id}`)}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Avatar name={e.name} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{e.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {e.emp_id && <span style={{ fontFamily: 'monospace', marginRight: 6 }}>{e.emp_id}</span>}
                              {e.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.72rem', alignSelf: 'flex-start', marginBottom: 4 }}>{e.department || 'General'}</span>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{e.designation || '—'}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="badge badge-muted" style={{ fontWeight: 700 }}>
                            {e.skill_count}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>skills</span>
                        </div>
                      </td>
                      <td style={{ minWidth: 160 }}>
                        <CapabilityBar value={e.capability_index} />
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
                          <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {e.join_date ? new Date(e.join_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                          {e.resume_url && (
                             <a 
                               href={e.resume_url.startsWith('http') ? e.resume_url : `${API_BASE}/${e.resume_url.replace(/^\/+/, '')}`} 
                               target="_blank" 
                               rel="noopener noreferrer" 
                               onClick={ev => ev.stopPropagation()}
                               style={{ color: 'var(--primary)', opacity: 0.8 }}
                               title="View Resume"
                             >
                               <FileText size={16} />
                             </a>
                          )}
                        </div>
                      </td>
                      <td onClick={ev => ev.stopPropagation()}>
                        <Link
                          to={`/deploy/employee/${e.id}`}
                          className="btn btn-secondary btn-sm"
                        >
                          View Profile
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Analytics link */}
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Link to="/deploy/skill-map" className="btn btn-secondary btn-sm"><BarChart2 size={14} /> Skill Map</Link>
          <Link to="/deploy/analytics" className="btn btn-secondary btn-sm"><BarChart2 size={14} /> Analytics</Link>
        </div>
      </div>
    </div>
  );
}
