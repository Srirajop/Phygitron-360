import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sourceApi } from '../../api';
import { RefreshCw, Clock, Mail, LogIn, CheckSquare } from 'lucide-react';

const STATUS_BADGE = { sent: 'badge-muted', opened: 'badge-warning', logged_in: 'badge-info', completed: 'badge-success' };

export default function InviteStatus() {
  const { roleId } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    sourceApi.inviteStatus(roleId).then(r => setData(r.data.data || [])).finally(() => setLoading(false));
  };

  useEffect(() => { load(); const i = setInterval(load, 30000); return () => clearInterval(i); }, [roleId]);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div><h1>Candidate Activity Tracking</h1><p>Live status of invites sent for this role</p></div>
        <button className="btn btn-secondary" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>
      <div className="page-body">
        <div className="card animate-fade-in">
          <div className="table-container">
            <table>
              <thead><tr><th>Candidate</th><th>Email</th><th><Mail size={12} style={{ verticalAlign: 'middle' }} /> Email Status</th><th><Clock size={12} style={{ verticalAlign: 'middle' }} /> Sent</th><th><LogIn size={12} style={{ verticalAlign: 'middle' }} /> Logged In</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No invites sent for this role yet</td></tr>
                ) : data.map(row => (
                  <tr key={row.invite_id} className="animate-fade-in">
                    <td><strong>{row.name}</strong></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{row.email}</td>
                    <td><span className={`badge ${STATUS_BADGE[row.email_status] || 'badge-muted'}`}>{row.email_status}</span></td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{row.email_sent_at ? new Date(row.email_sent_at).toLocaleDateString() : '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{row.logged_in_at ? new Date(row.logged_in_at).toLocaleString() : '—'}</td>
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
