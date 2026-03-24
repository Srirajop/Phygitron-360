import React, { useEffect, useState } from 'react';
import { forgeApi } from '../../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Award, BookOpen } from 'lucide-react';

export default function TeamAnalytics() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    forgeApi.teamAnalytics().then(r => setData(r.data.data || [])).finally(() => setLoading(false));
  }, []);

  const chartData = data.map(d => ({ name: d.name?.split(' ')[0], enrolled: d.enrolled, completed: d.completed, certs: d.certificates }));

  return (
    <div>
      <div className="page-header"><h1>Team Learning Analytics</h1><p>Track your team's learning progress</p></div>
      <div className="page-body">
        {loading ? <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner spinner-lg" /></div> : (<>
          <div className="stats-grid animate-fade-in">
            {[
              { label: 'Team Members', value: data.length, icon: <Users size={18} /> },
              { label: 'Total Enrolled', value: data.reduce((s, d) => s + d.enrolled, 0), icon: <BookOpen size={18} /> },
              { label: 'Total Certs', value: data.reduce((s, d) => s + d.certificates, 0), icon: <Award size={18} /> },
            ].map((s, i) => (
              <div key={i} className={`stat-card animate-fade-in stagger-${i+1}`}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {chartData.length > 0 && (
            <div className="card animate-fade-in" style={{ marginBottom: 24 }}>
              <div className="card-header"><h4>Team Learning Progress</h4></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="enrolled" fill="#A855F7" name="Enrolled" radius={[4,4,0,0]} />
                    <Bar dataKey="completed" fill="#10B981" name="Completed" radius={[4,4,0,0]} />
                    <Bar dataKey="certs" fill="#F59E0B" name="Certificates" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card animate-fade-in">
            <div className="table-container">
              <table>
                <thead><tr><th>Name</th><th>Department</th><th>Enrolled</th><th>Completed</th><th>Certificates</th></tr></thead>
                <tbody>
                  {data.map((d, i) => (
                    <tr key={i}><td style={{ fontWeight: 600 }}>{d.name}</td><td>{d.department || '—'}</td>
                      <td>{d.enrolled}</td><td>{d.completed}</td>
                      <td><span className="badge badge-primary">{d.certificates}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>)}
      </div>
    </div>
  );
}
