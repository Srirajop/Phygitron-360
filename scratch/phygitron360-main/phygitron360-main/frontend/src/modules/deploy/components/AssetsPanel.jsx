import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Package,
  CheckCircle,
  XCircle,
  Laptop,
  ShieldCheck
} from 'lucide-react';

const ASSET_LABELS = {
  ob_laptop: 'Laptop',
  ob_laptop_bag: 'Laptop Bag',
  ob_headphones: 'Headphones',
  ob_mouse: 'Mouse',
  ob_extra_hardware: 'Extra Hardware',
  ob_client_assets: 'Client Assets',
  ob_id_card: 'ID Card',
  ob_email_access: 'Email Access',
  ob_groups: 'Groups Access',
  ob_mediclaim: 'Mediclaim',
  ob_pf: 'PF',
};

const CLEARANCE_LABELS = {
  cl_laptop: 'Laptop Returned',
  cl_laptop_bag: 'Bag Returned',
  cl_headphones: 'Headphones Returned',
  cl_mouse: 'Mouse Returned',
  cl_extra_hardware: 'Extra Hardware Returned',
  cl_client_assets: 'Client Assets Verified',
  cl_id_card: 'ID Card Returned',
  cl_email_access: 'Email Disabled',
  cl_groups: 'Access Removed',
  cl_relieving_letter: 'Relieving Letter',
};

