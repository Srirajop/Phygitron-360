import React, { useState, useEffect } from 'react';
import api from '../../api';
import { Building2, Power, Layers, Plus, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrgManagement() {
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newOrg, setNewOrg] = useState({ name: '', domain: '', adminEmail: '', adminName: '', adminPassword: '' });

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    try {
      const res = await api.get('/platform/orgs');
      setOrgs(res.data.data);
    } catch (err) {
      toast.error('Failed to load organisations');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleModule = async (orgId, moduleName, currentVal) => {
    try {
      const org = orgs.find(o => o.id === orgId);
      const updatedModules = { ...org.modules, [moduleName]: !currentVal };
      await api.put(`/platform/orgs/${orgId}/modules`, updatedModules);
      toast.success('Module access updated');
      fetchOrgs();
    } catch (err) {
      toast.error('Failed to update module access');
    }
  };

  const handleToggleStatus = async (orgId) => {
    try {
      await api.put(`/platform/orgs/${orgId}/toggle`);
      toast.success('Organisation status toggled');
      fetchOrgs();
    } catch (err) {
      toast.error('Failed to toggle status');
    }
  };

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    try {
      const { name, domain, adminEmail, adminName, adminPassword } = newOrg;
      // 1. Create Org
      const orgRes = await api.post('/platform/orgs', {
        name, domain, has_source: true, has_verify: true, has_forge: true, has_deploy: true, plan: 'pro', max_users: 50
      });
      const orgId = orgRes.data.data.id;
      
      // 2. Create Admin
      await api.post(`/platform/orgs/${orgId}/admin`, {
        email: adminEmail, full_name: adminName, password: adminPassword
      });

      toast.success('Organisation and Admin created successfully');
      setShowCreate(false);
      fetchOrgs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create organisation');
    }
  };

  if (loading) return <div className="page-content center">Loading tenants...</div>;

  return (
    <div className="page-content">
      <div className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Tenants & Module Access</h2>
          <p className="text-muted">Manage SaaS customers and their active features</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={18} /> New Tenant
        </button>
      </div>

      {showCreate && (
        <div className="glass-panel" style={{ padding: '20px', marginBottom: '20px', borderRadius: '12px' }}>
          <h4>Onboard New Organisation</h4>
          <form style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '15px' }} onSubmit={handleCreateOrg}>
            <div>
              <label className="filter-label">Organisation Name</label>
              <input type="text" className="search-input" value={newOrg.name} onChange={e => setNewOrg({...newOrg, name: e.target.value})} required />
            </div>
            <div>
              <label className="filter-label">Domain (Optional)</label>
              <input type="text" className="search-input" value={newOrg.domain} onChange={e => setNewOrg({...newOrg, domain: e.target.value})} />
            </div>
            <div style={{ gridColumn: '1 / -1', marginTop: '10px' }}><h5 style={{ margin: 0 }}>Admin Account</h5></div>
            <div>
              <label className="filter-label">Admin Email</label>
              <input type="email" className="search-input" value={newOrg.adminEmail} onChange={e => setNewOrg({...newOrg, adminEmail: e.target.value})} required />
            </div>
            <div>
              <label className="filter-label">Admin Full Name</label>
              <input type="text" className="search-input" value={newOrg.adminName} onChange={e => setNewOrg({...newOrg, adminName: e.target.value})} required />
            </div>
            <div>
              <label className="filter-label">Initial Password</label>
              <input type="password" className="search-input" value={newOrg.adminPassword} onChange={e => setNewOrg({...newOrg, adminPassword: e.target.value})} required minLength={8} />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary">Create Tenant</button>
            </div>
          </form>
        </div>
      )}

      <div className="data-table-container glass-panel">
        <table className="data-table">
          <thead>
            <tr>
              <th>Tenant Name</th>
              <th>Users</th>
              <th>Plan</th>
              <th>Modules Access</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <tr key={org.id} style={{ opacity: org.is_active ? 1 : 0.6 }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Building2 size={18} className="text-primary" />
                    <div>
                      <div style={{ fontWeight: '500' }}>{org.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{org.domain || 'N/A'}</div>
                    </div>
                  </div>
                </td>
                <td>{org.user_count} / {org.max_users}</td>
                <td><span className="badge" style={{ background: 'rgba(124, 58, 237, 0.1)', color: 'var(--primary)' }}>{org.plan}</span></td>
                <td>
                  <div style={{ display: 'flex', gap: '15px' }}>
                    {['source', 'verify', 'forge', 'deploy'].map(mod => (
                      <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          checked={org.modules[mod]} 
                          onChange={() => handleToggleModule(org.id, mod, org.modules[mod])} 
                        />
                        {mod.charAt(0).toUpperCase() + mod.slice(1)}
                      </label>
                    ))}
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${org.is_active ? 'active' : 'inactive'}`}>
                    {org.is_active ? 'Active' : 'Suspended'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleToggleStatus(org.id)} title="Toggle Status">
                    <Power size={18} style={{ color: org.is_active ? 'var(--text-muted)' : 'var(--danger)' }} />
                  </button>
                </td>
              </tr>
            ))}
            {orgs.length === 0 && (
              <tr><td colSpan="6" className="text-center" style={{ padding: '30px' }}>No organisations found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
