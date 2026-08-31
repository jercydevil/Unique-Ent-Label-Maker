// src/components/SecureScanLanding.tsx
// Requirement 9: Anti-Snoop & QR Confidentiality Landing
// Protects sensitive business data from public/unauthorized scans

import React, { useState } from 'react';
import { Lock, ShieldCheck, QrCode, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SecureScanLandingProps {
  labelCode: string;
  onAuthenticated: (code: string) => void;
}

export const SecureScanLanding: React.FC<SecureScanLandingProps> = ({ labelCode, onAuthenticated }) => {
  const { login, isAuthenticated } = useAuth();
  const [staffCode, setStaffCode] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, immediately hand off to delivery workflow
  React.useEffect(() => {
    if (isAuthenticated) {
      onAuthenticated(labelCode);
    }
  }, [isAuthenticated, labelCode, onAuthenticated]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffCode || !pin) {
      setErrorMsg('Please enter both staff code and PIN');
      return;
    }
    setIsLoading(true);
    setErrorMsg(null);
    const res = await login(staffCode.trim().toLowerCase(), pin);
    setIsLoading(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Invalid credentials');
    } else {
      onAuthenticated(labelCode);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)'
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '36px 28px',
          textAlign: 'center'
        }}
      >
        {/* Security Shield Icon */}
        <div
          style={{
            width: '68px',
            height: '68px',
            margin: '0 auto 20px',
            borderRadius: '20px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8'
          }}
        >
          <Lock size={34} />
        </div>

        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '6px' }}>
          Unique Enterprise
        </h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700, marginBottom: '16px' }}>
          <ShieldCheck size={16} /> Genuine Product Unit Verified
        </div>

        {/* Public confidential message */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'left',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Item Identifier:</span>
            <span className="code-tag">{labelCode}</span>
          </div>
          <p style={{ lineHeight: 1.4, fontSize: '0.8rem' }}>
            🔒 <strong>Confidentiality Notice:</strong> Detailed product specs, batch origin, and client delivery actions are restricted to authorized Unique Enterprise staff.
          </p>
        </div>

        {errorMsg && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px',
              marginBottom: '16px',
              color: '#fca5a5',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Quick Staff Login Form */}
        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Staff Code
            </label>
            <input
              type="text"
              value={staffCode}
              onChange={(e) => setStaffCode(e.target.value)}
              placeholder="e.g. admin1"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                color: '#fff',
                fontSize: '0.95rem'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
              4-6 Digit Security PIN
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
                padding: '10px 14px',
                color: '#fff',
                fontSize: '1rem',
                letterSpacing: '0.2em'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary"
            style={{ width: '100%', padding: '14px', justifyContent: 'center' }}
          >
            {isLoading ? 'Verifying...' : 'Unlock Delivery Register'}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};
