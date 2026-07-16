import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Globe, Activity, Plus, Shield,
  Terminal, ArrowRight, Zap,
  Database, School, ShieldCheck, Rocket
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../../core/auth/AuthContext';
import { isEmail, validatePassword } from '../../../core/utils/validators';

import logo from '../../../assets/phy360.png';
import bellIcon from '../../../assets/bell.png';
import logoutIcon from '../../../assets/exit.png';

import '../styles/admin.css';

export default function SuperadminDashboard() {
  const { hasRole, logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeSideTab, setActiveSideTab] = useState('tenants');

  const [tenants, setTenants] = useState([]);
  const [demoRequests, setDemoRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [provisionForm, setProvisionForm] = useState({ company_name: '', admin_email: '', admin_password: '' });
  const [provisioning, setProvisioning] = useState(false);

  const [showOpsModal, setShowOpsModal] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [tenantOps, setTenantOps] = useState({ modules_enabled: [], plan: '', is_active: true, stats: {} });
  const [savingOps, setSavingOps] = useState(false);
  const [loadingOps, setLoadingOps] = useState(false);

  const fetchGlobalData = async () => {
    try {
      setLoading(true);
      const [tRes, dRes] = await Promise.all([
        fetch('/api/admin/tenants', { credentials: 'include' }),
        fetch('/api/auth/demo-requests', { credentials: 'include' })
      ]);
      const tData = await tRes.json();
      const dData = await dRes.json();
      setTenants(Array.isArray(tData) ? tData : []);
      setDemoRequests(Array.isArray(dData) ? dData : []);
    } catch (err) {
      toast.error('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalData();
  }, []);

  if (!hasRole('super_admin')) {
    return (
      <div className="dashboard-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Shield size={48} style={{ color: '#7c3aed', opacity: 0.2, margin: '0 auto 16px' }} />
          <h2 style={{ fontWeight: 900, color: '#000', textTransform: 'uppercase', fontStyle: 'italic' }}>
            Access Denied: Insufficient Permissions
          </h2>
        </div>
      </div>
    );
  }

  const displayName =
    user?.name || user?.username || user?.email?.split('@')[0] || 'Super Admin';

  const handleProvision = async (e) => {
    e.preventDefault();
    if (!provisionForm.company_name.trim()) return toast.error('Company name is required.');
    if (provisionForm.company_name.trim().length < 2) return toast.error('Company name must be at least 2 characters.');
    if (!isEmail(provisionForm.admin_email)) return toast.error('Enter a valid admin email address.');
    const passwordError = validatePassword(provisionForm.admin_password);
    if (passwordError) return toast.error(passwordError);
    setProvisioning(true);
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provisionForm)
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Workspace created: ${data.subdomain}.localhost`);
        setShowProvisionModal(false);
        setProvisionForm({ company_name: '', admin_email: '', admin_password: '' });
        fetchGlobalData();
      } else {
        toast.error(data.detail || 'Setup failed.');
      }
    } catch (err) {
      toast.error('Connection error during setup.');
    } finally {
      setProvisioning(false);
    }
  };

  const openOpsModal = async (tenant) => {
    setSelectedTenant(tenant);
    setShowOpsModal(true);
    setLoadingOps(true);
    setTenantOps({
      ...tenant,
      modules_enabled: tenant.modules_enabled || ['source', 'forge', 'deploy', 'verify'],
      stats: {}
    });
    try {
      const res = await fetch(`/api/admin/tenants/${tenant.id}/ops`, { credentials: 'include' });
      const data = await res.json();
      setTenantOps(prev => ({ ...prev, stats: data.stats || {} }));
    } catch {
      toast.error('Failed to fetch workspace data.');
    } finally {
      setLoadingOps(false);
    }
  };

  const handleUpdateOps = async (e) => {
    e.preventDefault();
    const allowedPlans = ['starter', 'growth', 'enterprise'];
    if (!tenantOps.company_name?.trim()) return toast.error('Company name is required.');
    if (tenantOps.plan && !allowedPlans.includes(String(tenantOps.plan).toLowerCase())) return toast.error('Select a valid plan.');
    if (!tenantOps.modules_enabled?.length) return toast.error('At least one module must remain enabled.');
    setSavingOps(true);
    try {
      const res = await fetch(`/api/admin/tenants/${selectedTenant.id}/ops`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: tenantOps.company_name,
          plan: tenantOps.plan,
          modules_enabled: tenantOps.modules_enabled,
          is_active: tenantOps.is_active
        })
      });
      if (res.ok) {
        toast.success('Settings updated.');
        setShowOpsModal(false);
        fetchGlobalData();
      } else {
        toast.error('Update failed.');
      }
    } catch {
      toast.error('Connection lost. Update failed.');
    } finally {
      setSavingOps(false);
    }
  };

  const toggleModule = (mod) => {
    setTenantOps(prev => {
      const mods = prev.modules_enabled.includes(mod)
        ? prev.modules_enabled.filter(m => m !== mod)
        : [...prev.modules_enabled, mod];
      return { ...prev, modules_enabled: mods };
    });
  };

  const handleDeleteTenant = async () => {
    if (!window.confirm(`Are you sure you want to delete '${selectedTenant.company_name}' and all its data? This cannot be undone.`)) return;
    setSavingOps(true);
    try {
      const res = await fetch(`/api/admin/tenants/${selectedTenant.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Workspace deleted successfully.');
        setShowOpsModal(false);
        fetchGlobalData();
      } else {
        const data = await res.json();
        toast.error(data.detail || 'Deletion failed.');
      }
    } catch {
      toast.error('Error during deletion.');
    } finally {
      setSavingOps(false);
    }
  };

  /* ─── inline style tokens ─── */
  const S = {
    card: {
      background: '#fff',
      border: '1px solid #e9ddff',
      borderRadius: '1rem',
      padding: '1.5rem',
    },
    pill: (active) => ({
      padding: '6px 18px',
      borderRadius: '9999px',
      fontSize: '11px',
      fontWeight: 700,
      border: `1px solid ${active ? 'transparent' : '#e9ddff'}`,
      background: active ? '#7c3aed' : 'transparent',
      color: active ? '#fff' : '#666',
      cursor: 'pointer',
      transition: 'all .15s',
    }),
    input: {
      width: '100%',
      background: '#faf7ff',
      border: '1px solid #e9ddff',
      borderRadius: '12px',
      padding: '10px 14px',
      fontSize: '14px',
      color: '#000',
      outline: 'none',
    },
    label: {
      display: 'block',
      fontSize: '10px',
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '.1em',
      color: 'rgba(0,0,0,.5)',
      marginBottom: '8px',
    },
    primaryBtn: {
      background: '#7c3aed',
      color: '#fff',
      border: 'none',
      borderRadius: '12px',
      padding: '12px 24px',
      fontSize: '11px',
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '.1em',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      transition: 'opacity .15s',
    },
    ghostBtn: {
      background: '#faf7ff',
      color: 'rgba(0,0,0,.7)',
      border: '1px solid #e9ddff',
      borderRadius: '12px',
      padding: '12px 24px',
      fontSize: '11px',
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '.1em',
      cursor: 'pointer',
      transition: 'opacity .15s',
    },
    dangerBtn: {
      background: 'rgba(239,68,68,.08)',
      color: '#f87171',
      border: '1px solid rgba(239,68,68,.2)',
      borderRadius: '12px',
      padding: '12px 24px',
      fontSize: '11px',
      fontWeight: 900,
      textTransform: 'uppercase',
      letterSpacing: '.1em',
      cursor: 'pointer',
      transition: 'all .15s',
    },
  };

  return (
    <div className="dashboard-page">

      {/* ── TOPBAR (same shell as OrgDashboard) ── */}
      <div className="topbar">
        <div className="top-left">
          <img src={logo} className="logo" alt="logo" />
        </div>

        <div className="top-center">
          <div className="hub-tabs">
            <button
              className={`hub-tab ${location.pathname === '/superadmin' ? 'active' : ''}`}
              onClick={() => navigate('/superadmin')}
            >
              Super Admin
            </button>
          </div>
        </div>

        <div className="top-right">
          <img src={bellIcon} className="icon" alt="bell" />
          <img
            src={logoutIcon}
            className="icon logout-icon"
            alt="logout"
            onClick={() => { logout(); navigate('/login'); }}
          />
          <div className="profile-wrap">
            <div className="avatar">{displayName?.charAt(0)?.toUpperCase()}</div>
            <div className="profile-text">
              <h4>{displayName}</h4>
              <p>Super Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="dashboard-body">

        {/* ── SIDEBAR ── */}
        <div className="sidebar">
          {[
            { id: 'tenants',  label: 'Tenants'      },
            { id: 'demo',     label: 'Demo Archive'  },
            { id: 'license',  label: 'License Lab'   },
          ].map(tab => (
            <button
              key={tab.id}
              className={activeSideTab === tab.id ? 'active' : ''}
              onClick={() => setActiveSideTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        <div className="content">

          {/* ── STAT STRIP ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '20px',
              marginBottom: '24px'
            }}
          >
            {[
              { label: 'Active Enterprises', value: tenants.length || 0 },
              { label: 'Demo Requests', value: demoRequests.length || 0 },
              { label: 'Platform Load', value: '14.2%' },
              { label: 'DB Health', value: '99.9%' },
            ].map((m, i) => (
              <div
                key={i}
                style={{
                  background:
                    'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '24px',
                  padding: '28px',
                  minHeight: '140px',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: '0 8px 20px rgba(124,58,237,0.18)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow =
                    '0 18px 40px rgba(124,58,237,0.30)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow =
                    '0 8px 20px rgba(124,58,237,0.18)';
                }}
              >
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    opacity: 0.9,
                    marginBottom: '12px'
                  }}
                >
                  {m.label}
                </p>

                <h2
                  style={{
                    fontSize: '42px',
                    fontWeight: 900,
                    margin: 0,
                    color: '#fff'
                  }}
                >
                  {m.value}
                </h2>
              </div>
            ))}
          </div>

          {/* ── TENANTS TAB ── */}
          {activeSideTab === 'tenants' && (
            <div className="section boxed">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <p style={{
                  fontWeight: 900,
                  fontSize: 25,
                  color: '#000',
                  marginBottom: 4
                }}>Enterprise Tenants</p>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button style={S.ghostBtn}>
                    <Terminal size={13} style={{ marginRight: 4 }} />
                    Audit Log
                  </button>
                  <button style={S.primaryBtn} onClick={() => setShowProvisionModal(true)}>
                    <Plus size={13} /> Provision Tenant
                  </button>
                </div>
              </div>

              {loading ? (
                <p style={{ color: 'rgba(0,0,0,.4)', fontSize: 13 }}>Loading tenants…</p>
              ) : tenants.length === 0 ? (
                <p style={{ color: 'rgba(0,0,0,.4)', fontSize: 13 }}>No tenants provisioned yet.</p>
              ) : (
                <div className="cards" style={{ flexWrap: 'wrap', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {tenants.map((t) => (
                    <div key={t.id} style={{ ...S.card, minWidth: 220, position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(124,58,237,.08)', color: '#7c3aed' }}>
                          <Globe size={18} />
                        </div>
                        <span style={{
                          padding: '3px 10px', borderRadius: 9999, fontSize: 10, fontWeight: 700,
                          background: 'rgba(16,185,129,.08)', color: '#10b981',
                          border: '1px solid rgba(16,185,129,.2)'
                        }}>
                          {t.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p style={{ fontWeight: 900, fontSize: 30, color: '#000', marginBottom: 4 }}>{t.company_name}</p>
                      <p style={{ fontSize: 11, color: 'rgba(0,0,0,.45)', marginBottom: 16 }}>{t.subdomain}.localhost</p>
                      <div
                        style={{
                          borderTop: '1px solid #ece4ff',
                          paddingTop: 16,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ display: 'flex', marginLeft: '-6px' }}>
                          {[
                            { id: 'source', label: 'S', color: '#af66f3' },
                            { id: 'verify', label: 'V', color: '#10B981' },
                            { id: 'forge', label: 'F', color: '#F59E0B' },
                            { id: 'deploy', label: 'D', color: '#e731ad' },
                          ]
                            .filter(mod => t.modules_enabled?.includes(mod.id))
                            .map((mod, index) => (
                              <div
                                key={mod.id}
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: '50%',
                                  background: mod.color,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: 900,
                                  color: '#000',
                                  border: '1px solid #000',
                                  marginLeft: index === 0 ? 0 : '-8px'
                                }}
                              >
                                {mod.label}
                              </div>
                            ))}
                        </div>

                        <button
                          onClick={() => openOpsModal(t)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#7c3aed',
                            fontSize: 17,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                        >
                          Manage Ops <ArrowRight size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ── DEMO ARCHIVE TAB ── */}
          {activeSideTab === 'demo' && (
            <div className="section boxed">
              <h3>Demo Requests Archive</h3>
              {demoRequests.length === 0 ? (
                <p style={{ color: 'rgba(0,0,0,.4)', fontSize: 13 }}>No demo requests yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Email</th>
                      <th>Job Title</th>
                      <th>Modules</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoRequests.map((d) => (
                      <tr key={d.id}>
                        <td style={{ fontWeight: 700 }}>{d.company_name}</td>
                        <td style={{ color: 'rgba(0,0,0,.5)', fontStyle: 'italic', fontSize: 12 }}>{d.work_email}</td>
                        <td>{d.job_title}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {d.modules_requested?.split(',').map((m) => (
                              <span key={m.trim()} style={{
                                background: '#f4ecff', color: 'rgba(0,0,0,.6)',
                                padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '.05em'
                              }}>{m.trim()}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button style={{ ...S.primaryBtn, padding: '6px 14px', fontSize: 10 }}>
                            Provision
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* ── LICENSE LAB TAB ── */}
          {activeSideTab === 'license' && (
            <div className="section boxed" style={{ textAlign: 'center', padding: '60px 24px' }}>
              <Zap size={40} style={{ color: '#7c3aed', opacity: .2, margin: '0 auto 16px' }} />
              <p style={{ fontWeight: 900, fontSize: 14, color: '#000', marginBottom: 6 }}>
                License System Locked
              </p>
              <p style={{ fontSize: 11, color: 'rgba(0,0,0,.4)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                Connect billing to enable dynamic scaling
              </p>
            </div>
          )}

        </div>{/* /content */}
      </div>{/* /dashboard-body */}

      {/* ── PROVISION MODAL ── */}
      {showProvisionModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)'
        }}>
          <div style={{ position: 'absolute', inset: 0 }} onClick={() => !provisioning && setShowProvisionModal(false)} />
          <div style={{
            position: 'relative', width: '100%', maxWidth: 480,
            background: '#fff', borderRadius: '1.5rem',
            border: '1px solid #e9ddff', padding: '2rem',
            boxShadow: '0 20px 60px rgba(124,58,237,.12)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontWeight: 900, fontSize: 16, color: '#000', margin: 0 }}>
                Provision <span style={{ color: '#7c3aed' }}>Workspace</span>
              </h2>
              <button onClick={() => setShowProvisionModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,.5)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={handleProvision} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={S.label}>Enterprise Name</label>
                <input required placeholder="e.g. Acme Corp" style={S.input}
                  value={provisionForm.company_name}
                  onChange={e => setProvisionForm({ ...provisionForm, company_name: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Admin Email</label>
                <input required type="email" placeholder="admin@enterprise.com" style={S.input}
                  value={provisionForm.admin_email}
                  onChange={e => setProvisionForm({ ...provisionForm, admin_email: e.target.value })} />
              </div>
              <div>
                <label style={S.label}>Root Password</label>
                <input required type="password" placeholder="••••••••" style={S.input}
                  value={provisionForm.admin_password}
                  onChange={e => setProvisionForm({ ...provisionForm, admin_password: e.target.value })} />
              </div>
              <button disabled={provisioning} type="submit"
                style={{ ...S.primaryBtn, width: '100%', justifyContent: 'center', marginTop: 8, opacity: provisioning ? .7 : 1 }}>
                {provisioning ? <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={14} />}
                {provisioning ? 'Provisioning…' : 'Initialize Provisioning'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── MANAGE OPS MODAL ── */}
      {showOpsModal && selectedTenant && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)'
        }}>
          <div style={{ position: 'absolute', inset: 0 }} onClick={() => !savingOps && setShowOpsModal(false)} />
          <div style={{
            position: 'relative', width: '100%', maxWidth: 600,
            background: '#fff', borderRadius: '1.5rem',
            border: '1px solid #e9ddff', padding: '2rem',
            boxShadow: '0 20px 60px rgba(124,58,237,.12)',
            display: 'flex', flexDirection: 'column', gap: 20,
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ fontWeight: 900, fontSize: 16, color: '#000', margin: 0 }}>
                  Enterprise <span style={{ color: '#7c3aed' }}>Operations</span>
                </h2>
                <p style={{ fontSize: 10, color: 'rgba(0,0,0,.4)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '.1em' }}>
                  ID: {selectedTenant.id}
                </p>
              </div>
              <button onClick={() => setShowOpsModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,.5)', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {['Personnel', 'Candidates', 'Users'].map(label => (
                <div key={label} style={{ ...S.card, padding: '14px' }}>
                  <p style={{ fontSize: 10, fontWeight: 900, color: 'rgba(0,0,0,.4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 24, fontWeight: 900, color: '#000' }}>
                    {loadingOps ? '…' : (tenantOps.stats?.[label] ?? 0)}
                  </p>
                </div>
              ))}
            </div>

            <form onSubmit={handleUpdateOps} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Name + Plan */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label style={S.label}>Company Alias</label>
                  <input style={S.input} value={tenantOps.company_name}
                    onChange={e => setTenantOps({ ...tenantOps, company_name: e.target.value })} />
                </div>
                <div>
                  <label style={S.label}>Service Tier</label>
                  <select style={{ ...S.input, appearance: 'none' }} value={tenantOps.plan}
                    onChange={e => setTenantOps({ ...tenantOps, plan: e.target.value })}>
                    <option value="starter">Starter — Trial</option>
                    <option value="growth">Growth — Standard</option>
                    <option value="enterprise">Enterprise — Unlimited</option>
                    <option value="custom">Tactical Custom</option>
                  </select>
                </div>
              </div>

              {/* Module toggles */}
              <div>
                <label style={S.label}>Module Activation</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {[
                    { id: 'source', name: 'Source', color: '#CC97FF', Icon: Database },
                    { id: 'forge',  name: 'Forge',  color: '#10B981', Icon: School },
                    { id: 'verify', name: 'Verify', color: '#F59E0B', Icon: ShieldCheck },
                    { id: 'deploy', name: 'Deploy', color: '#6366F1', Icon: Rocket },
                  ].map(mod => {
                    const active = tenantOps.modules_enabled.includes(mod.id);
                    return (
                      <button key={mod.id} type="button" onClick={() => toggleModule(mod.id)}
                        style={{
                          padding: '14px 8px', borderRadius: 12,
                          border: `1px solid ${active ? '#cdb5ff' : '#ece4ff'}`,
                          background: active ? '#f4ecff' : '#fff',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                          cursor: 'pointer', opacity: active ? 1 : .45, transition: 'all .15s'
                        }}>
                        <div style={{
                          padding: 6, borderRadius: 8,
                          background: active ? `${mod.color}20` : 'transparent',
                          color: active ? mod.color : '#6b7280'
                        }}>
                          <mod.Icon size={16} />
                        </div>
                        <span style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em', color: '#000' }}>
                          {mod.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: '#faf7ff', border: '1px solid #e9ddff', borderRadius: 12 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#000', margin: 0 }}>Tenant Status</p>
                  <p style={{ fontSize: 10, color: 'rgba(0,0,0,.4)', margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                    {tenantOps.is_active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <button type="button"
                  onClick={() => setTenantOps({ ...tenantOps, is_active: !tenantOps.is_active })}
                  style={{
                    padding: '6px 16px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '.08em', cursor: 'pointer',
                    background: tenantOps.is_active ? 'rgba(16,185,129,.08)' : 'rgba(239,68,68,.08)',
                    color: tenantOps.is_active ? '#10b981' : '#f87171',
                    border: `1px solid ${tenantOps.is_active ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)'}`,
                    transition: 'all .15s'
                  }}>
                  {tenantOps.is_active ? 'Online' : 'Offline'}
                </button>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowOpsModal(false)} style={{ ...S.ghostBtn, flex: 1 }}>
                  Cancel
                </button>
                <button type="button" onClick={handleDeleteTenant} disabled={savingOps} style={{ ...S.dangerBtn, flex: 1 }}>
                  Delete
                </button>
                <button type="submit" disabled={savingOps}
                  style={{ ...S.primaryBtn, flex: 1, justifyContent: 'center', opacity: savingOps ? .7 : 1 }}>
                  {savingOps ? <Activity size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
                  Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
