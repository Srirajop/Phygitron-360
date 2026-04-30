import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Building2, Users, HardDrive, Mail, Phone, Clock, MoreVertical, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { leadsApi } from '../../api';

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, leadsRes] = await Promise.all([
        api.get('/platform/stats'),
        leadsApi.listLeads()
      ]);
      setStats(statsRes.data.data);
      setLeads(leadsRes.data.data);
    } catch (err) {
      toast.error('Failed to load platform data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await leadsApi.updateStatus(id, status);
      toast.success(`Inquiry marked as ${status}`);
      fetchData();
    } catch (err) {
      toast.error('Failed to update inquiry status');
    }
  };

  if (loading) {
    return <div className="page-content center">Loading platform metrics...</div>;
  }

  return (
    <div className="page-content">
      <div className="dashboard-header">
        <div>
          <h2>Platform Overview</h2>
          <p className="text-muted">Global statistics across all multi-tenant organisations</p>
        </div>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="stat-card glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="icon-box" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)', padding: '15px', borderRadius: '10px' }}>
              <Building2 size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats?.total_organisations || 0}</div>
              <div className="text-muted" style={{ fontSize: '0.9rem' }}>Total Organisations</div>
            </div>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '15px', borderRadius: '10px' }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats?.total_users || 0}</div>
              <div className="text-muted" style={{ fontSize: '0.9rem' }}>Global Users</div>
            </div>
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ padding: '20px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div className="icon-box" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '15px', borderRadius: '10px' }}>
              <HardDrive size={24} />
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats?.active_organisations || 0}</div>
              <div className="text-muted" style={{ fontSize: '0.9rem' }}>Active Tenants</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Platform Inquiries</h3>
            <p className="text-muted">Leads from the public landing page outreach form</p>
          </div>
        </div>

        <div className="glass-panel" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Company & Contact</th>
                <th>Inquiry Type</th>
                <th>Message</th>
                <th>Submitted</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{lead.company_name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Mail size={12} /> {lead.email}
                    </div>
                  </td>
                  <td>
                    <span className="badge" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#0ea5e9', fontSize: '0.75rem' }}>
                      {lead.inquiry_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <div style={{ maxWidth: '300px', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={lead.message}>
                      {lead.message || '—'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {new Date(lead.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge ${lead.status}`}>
                      {lead.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {lead.status === 'pending' && (
                        <>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => handleUpdateStatus(lead.id, 'contacted')}
                            title="Mark as Contacted"
                            style={{ color: 'var(--primary)', padding: '5px' }}
                          >
                            <Phone size={16} />
                          </button>
                          <button 
                            className="btn btn-ghost btn-sm" 
                            onClick={() => handleUpdateStatus(lead.id, 'converted')}
                            title="Convert to Tenant"
                            style={{ color: '#10b981', padding: '5px' }}
                          >
                            <CheckCircle size={16} />
                          </button>
                        </>
                      )}
                      {lead.status !== 'rejected' && (
                        <button 
                          className="btn btn-ghost btn-sm" 
                          onClick={() => handleUpdateStatus(lead.id, 'rejected')}
                          title="Reject / Archive"
                          style={{ color: 'var(--danger)', padding: '5px' }}
                        >
                          <XCircle size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No inbound inquiries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
