import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Plus,
  ArrowRight,
  MapPin
} from 'lucide-react';

import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

import AddEmployeeModal from './AddEmployeeModal';
import HasPermission from '../../../components/common/HasPermission';

const STATUS_COLORS = {
  Active: '#10B981',
  'Notice Period': '#F59E0B',
  Exited: '#F43F5E',
};

export default function EmployeeDirectory() {

  const navigate = useNavigate();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterTeam, setFilterTeam] = useState('All');

  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchEmployees();
    
  }, []);

  const fetchEmployees = async () => {

    try {

      setLoading(true);

      const res = await fetch('/api/employees', {
  credentials: 'include'
});

const data = await res.json();

console.log("RAW EMPLOYEE RESPONSE:", data);

let employeeList = [];

if (Array.isArray(data)) {
  employeeList = data;
}
else if (Array.isArray(data.employees)) {
  employeeList = data.employees;
}
else if (Array.isArray(data.data)) {
  employeeList = data.data;
}
else if (Array.isArray(data.results)) {
  employeeList = data.results;
}
else {
  console.error("UNKNOWN EMPLOYEE SHAPE:", data);
}

console.log("FINAL EMPLOYEE LIST:", employeeList);

setEmployees(employeeList);

    } catch (e) {

      console.error(e);
      toast.error('Failed to load personnel');

    } finally {

      setLoading(false);

    }
  };

  const filtered = employees.filter((e) => {

    const employeeName =
      e.name ||
      e.full_name ||
      e.username ||
      'Unknown';

    const employeeCode =
      e.employee_code || '';
      
    const employeeEmail = 
      e.email_id || e.email || '';

    const s = search.toLowerCase();

    const matchSearch =
      employeeName.toLowerCase().includes(s) ||
      employeeCode.toLowerCase().includes(s) ||
      employeeEmail.toLowerCase().includes(s);

    const matchStatus =
      filterStatus === 'All' ||
      (e.employment_status || 'Active') === filterStatus;

    const matchTeam =
      filterTeam === 'All' ||
      (e.team || 'Unassigned') === filterTeam;

    return (
      matchSearch &&
      matchStatus &&
      matchTeam
    );
  });

  const teams = [
    'All',
    ...new Set(
      employees
        .map(e => e.team)
        .filter(Boolean)
    )
  ];

  return (

    <div className="space-y-8">

      {/* HERO */}

      <div className="rounded-[2.5rem] border border-[#ebe7ff] bg-[#f7f3ff] px-10 py-10">

        <p className="text-[11px] uppercase tracking-[0.35em] font-black text-[#7c3aed] mb-4">
          Personnel Management
        </p>

        <h1 className="text-6xl font-black tracking-tight text-black">
          Employee Directory
        </h1>

      </div>

      {/* TOOLBAR */}

      <div className="flex flex-col xl:flex-row gap-4 justify-between">

        <div className="flex flex-col md:flex-row gap-4 flex-1">

          {/* SEARCH */}

          <div className="relative flex-1 max-w-md">

            <Search
              size={16}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-black/30"
            />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personnel..."
              className="
                w-full
                pl-12
                pr-5
                py-4
                rounded-2xl
                border
                border-[#ece6ff]
                bg-white
                text-black
                text-sm
                font-semibold
                outline-none
                focus:border-[#8b5cf6]
              "
            />

          </div>

          {/* STATUS */}

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="
              px-5
              py-4
              rounded-2xl
              border
              border-[#ece6ff]
              bg-white
              text-black
              text-sm
              font-bold
              outline-none
            "
          >

            {[
              'All',
              'Active',
              'Notice Period',
              'Exited'
            ].map((s) => (

              <option key={s} value={s}>
                {s}
              </option>

            ))}

          </select>

          {/* TEAM */}

          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="
              px-5
              py-4
              rounded-2xl
              border
              border-[#ece6ff]
              bg-white
              text-black
              text-sm
              font-bold
              outline-none
            "
          >

            {teams.map((t) => (

              <option key={t} value={t}>
                {t}
              </option>

            ))}

          </select>

        </div>

        {/* BUTTON */}

        <HasPermission permission="deploy.employees.create">

          <button
            onClick={() => setShowAddModal(true)}
            className="
              px-7
              py-4
              rounded-2xl
              bg-gradient-to-r
              from-[#8b5cf6]
              to-[#c084fc]
              text-white
              text-sm
              font-black
              tracking-wide
              flex
              items-center
              gap-3
              shadow-lg
              shadow-purple-200
            "
          >

            <Plus size={16} />

            Add Personnel

          </button>

        </HasPermission>

      </div>

      {/* STATS */}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-5">

        {[
          {
            label: 'Total',
            count: employees.length,
            color: '#8B5CF6'
          },
          {
            label: 'Active',
            count: employees.filter(e =>
              (e.employment_status || 'Active') === 'Active'
            ).length,
            color: '#10B981'
          },
          {
            label: 'Notice',
            count: employees.filter(e =>
              e.employment_status === 'Notice Period'
            ).length,
            color: '#F59E0B'
          },
          {
            label: 'Exited',
            count: employees.filter(e =>
              e.employment_status === 'Exited'
            ).length,
            color: '#EF4444'
          },
          {
            label: 'Teams',
            count: new Set(
              employees.map(e => e.team).filter(Boolean)
            ).size,
            color: '#3B82F6'
          },
          {
            label: 'Results',
            count: filtered.length,
            color: '#06B6D4'
          },
        ].map((s, i) => (

          <div
            key={i}
            className="
              bg-white
              border
              border-[#ebe7ff]
              rounded-[2rem]
              p-6
            "
          >

            <p
              className="text-4xl font-black"
              style={{ color: s.color }}
            >
              {s.count}
            </p>

            <p className="mt-2 text-[11px] uppercase tracking-[0.3em] font-black text-black/50">
              {s.label}
            </p>

          </div>

        ))}

      </div>

      {/* TABLE */}

      <div className="overflow-hidden rounded-[2rem] border border-[#ebe7ff] bg-white">

        {loading ? (

          <div className="flex items-center justify-center h-52">

            <div className="w-10 h-10 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />

          </div>

        ) : filtered.length === 0 ? (

          <div className="flex flex-col items-center justify-center h-52 gap-5">

            <Users size={48} className="text-black/10" />

            <p className="text-sm font-bold text-black/40">
              No personnel found
            </p>

          </div>

        ) : (

          <table className="w-full">

            <thead className="bg-[#f7f3ff] border-b border-[#ebe7ff]">

              <tr>

                {[
                  'Employee',
                  'Designation',
                  'Department',
                  'Location',
                  'Status',
                  'Actions'
                ].map((h) => (

                  <th
                    key={h}
                    className="
                      px-8
                      py-6
                      text-left
                      text-[11px]
                      uppercase
                      tracking-[0.25em]
                      font-black
                      text-black/50
                    "
                  >
                    {h}
                  </th>

                ))}

              </tr>

            </thead>

            <tbody>

              {filtered.map((emp, i) => {

                const employeeName =
                  emp.name ||
                  emp.full_name ||
                  emp.username ||
                  'Unknown';

                return (

                  <tr
                    key={emp.employee_code || i}
                    className="
                      border-b
                      border-[#f1ecff]
                      hover:bg-[#faf7ff]
                      transition-all
                      cursor-pointer
                    "
                    onClick={() =>
                      navigate(`/deploy?tab=profile&code=${emp.employee_code}`)
                    }
                  >

                    {/* EMPLOYEE */}

                    <td className="px-8 py-6">

                      <div className="flex items-center gap-4">

                        <div className="
                          w-14
                          h-14
                          rounded-2xl
                          overflow-hidden
                          border
                          border-[#e9ddff]
                          bg-[#f5edff]
                          flex
                          items-center
                          justify-center
                          font-black
                          text-[#7c3aed]
                          text-lg
                        ">

                          {emp.photo_path ? (

                            <img
                              src={emp.photo_path.startsWith('http') ? emp.photo_path : `/${emp.photo_path.replace(/^\//, '')}`}
                              alt=""
                              className="w-full h-full object-cover"
                            />

                          ) : (

                            employeeName?.[0]?.toUpperCase()

                          )}

                        </div>

                        <div>

                          <p className="text-base font-black text-black">
                            {employeeName}
                          </p>

                          <p className="text-xs text-black/40 font-bold mt-1">
                            {emp.employee_code}
                          </p>

                        </div>

                      </div>

                    </td>

                    {/* DESIGNATION */}

                    <td className="px-8 py-6 text-sm text-black/70 font-semibold">
                      {emp.designation || '—'}
                    </td>

                    {/* TEAM */}

                    <td className="px-8 py-6 text-sm text-black/70 font-semibold">
                      {emp.team || '—'}
                    </td>

                    {/* LOCATION */}

                    <td className="px-8 py-6 text-sm text-black/50">

                      <div className="flex items-center gap-2">

                        <MapPin size={14} />

                        {emp.location || '—'}

                      </div>

                    </td>

                    {/* STATUS */}

                    <td className="px-8 py-6">

                      <span
                        className="
                          px-4
                          py-2
                          rounded-full
                          text-[11px]
                          uppercase
                          font-black
                          tracking-[0.15em]
                        "
                        style={{
                          background: `${STATUS_COLORS[emp.employment_status || 'Active']}15`,
                          color: STATUS_COLORS[emp.employment_status || 'Active'],
                          border: `1px solid ${STATUS_COLORS[emp.employment_status || 'Active']}30`
                        }}
                      >

                        {emp.employment_status || 'Active'}

                      </span>

                    </td>

                    {/* ACTION */}

                    <td className="px-8 py-6">

                      <button className="
                        flex
                        items-center
                        gap-2
                        text-[#7c3aed]
                        font-black
                        text-sm
                      ">

                        Open

                        <ArrowRight size={15} />

                      </button>

                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        )}

      </div>

      {/* MODAL */}

      {showAddModal && (

        <AddEmployeeModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            fetchEmployees();
          }}
        />

      )}

    </div>
  );
}
