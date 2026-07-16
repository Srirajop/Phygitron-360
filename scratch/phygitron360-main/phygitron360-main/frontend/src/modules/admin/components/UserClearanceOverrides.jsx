import React from 'react';
import { Shield, X, Check, Activity } from 'lucide-react';
import { PERMISSIONS_CATEGORIES } from './ClearanceMatrix';

export default function UserClearanceOverrides({
  user,
  overrides,
  onUpdate,
  onClose
}) {

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md p-6">
      <div
        className="
          w-full
          max-w-5xl
          max-h-[92vh]
          overflow-hidden
          rounded-[2.8rem]
          border
          border-[#e9e2fb]
          bg-[#faf8ff]
          shadow-[0_35px_100px_rgba(120,80,255,0.18)]
          animate-fade-in-up
          flex
          flex-col
        "
      >
        {/* HEADER */}
        <div
          className="
            px-10
            py-8
            border-b
            border-[#ece7fa]
            bg-gradient-to-r
            from-[#ffffff]
            to-[#f6f1ff]
            flex
            justify-between
            items-start
            gap-6
          "
        >
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="
                  w-10
                  h-10
                  rounded-2xl
                  bg-gradient-to-br
                  from-[#c084fc]
                  to-[#8b5cf6]
                  flex
                  items-center
                  justify-center
                  text-white
                  shadow-[0_10px_25px_rgba(180,140,255,0.35)]
                "
              >
                <Shield size={18} />
              </div>
              <p
                className="
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.35em]
                  text-[#8b5cf6]
                "
              >
                Permission Override Center
              </p>
            </div>

            <h3
              className="
                text-4xl
                font-bold
                tracking-tight
                text-black
              "
            >
              User Access Controls
            </h3>

            <p
              className="
                mt-3
                text-[15px]
                text-gray-500
                font-normal
                leading-relaxed
              "
            >
              Adjust permissions specifically for
              <span className="font-semibold text-black">
                {' '}@{user.username}
              </span>
            </p>
          </div>

          <button
            onClick={onClose}
            className="
              px-6
              py-3
              rounded-2xl
              bg-black
              text-white
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.25em]
              hover:bg-[#8b5cf6]
              transition-all
              duration-300
              active:scale-95
            "
          >
            Close
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto px-10 py-10 space-y-12">
          {PERMISSIONS_CATEGORIES.map(cat => (
            <div key={cat.group} className="space-y-6">
              {/* SECTION HEADER */}
              <div className="flex items-center gap-5">
                <h4
                  className="
                    text-[11px]
                    font-semibold
                    uppercase
                    tracking-[0.35em]
                    text-[#8b5cf6]
                    whitespace-nowrap
                  "
                >
                  {cat.group}
                </h4>
                <div className="h-px bg-[#e8e2f7] flex-1" />
              </div>

              {/* GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {cat.perms.map(p => {
                  const overrideValue = overrides[p.key];
                  const isOverridden =
                    overrideValue !== undefined &&
                    overrideValue !== null;

                  return (
                    <div
                      key={p.key}
                      className={`
                        rounded-[2rem]
                        border
                        p-6
                        transition-all
                        duration-300
                        flex
                        items-center
                        justify-between
                        gap-6
                        ${
                          isOverridden
                            ? 'bg-[#f7f1ff] border-[#d9c8ff] shadow-[0_10px_30px_rgba(180,140,255,0.08)]'
                            : 'bg-white border-[#ece7fa]'
                        }
                      `}
                    >
                      {/* LEFT */}
                      <div className="space-y-2">
                        <p
                          className={`
                            text-[15px]
                            font-semibold
                            tracking-tight
                            ${
                              isOverridden
                                ? 'text-[#8b5cf6]'
                                : 'text-black'
                            }
                          `}
                        >
                          {p.label}
                        </p>
                        <p
                          className="
                            text-[10px]
                            uppercase
                            tracking-[0.15em]
                            text-slate-500
                            font-normal
                            font-mono
                          "
                        >
                          {p.key}
                        </p>
                      </div>

                      {/* BUTTONS */}
                      <div
                        className="
                          flex
                          gap-2
                          p-2
                          rounded-2xl
                          bg-[#f5f1fd]
                          border
                          border-[#ebe5fa]
                        "
                      >
                        {/* ALLOW */}
                        <button
                          onClick={() =>
                            onUpdate(user.id, p.key, true)
                          }
                          className={`
                            w-11
                            h-11
                            rounded-xl
                            flex
                            items-center
                            justify-center
                            transition-all
                            duration-300
                            ${
                              overrideValue === true
                                ? `
                                  bg-gradient-to-br
                                  from-[#c084fc]
                                  to-[#8b5cf6]
                                  text-white
                                  shadow-[0_10px_25px_rgba(180,140,255,0.35)]
                                `
                                : `
                                  bg-white
                                  border
                                  border-[#ebe5fa]
                                  text-[#8b5cf6]
                                  hover:bg-[#f4efff]
                                `
                            }
                          `}
                          title="Allow"
                        >
                          <Check size={16} strokeWidth={3} />
                        </button>

                        {/* BLOCK */}
                        <button
                          onClick={() =>
                            onUpdate(user.id, p.key, false)
                          }
                          className={`
                            w-11
                            h-11
                            rounded-xl
                            flex
                            items-center
                            justify-center
                            transition-all
                            duration-300
                            ${
                              overrideValue === false
                                ? `
                                  bg-black
                                  text-white
                                  shadow-[0_10px_25px_rgba(0,0,0,0.15)]
                                `
                                : `
                                  bg-white
                                  border
                                  border-[#ebe5fa]
                                  text-black
                                  hover:bg-[#f3f4f6]
                                `
                            }
                          `}
                          title="Block"
                        >
                          <X size={16} strokeWidth={3} />
                        </button>

                        {/* DEFAULT */}
                        <button
                          onClick={() =>
                            onUpdate(user.id, p.key, null)
                          }
                          className={`
                            w-11
                            h-11
                            rounded-xl
                            flex
                            items-center
                            justify-center
                            transition-all
                            duration-300
                            ${
                              !isOverridden
                                ? `
                                  bg-[#8b5cf6]
                                  text-white
                                  shadow-[0_10px_25px_rgba(180,140,255,0.35)]
                                `
                                : `
                                  bg-white
                                  border
                                  border-[#ebe5fa]
                                  text-gray-500
                                  hover:bg-[#f3f4f6]
                                `
                            }
                          `}
                          title="Default"
                        >
                          <Activity size={16} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* FOOTER */}
        <div
          className="
            px-10
            py-7
            border-t
            border-[#ece7fa]
            bg-gradient-to-r
            from-[#ffffff]
            to-[#f7f2ff]
            flex
            items-center
            justify-between
            gap-6
            flex-wrap
          "
        >
          <div className="flex items-center gap-3">
            <Shield className="text-[#8b5cf6]" size={18} />
            <p
              className="
                text-[11px]
                uppercase
                tracking-[0.2em]
                font-semibold
                text-gray-500
              "
            >
              Custom user permissions override role defaults
            </p>
          </div>

          <p
            className="
              text-[10px]
              uppercase
              tracking-[0.3em]
              font-semibold
              text-[#8b5cf6]
            "
          >
            Security Layer Active
          </p>
        </div>
      </div>
    </div>
  );
}