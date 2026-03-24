import React, { useState, useEffect } from 'react';
import { sourceApi } from '../../api';
import { Search, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ActiveCandidates() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    sourceApi.activeCandidates()
      .then(r => setCandidates(r.data.data || []))
      .catch(() => toast.error('Failed to load candidates'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = candidates.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1>Active Candidates</h1>
          <p>Trainees actively taking assessments and converted employees</p>
        </div>
      </div>

      <div className="page-body">
        <div className="card animate-fade-in" style={{ marginBottom: 24, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Search size={18} color="var(--text-muted)" />
          <input 
            type="text" 
            placeholder="Search by name or email..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontSize: '0.95rem', color: 'var(--text-primary)' }}
          />
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon" style={{ background: 'var(--primary-lightest)', color: 'var(--primary)', width: 64, height: 64, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}><UserCheck size={32} /></div>
            <p>No active candidates or employees found.</p>
          </div>
        ) : (
          <div className="card animate-scale-in">
            <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Name</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Email</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600 }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)' }}>{c.email}</td>
                    <td style={{ padding: '16px 24px' }}>
                      <span className={`badge ${c.type === 'Employee' ? 'badge-primary' : 'badge-success'}`}>
                        {c.type}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
