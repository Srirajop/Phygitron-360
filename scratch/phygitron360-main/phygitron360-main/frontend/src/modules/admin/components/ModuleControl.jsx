import React from 'react';
import { Activity, Zap, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ModuleControl({ tenantOps, onUpdate }) {

  const toggleModule = async (module) => {
    const current = tenantOps.modules_enabled || [];

    const updated = current.includes(module)
      ? current.filter(m => m !== module)
      : [...current, module];

    try {
      const res = await fetch('/api/admin/tenants/current/ops', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules_enabled: updated })
      });

      if (!res.ok) throw new Error();

      onUpdate({
        ...tenantOps,
        modules_enabled: updated
      });

      toast.success(`${module.toUpperCase()} workspace updated`);

    } catch {
      toast.error('Workspace sync failed');
    }
  };

  const MODULES = [
    {
      id: 'source',
      label: 'Source',
      desc: 'Hiring & candidate management'
    },
    {
      id: 'forge',
      label: 'Forge',
      desc: 'Training & skill development'
    },
    {
      id: 'verify',
      label: 'Verify',
      desc: 'Assessments & validation tools'
    },
    {
      id: 'deploy',
      label: 'Deploy',
      desc: 'Employees & workspace operations'
    },
  ];

  return (
    <div className="space-y-10 animate-fade-in-up">

      {/* MODULE GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-7">

        {MODULES.map(m => {
          const isActive = tenantOps.modules_enabled.includes(m.id);

          return (
            <div
              key={m.id}
              className={`
                rounded-[2.5rem]
                border
                overflow-hidden
                transition-all
                duration-500
                group
                ${
                  isActive
                    ? 'bg-white border-primary/20 shadow-[0_20px_60px_rgba(180,140,255,0.08)]'
                    : 'bg-[#f4f1fb] border-[#ebe5fa]'
                }
              `}
            >

              {/* TOP */}
              <div className="p-8 flex flex-col gap-8">
                <div
                  className={`
                    w-14 h-14 rounded-2xl flex items-center justify-center transition-all
                    ${
                      isActive
                        ? 'bg-gradient-to-br from-[#c084fc] to-[#8b5cf6] text-white shadow-[0_10px_30px_rgba(180,140,255,0.35)]'
                        : 'bg-white text-[#8f96aa] border border-[#ece7fa]'
                    }
                  `}
                >
                  <Activity
                    size={24}
                    className={isActive ? 'animate-pulse' : ''}
                  />
                </div>

                <div>
                  {/* Title changed from font-black to font-bold */}
                  <h4 className="text-[1.4rem] font-bold uppercase tracking-tight text-black">
                    {m.label}
                  </h4>

                  {/* Secondary text changed to neutral text-slate-500 and font-medium */}
                  <p className="mt-3 text-[11px] uppercase tracking-[0.18em] leading-relaxed font-medium text-slate-500">
                    {m.desc}
                  </p>
                </div>
              </div>

              {/* STATUS */}
              <div className="px-8 pb-8 flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  {/* Sub-status tag adjusted to font-semibold */}
                  <span
                    className={`
                      text-[10px]
                      font-semibold
                      uppercase
                      tracking-[0.25em]
                      ${isActive ? 'text-[#8b5cf6]' : 'text-gray-500'}
                    `}
                  >
                    {isActive ? 'ACTIVE' : 'DISABLED'}
                  </span>

                  <div
                    className={`
                      w-3 h-3 rounded-full
                      ${
                        isActive
                          ? 'bg-[#8b5cf6] shadow-[0_0_20px_rgba(180,140,255,0.6)]'
                          : 'bg-[#d6d3df]'
                      }
                    `}
                  />
                </div>

                {/* Primary Button text weight changed from font-black to font-semibold */}
                <button
                  onClick={() => toggleModule(m.id)}
                  className={`
                    w-full
                    py-4
                    rounded-2xl
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.28em]
                    transition-all
                    duration-300
                    active:scale-95
                    ${
                      isActive
                        ? `
                          bg-[#f4efff]
                          border
                          border-[#d8c7ff]
                          text-[#8b5cf6]
                          hover:bg-[#8b5cf6]
                          hover:text-white
                        `
                        : `
                          bg-black
                          text-white
                          hover:bg-[#8b5cf6]
                        `
                    }
                  `}
                >
                  {isActive ? 'Disable Module' : 'Enable Module'}
                </button>
              </div>

            </div>
          );
        })}

      </div>

      {/* BOTTOM PANEL */}
      <div
        className="
          relative
          overflow-hidden
          rounded-[2.8rem]
          border
          border-primary/15
          bg-gradient-to-br
          from-[#ffffff]
          to-[#f4efff]
          p-12
          shadow-[0_25px_80px_rgba(180,140,255,0.08)]
        "
      >
        <div
          className="
            absolute
            top-0
            right-0
            p-8
            text-primary
            opacity-10
          "
        >
          <ShieldCheck
            size={140}
            strokeWidth={0.5}
          />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-10 flex-wrap">
          <div className="space-y-5 max-w-3xl">
            <div className="flex items-center gap-3">
              <Zap
                size={18}
                className="text-[#8b5cf6]"
              />

              {/* Title adjusted to font-bold */}
              <h3 className="text-2xl font-bold uppercase tracking-tight text-[#8b5cf6] italic">
                Workspace Controls
              </h3>
            </div>

            {/* Description converted to font-normal neutral text-slate-500 */}
            <p className="text-[15px] leading-[1.9] font-normal text-slate-500">
              Turning modules on or off updates access instantly across the workspace.
              Disabled modules become unavailable to standard users while administrator
              access remains protected.
            </p>
          </div>

          <div
            className="
              px-8
              py-5
              rounded-3xl
              bg-black
              shadow-[0_15px_40px_rgba(0,0,0,0.15)]
            "
          >
            {/* Tag adjusted to font-semibold and crisp branding color alignment */}
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-[#c084fc]">
              Workspace Mode : Enterprise
            </p>
          </div>
        </div>

      </div>

    </div>
  );
}