import React, { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { Settings, Save, Smartphone, Palette, Globe, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function OrgSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.orgSettings().then(r => setData(r.data.data)).finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateOrgSettings(data);
      toast.success('Settings updated!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><div className="spinner spinner-lg" /></div>;
  if (!data) return <div className="page-body">Organisation not found.</div>;

  return (
    <div>
      <div className="page-header"><h1>Organisation Settings ⚙️</h1><p>Customize the platform for your company</p></div>
      <div className="page-body" style={{ maxWidth: 860 }}>
        <form onSubmit={handleSave}>
          <div className="card animate-fade-in">
            <div className="card-header"><h4><Settings size={18} style={{ verticalAlign: 'middle' }} /> General Configuration</h4></div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="form-group"><label className="form-label">Organisation Name</label><input className="form-control" value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Domain</label><input className="form-control" value={data.domain} onChange={e => setData(d => ({ ...d, domain: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Primary Color (Hex)</label><div style={{ display: 'flex', gap: 8 }}><input className="form-control" value={data.theme_color || '#7C3AED'} onChange={e => setData(d => ({ ...d, theme_color: e.target.value }))} /><div style={{ width: 44, height: 44, borderRadius: 'var(--radius)', background: data.theme_color || '#7C3AED', border: '1px solid var(--border)' }} /></div></div>
                <div className="form-group"><label className="form-label">Logo URL</label><input className="form-control" value={data.logo_url} onChange={e => setData(d => ({ ...d, logo_url: e.target.value }))} /></div>
              </div>
            </div>
          </div>

          <div className="card animate-fade-in stagger-2" style={{ marginTop: 24 }}>
            <div className="card-header"><h4><Shield size={18} style={{ verticalAlign: 'middle' }} /> Security & Governance</h4></div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={data.mfa_enabled} onChange={e => setData(d => ({ ...d, mfa_enabled: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                  <div><div style={{ fontWeight: 600 }}>Enforce MFA</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Require multi-factor authentication for all users</div></div>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={data.sso_enabled} onChange={e => setData(d => ({ ...d, sso_enabled: e.target.checked }))} style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                  <div><div style={{ fontWeight: 600 }}>SSO Integration</div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enable Google/Microsoft OAuth logins</div></div>
                </label>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 32, textAlign: 'right' }}>
            <button type="submit" className="btn btn-shimmer btn-lg" disabled={saving}><Save size={18} /> {saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
