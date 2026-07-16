import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Users,
  Activity,
  TrendingUp,
  Briefcase,
  Clock,
  RefreshCw,
  AlertCircle,
  MapPin
} from 'lucide-react';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend
} from 'recharts';

const PALETTE = [
  '#8B5CF6', // primary lilac
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#3B82F6', // blue
  '#EC4899', // pink
  '#6366F1'  // indigo
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="bg-white border border-[#ebe4ff] rounded-2xl px-4 py-3 shadow-xl">
      <p className="text-[10px] font-black uppercase tracking-widest text-black/40 mb-2">
        {label}
      </p>

      {payload.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-2 text-sm font-bold"
          style={{ color: p.color || p.fill }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span>{p.name}:</span>
          <span className="text-black">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const StatCard = ({ label, value, color, icon: Icon, sub }) => (
  <div className="bg-white border border-[#ebe4ff] rounded-[2rem] p-6 shadow-[0_10px_40px_rgba(180,140,255,0.08)] relative overflow-hidden">
    <div
      className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
      style={{
        background: `${color}15`,
        border: `1px solid ${color}25`
      }}
    >
      <Icon size={20} style={{ color }} />
    </div>

    <h3
      className="text-5xl font-black leading-none mb-3"
      style={{ color }}
    >
      {value}
    </h3>

    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-black/50">
      {label}
    </p>

    {sub && (
      <p className="text-[9px] text-black/30 mt-2 uppercase tracking-widest">
        {sub}
      </p>
    )}
  </div>
);

const ChartCard = ({ title, children, className = '' }) => (
  <div
    className={`
      bg-white
      border
      border-[#ebe4ff]
      rounded-[2rem]
      p-8
      shadow-[0_10px_40px_rgba(180,140,255,0.08)]
      flex
      flex-col
      gap-6
      ${className}
    `}
  >
    <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7c3aed]">
      {title}
    </h3>

    <div className="w-full" style={{ height: 320, minHeight: 0 }}>
      {children}
    </div>
  </div>
);

export default function DeployAnalytics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchStats = async () => {
    setLoading(true);

    try {
      const res = await fetch('/api/dashboard/stats', {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`API Error ${res.status}`);
      }

      const data = await res.json();

      setStats(data);
      setLastRefresh(new Date());
    } catch (e) {
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-12 h-12 border-4 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#7c3aed]">
          Loading Analytics
        </p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle size={40} className="text-[#7c3aed]" />

        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-black/40">
          Analytics unavailable
        </p>
      </div>
    );
  }

  const { counts = {}, charts = {}, recent_hires = [] } = stats;

  const departmentData = charts.department || [];
  const statusData = charts.status || [];

  const hiringTrend = (charts.hiring_trend || []).map(h => ({
    name: String(h.Year || h.name),
    value: h.Hires || h.value || 0
  }));

  const skillsData = charts.skills || [];

  const experienceData = (charts.experience || []).map(e => ({
    name: e.range || e.name,
    value: e.count || e.value || 0
  }));

  const tenureData = (charts.tenure || []).map(t => ({
    name: t.range || t.name,
    value: t.count || t.value || 0
  }));

  const locationData = charts.location || [];

  return (
    <div className="space-y-8 animate-fade-in-up">

      {/* HEADER */}

      <div className="bg-[#f6f0ff] border border-[#ebe4ff] rounded-[2.5rem] p-10">
        <div className="flex justify-between items-end flex-wrap gap-6">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#7c3aed] mb-3">
              Organisation Analytics
            </p>

            <h1 className="text-5xl font-black text-black tracking-tight leading-none">
              Workforce Analytics
            </h1>

            <p className="text-black/40 mt-5 text-lg">
              Live operational metrics, employee overview, onboarding health and organisation activity.
            </p>
          </div>

          <div className="flex items-center gap-4">

            {lastRefresh && (
              <p className="text-[10px] font-black uppercase tracking-widest text-black/40">
                Updated {lastRefresh.toLocaleTimeString()}
              </p>
            )}

            <button
              onClick={fetchStats}
              className="
                px-6
                py-4
                rounded-2xl
                bg-black
                text-white
                text-[10px]
                font-black
                uppercase
                tracking-[0.3em]
                flex
                items-center
                gap-3
                hover:opacity-90
                transition-all
              "
            >
              <RefreshCw size={14} />
              Refresh
            </button>

          </div>
        </div>
      </div>

      {/* KPI */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        <StatCard
          label="Employees"
          value={counts.total ?? 0}
          color="#7C3AED"
          icon={Users}
        />

        <StatCard
          label="Departments"
          value={counts.teams ?? 0}
          color="#8B5CF6"
          icon={Briefcase}
        />

        <StatCard
          label="Attendance"
          value={`${counts.active ?? 0}%`}
          color="#A855F7"
          icon={Clock}
        />

        <StatCard
          label="Active Assets"
          value={counts.designations ?? 0}
          color="#9333EA"
          icon={Activity}
        />

      </div>

      {/* ROW 1 */}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        <ChartCard title="Employment Status">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>

              <Pie
                data={statusData}
                dataKey="value"
                nameKey="name"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={4}
              >
                {statusData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PALETTE[i % PALETTE.length]}
                  />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#000'
                }}
              />

            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Hiring Trend"
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={hiringTrend}>

              <defs>
                <linearGradient id="purpleGradient">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                dataKey="name"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'dataMax + 1']}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Area
                type="monotone"
                dataKey="value"
                stroke="#7c3aed"
                strokeWidth={4}
                fill="url(#purpleGradient)"
              />

            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ROW 2 */}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        <ChartCard
          title="Department Distribution"
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={departmentData}
              layout="vertical"
            >

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                type="number"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                dataKey="name"
                type="category"
                width={120}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar
                dataKey="value"
                radius={[0, 8, 8, 0]}
              >
                {departmentData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PALETTE[i % PALETTE.length]}
                  />
                ))}
              </Bar>

            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Location Distribution">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>

              <Pie
                data={locationData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
              >
                {locationData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PALETTE[i % PALETTE.length]}
                  />
                ))}
              </Pie>

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{
                  fontSize: '11px',
                  fontWeight: 700
                }}
              />

            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ROW 3 */}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        <ChartCard title="Top Skills">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={skillsData}>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                dataKey="name"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'dataMax + 1']}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar dataKey="value">
                {skillsData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PALETTE[i % PALETTE.length]}
                  />
                ))}
              </Bar>

            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Experience">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={experienceData}>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                dataKey="name"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'dataMax + 1']}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar
                dataKey="value"
                fill="#8B5CF6"
                radius={[6, 6, 0, 0]}
              />

            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Tenure">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={tenureData}>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(124,58,237,0.08)"
              />

              <XAxis
                dataKey="name"
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <YAxis
                allowDecimals={false}
                domain={[0, 'dataMax + 1']}
                stroke="rgba(0,0,0,0.35)"
                fontSize={10}
                fontWeight={900}
                tickLine={false}
                axisLine={false}
              />

              <Tooltip content={<CustomTooltip />} />

              <Bar
                dataKey="value"
                fill="#7C3AED"
                radius={[6, 6, 0, 0]}
              />

            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* TABLE */}

      <div className="bg-white border border-[#ebe4ff] rounded-[2rem] overflow-hidden shadow-[0_10px_40px_rgba(180,140,255,0.08)]">

        <div className="px-8 py-6 border-b border-[#ebe4ff] flex items-center justify-between">
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-[#7c3aed]">
              Recent Hires
            </h3>

            <p className="text-black/40 mt-2">
              Latest onboarding activity
            </p>
          </div>

          <div className="px-4 py-2 rounded-full bg-[#f3e8ff] text-[#7c3aed] text-[10px] font-black uppercase tracking-[0.2em]">
            {recent_hires.length} Records
          </div>
        </div>

        <table className="w-full">

          <thead className="bg-[#faf7ff]">
            <tr>
              {[
                'Employee',
                'Department',
                'Designation',
                'Location',
                'Status',
                'Joined'
              ].map(h => (
                <th
                  key={h}
                  className="px-8 py-5 text-left text-[10px] font-black uppercase tracking-[0.25em] text-black/40"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>

            {recent_hires.map((h, i) => (
              <tr
                key={i}
                className="border-t border-[#f3efff] hover:bg-[#faf7ff] transition-colors"
              >

                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">

                    <div className="w-10 h-10 rounded-xl bg-[#f3e8ff] border border-[#e9d5ff] flex items-center justify-center font-black text-[#7c3aed]">
                      {h.name?.[0] || 'A'}
                    </div>

                    <p className="font-bold text-black">
                      {h.name}
                    </p>

                  </div>
                </td>

                <td className="px-8 py-5 text-black/60">
                  {h.team || '—'}
                </td>

                <td className="px-8 py-5 text-black/60">
                  {h.designation || '—'}
                </td>

                <td className="px-8 py-5 text-black/50">
                  <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    {h.location || '—'}
                  </div>
                </td>

                <td className="px-8 py-5">
                  <span className="px-4 py-2 rounded-full bg-[#f3e8ff] text-[#7c3aed] text-[10px] font-black uppercase tracking-[0.2em]">
                    {h.employment_status || 'Active'}
                  </span>
                </td>

                <td className="px-8 py-5 text-black/50 font-mono">
                  {h.doj_str || h.doj || '—'}
                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </div>
  );
}