export default function AssetsPanel({ mode = 'admin', user }) {

  const [employees, setEmployees] = useState([]);

  const [selectedCode, setSelectedCode] = useState('');

  const [assets, setAssets] = useState(null);

  const [loading, setLoading] = useState(false);

  const [saving, setSaving] = useState(false);

  /* =========================
     LOAD EMPLOYEES
  ========================= */

  useEffect(() => {

    const loadEmployees = async () => {

      try {

        const res = await fetch('/api/employees', {
          credentials: 'include'
        });

        const data = await res.json();

        const employeeList =
          Array.isArray(data) ? data : [];

        setEmployees(employeeList);

        /* =========================
           EMPLOYEE VIEW FIX
           auto-load own assets
        ========================= */

        if (
          mode === 'employee' &&
          user?.employee_code
        ) {

          loadAssets(user.employee_code);

        }

      } catch {

        toast.error('Failed to load employees');

      }

    };

    loadEmployees();

  }, []);

  /* =========================
     LOAD ASSETS
  ========================= */

  const loadAssets = async (code) => {

    setSelectedCode(code);

    if (!code) {
      setAssets(null);
      return;
    }

    setLoading(true);

    try {

      const res = await fetch(
        `/api/assets/${code}`,
        { credentials: 'include' }
      );

      const data = await res.json();

      setAssets(data);

    } catch {

      toast.error('Failed to load assets');

    } finally {

      setLoading(false);

    }
  };

  /* =========================
     TOGGLE
  ========================= */

  const toggleAsset = (field) => {

    setAssets(prev => ({
      ...prev,
      [field]: prev[field] ? 0 : 1
    }));

  };

  /* =========================
     SAVE
  ========================= */

  const save = async () => {

    setSaving(true);

    try {

      const res = await fetch(
        `/api/assets/${selectedCode}`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(assets)
        }
      );

      if (!res.ok) {

        const data = await res.json();

        throw new Error(
          data.detail || 'Update failed'
        );
      }

      toast.success('Assets updated successfully');

    } catch (e) {

      toast.error(
        e.message || 'Update failed'
      );

    } finally {

      setSaving(false);

    }
  };

  return (

    <div className="space-y-8 animate-fade-in-up">

      {/* =========================
          HEADER CARD
      ========================= */}

      <div
        className="
          bg-gradient-to-r
          from-[#ffffff]
          via-[#faf7ff]
          to-[#f3ecff]
          border
          border-[#e8defc]
          rounded-[2.5rem]
          p-7
          shadow-[0_12px_40px_rgba(180,140,255,0.10)]
          flex
          items-center
          gap-6
        "
      >

        <div
          className="
            w-16
            h-16
            rounded-[1.7rem]
            bg-gradient-to-br
            from-[#c084fc]
            to-[#7c3aed]
            flex
            items-center
            justify-center
            shadow-[0_10px_30px_rgba(124,58,237,0.28)]
          "
        >
          <Package
            size={28}
            className="text-white"
          />
        </div>

        <div className="flex-1">

          <p
            className="
              text-[10px]
              font-black
              uppercase
              tracking-[0.28em]
              text-[#7c3aed]
              mb-3
            "
          >
            Employee Asset Management
          </p>

          <h2
            className="
              text-4xl
              font-black
              text-black
              tracking-tight
              leading-none
              mb-5
            "
          >
            {
              mode === 'employee'
                ? 'My Assets'
                : 'Assets & Permissions'
            }
          </h2>

          {/* ADMIN SELECT ONLY */}

          {mode === 'admin' && (

            <select
              value={selectedCode}
              onChange={e =>
                loadAssets(e.target.value)
              }
              className="
                w-full
                bg-[#f8f5ff]
                border
                border-[#ddd6f7]
                rounded-2xl
                px-5
                py-4
                text-black
                text-[13px]
                font-semibold
                focus:outline-none
                focus:border-[#8b5cf6]
                transition-all
              "
            >

              <option value="">
                Select employee
              </option>

              {employees.map(e => (

                <option
                  key={e.employee_code}
                  value={e.employee_code}
                >
                  {e.name} ({e.employee_code})
                </option>

              ))}

            </select>

          )}

        </div>

      </div>

      {/* =========================
          LOADER
      ========================= */}

      {loading && (

        <div className="flex items-center justify-center h-52">

          <div
            className="
              w-12
              h-12
              border-[3px]
              border-[#8b5cf6]
              border-t-transparent
              rounded-full
              animate-spin
            "
          />

        </div>

      )}

      {/* =========================
          CONTENT
      ========================= */}

      {assets && !loading && (

        <div className="space-y-8">

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

            {/* =========================
                ASSIGNED
            ========================= */}

            <div
              className="
                bg-white
                border
                border-[#ebe4ff]
                rounded-[2.5rem]
                overflow-hidden
                shadow-[0_10px_40px_rgba(180,140,255,0.08)]
              "
            >

              <div
                className="
                  px-8
                  py-6
                  bg-gradient-to-r
                  from-[#f5edff]
                  to-[#efe4ff]
                  border-b
                  border-[#ece2ff]
                  flex
                  items-center
                  gap-4
                "
              >

                <Laptop
                  size={20}
                  className="text-[#7c3aed]"
                />

                <h3
                  className="
                    text-[11px]
                    font-black
                    uppercase
                    tracking-[0.25em]
                    text-[#7c3aed]
                  "
                >
                  Assigned Assets
                </h3>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2">

                {Object.entries(ASSET_LABELS).map(([field, label]) => (

                  <button
                    key={field}
                    onClick={() =>
                      toggleAsset(field)
                    }
                    className={`
                      p-6
                      flex
                      items-center
                      gap-4
                      text-left
                      border-b
                      border-r
                      border-[#f2ecff]
                      transition-all
                      ${
                        assets[field]
                          ? 'bg-[#faf6ff]'
                          : 'bg-white hover:bg-[#faf7ff]'
                      }
                    `}
                  >

                    <div
                      className={`
                        w-11
                        h-11
                        rounded-2xl
                        flex
                        items-center
                        justify-center
                        transition-all
                        ${
                          assets[field]
                            ? 'bg-gradient-to-br from-[#a855f7] to-[#7c3aed]'
                            : 'bg-[#f3effd]'
                        }
                      `}
                    >

                      {assets[field] ? (

                        <CheckCircle
                          size={18}
                          className="text-white"
                        />

                      ) : (

                        <XCircle
                          size={18}
                          className="text-[#7c3aed]"
                        />

                      )}

                    </div>

                    <span
                      className={`
                        text-[11px]
                        font-black
                        uppercase
                        tracking-[0.12em]
                        ${
                          assets[field]
                            ? 'text-black'
                            : 'text-[#6b7280]'
                        }
                      `}
                    >
                      {label}
                    </span>

                  </button>

                ))}

              </div>

            </div>

            {/* =========================
                PERMISSIONS
            ========================= */}

            <div
              className="
                bg-white
                border
                border-[#ebe4ff]
                rounded-[2.5rem]
                overflow-hidden
                shadow-[0_10px_40px_rgba(180,140,255,0.08)]
              "
            >

              <div
                className="
                  px-8
                  py-6
                  bg-gradient-to-r
                  from-[#f5edff]
                  to-[#efe4ff]
                  border-b
                  border-[#ece2ff]
                  flex
                  items-center
                  gap-4
                "
              >

                <ShieldCheck
                  size={20}
                  className="text-[#7c3aed]"
                />

                <h3
                  className="
                    text-[11px]
                    font-black
                    uppercase
                    tracking-[0.25em]
                    text-[#7c3aed]
                  "
                >
                  Exit Process
                </h3>

              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2">

                {Object.entries(CLEARANCE_LABELS).map(([field, label]) => (

                  <button
                    key={field}
                    onClick={() =>
                      toggleAsset(field)
                    }
                    className={`
                      p-6
                      flex
                      items-center
                      gap-4
                      text-left
                      border-b
                      border-r
                      border-[#f2ecff]
                      transition-all
                      ${
                        assets[field]
                          ? 'bg-[#faf6ff]'
                          : 'bg-white hover:bg-[#faf7ff]'
                      }
                    `}
                  >

                    <div
                      className={`
                        w-11
                        h-11
                        rounded-2xl
                        flex
                        items-center
                        justify-center
                        transition-all
                        ${
                          assets[field]
                            ? 'bg-gradient-to-br from-[#a855f7] to-[#7c3aed]'
                            : 'bg-[#f3effd]'
                        }
                      `}
                    >

                      {assets[field] ? (

                        <CheckCircle
                          size={18}
                          className="text-white"
                        />

                      ) : (

                        <XCircle
                          size={18}
                          className="text-[#7c3aed]"
                        />

                      )}

                    </div>

                    <span
                      className={`
                        text-[11px]
                        font-black
                        uppercase
                        tracking-[0.12em]
                        ${
                          assets[field]
                            ? 'text-black'
                            : 'text-[#6b7280]'
                        }
                      `}
                    >
                      {label}
                    </span>

                  </button>

                ))}

              </div>

            </div>

          </div>

          {/* =========================
              NOTES
          ========================= */}

          <div
            className="
              bg-white
              border
              border-[#ebe4ff]
              rounded-[2.5rem]
              p-8
              shadow-[0_10px_40px_rgba(180,140,255,0.08)]
            "
          >

            <label
              className="
                text-[10px]
                font-black
                uppercase
                tracking-[0.22em]
                text-[#7c3aed]
                block
                mb-4
              "
            >
              Notes & Remarks
            </label>

            <textarea
              value={assets.ob_remarks || ''}
              onChange={e =>
                setAssets(prev => ({
                  ...prev,
                  ob_remarks: e.target.value
                }))
              }
              rows={4}
              placeholder="Add notes related to assets, handover or return condition..."
              className="
                w-full
                rounded-2xl
                border
                border-[#ddd6f7]
                bg-[#fcfbff]
                px-5
                py-4
                text-black
                text-[13px]
                resize-none
                focus:outline-none
                focus:border-[#8b5cf6]
                placeholder:text-[#a9a1bf]
              "
            />

          </div>

          {/* =========================
              SAVE
          ========================= */}

          <div className="flex justify-end">

            <button
              onClick={save}
              disabled={saving}
              className="
                px-12
                py-4
                rounded-2xl
                bg-gradient-to-r
                from-[#a855f7]
                to-[#7c3aed]
                text-white
                text-[11px]
                font-black
                uppercase
                tracking-[0.24em]
                shadow-[0_12px_30px_rgba(180,140,255,0.25)]
                hover:scale-[1.02]
                active:scale-[0.98]
                transition-all
                disabled:opacity-50
              "
            >
              {
                saving
                  ? 'Saving Changes...'
                  : 'Save Asset Details'
              }
            </button>

          </div>

        </div>

      )}

    </div>
  );
}
