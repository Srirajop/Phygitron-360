import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { verifyApi } from '../../api';
import { Trophy, Medal, Award } from 'lucide-react';

export default function Leaderboard() {
  const { id } = useParams();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    verifyApi.leaderboard(id).then(r => setData(r.data.data || [])).finally(() => setLoading(false));
  }, [id]);

  const RANK_ICONS = { 1: <Trophy size={20} color="#F59E0B" />, 2: <Medal size={20} color="#9CA3AF" />, 3: <Award size={20} color="#CD7F32" /> };

  return (
    <div>
      <div className="page-header"><h1>🏆 Leaderboard</h1><p>See how you rank against other participants</p></div>
      <div className="page-body">
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div> : (
          <div className="card animate-fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="table-container">
              <table>
                <thead><tr><th>Rank</th><th>Name</th><th>Score</th><th>Status</th></tr></thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className={`animate-fade-in stagger-${Math.min(i+1,5)}`} style={{ background: row.is_me ? 'var(--primary-lightest)' : '' }}>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{RANK_ICONS[row.rank] || <span style={{ fontWeight: 700, color: 'var(--text-muted)', width: 20, textAlign: 'center' }}>{row.rank}</span>}</div></td>
                      <td style={{ fontWeight: row.is_me ? 700 : 400 }}>{row.name} {row.is_me ? <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>You</span> : ''}</td>
                      <td style={{ fontWeight: 700, color: row.pass_status ? 'var(--success)' : 'var(--danger)' }}>{row.score.toFixed(1)}%</td>
                      <td><span className={`badge ${row.pass_status ? 'badge-success' : 'badge-danger'}`}>{row.pass_status ? 'Pass' : 'Fail'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
