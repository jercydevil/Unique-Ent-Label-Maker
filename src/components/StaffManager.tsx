// src/components/StaffManager.tsx
// Admin Staff Account Onboarding and Sandbox Test Data Reset

import React, { useState } from 'react';
import { UserPlus, Shield, KeyRound, User, CheckCircle2, AlertCircle, Trash2, RefreshCw } from 'lucide-react';
import { createStaffMember, callRpc } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

export const StaffManager: React.FC = () => {
  const { user } = useAuth();
  const { isSandbox } = useMode();

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [staffCode, setStaffCode] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [pin, setPin] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sandbox reset state
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !staffCode.trim() || !pin.trim()) {
      setErrorMsg('Please fill in all fields');
      return;
    }
    if (!/^\d{4,6}$/.test(pin.trim())) {
      setErrorMsg('PIN must be 4 to 6 numeric digits');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const { staff, error } = await createStaffMember(user?.token || '', {
      display_name: displayName.trim(),
      staff_code: staffCode.trim().toLowerCase(),
      role,
      pin: pin.trim()
    });

    setIsLoading(false);

    if (error || !staff) {
      setErrorMsg(error || 'Failed to create staff account');
    } else {
      setSuccessMsg(`Staff account "${staff.staff_code}" (${staff.display_name}) created successfully!`);
      setDisplayName('');
      setStaffCode('');
      setPin('');
    }
  };

  const handleResetSandboxData = async () => {
    if (!window.confirm('Are you sure you want to reset all test data in Sandbox? This cannot be undone.')) {
      return;
    }

    setIsResetting(true);
    setResetSuccess(false);

    const { error } = await callRpc('reset_test_data', {}, user?.token);
    setIsResetting(false);

    if (error) {
      alert(`Could not reset sandbox: ${error}`);
    } else {
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 4000);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={26} color="var(--accent-primary)" />
          Staff Management & System Tools
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Provision new warehouse staff accounts with PIN credentials and manage sandbox testing environments.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        {/* Onboard Staff Card */}
        <div className="glass-panel" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} color="#38bdf8" />
            Onboard New Staff Member
          </h2>

          {successMsg && (
            <div
              style={{
                background: 'var(--success-bg)',
                border: '1px solid var(--success)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#86efac',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <CheckCircle2 size={18} />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                marginBottom: '20px',
                color: '#fca5a5',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreateStaff}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Tariq Ahmed"
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Staff Code (Login Handle)
                </label>
                <input
                  type="text"
                  value={staffCode}
                  onChange={(e) => setStaffCode(e.target.value.toLowerCase())}
                  placeholder="e.g. staff1 or tariq"
                  autoCapitalize="none"
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '0.95rem'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Account Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '0.95rem'
                  }}
                >
                  <option value="staff" style={{ background: '#1e293b' }}>Staff (Scanning & Deliveries Only)</option>
                  <option value="admin" style={{ background: '#1e293b' }}>Admin (Full System Access + Printing + Voids)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                  4-6 Digit Login PIN
                </label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                  maxLength={6}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '1rem',
                    letterSpacing: '0.2em'
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary"
              style={{ width: '100%', padding: '14px', justifyContent: 'center' }}
            >
              <UserPlus size={18} />
              <span>{isLoading ? 'Creating Staff Member...' : 'Create Staff Member'}</span>
            </button>
          </form>
        </div>

        {/* Sandbox Data Maintenance */}
        <div className="glass-panel" style={{ padding: '28px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <Trash2 size={20} />
                Sandbox Test Mode Data Wipe
              </h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '480px' }}>
                Clear all test transactions, test batches, and test labels from the isolated sandbox database. Real production ledger data is 100% untouched.
              </p>
            </div>

            <button
              onClick={handleResetSandboxData}
              disabled={isResetting}
              className="btn-secondary"
              style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.4)', color: '#fbbf24' }}
            >
              <RefreshCw size={16} className={isResetting ? 'pulse-glow' : ''} />
              <span>{isResetting ? 'Resetting Sandbox...' : 'Reset Test Sandbox'}</span>
            </button>
          </div>

          {resetSuccess && (
            <div style={{ marginTop: '14px', color: '#86efac', fontSize: '0.85rem', fontWeight: 700 }}>
              ✅ Sandbox test tables reset successfully!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
