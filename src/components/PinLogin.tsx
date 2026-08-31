// src/components/PinLogin.tsx
// Tactile on-screen numeric keypad & PIN authentication view

import React, { useState } from 'react';
import { KeyRound, User, Delete, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const PinLogin: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [staffCode, setStaffCode] = useState(() => localStorage.getItem('unique_ent_last_staff') || '');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setErrorMsg(null);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMsg(null);
  };

  const handleClear = () => {
    setPin('');
    setErrorMsg(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!staffCode.trim()) {
      setErrorMsg('Please enter your staff code');
      triggerShake();
      return;
    }
    if (pin.length < 4) {
      setErrorMsg('PIN must be 4 to 6 digits');
      triggerShake();
      return;
    }

    setErrorMsg(null);
    const result = await login(staffCode.trim().toLowerCase(), pin);
    if (!result.success) {
      setErrorMsg(result.error || 'Invalid credentials');
      triggerShake();
      setPin('');
    } else {
      localStorage.setItem('unique_ent_last_staff', staffCode.trim().toLowerCase());
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  const quickFillAdmin = () => {
    setStaffCode('admin1');
    setPin('1234');
    setErrorMsg(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'radial-gradient(circle at center, #1e1b4b 0%, #0a0f1d 100%)'
      }}
    >
      <div
        className={`glass-panel ${isShaking ? 'shake-animation' : ''}`}
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px 28px',
          boxShadow: 'var(--shadow-glow)'
        }}
      >
        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 16px',
              borderRadius: '20px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 30px rgba(99, 102, 241, 0.5)'
            }}
          >
            <ShieldCheck size={36} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Unique Enterprise
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Enter your Staff Code & PIN to access register
          </p>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div
            style={{
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#fca5a5',
              fontSize: '0.875rem',
              fontWeight: 600
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Staff Code Input */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Staff Code (Login Handle)
            </label>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <User size={18} />
              </div>
              <input
                type="text"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value)}
                placeholder="e.g. admin1 or staff1"
                autoCapitalize="none"
                autoComplete="username"
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px 12px 42px',
                  color: '#fff',
                  fontSize: '1rem',
                  fontWeight: 600,
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--accent-primary)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
              />
            </div>
          </div>

          {/* PIN Display Indicator */}
          <div style={{ marginBottom: '24px', textAlign: 'center' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
              Security PIN ({pin.length}/6 digits)
            </label>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div
                  key={idx}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    border: '2px solid rgba(255, 255, 255, 0.2)',
                    background: pin.length > idx ? 'var(--accent-primary)' : 'transparent',
                    boxShadow: pin.length > idx ? '0 0 12px var(--accent-primary)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Tactile Keypad */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              marginBottom: '20px'
            }}
          >
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                type="button"
                className="keypad-btn"
                onClick={() => handleKeyPress(digit)}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="keypad-btn"
              style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}
              onClick={handleClear}
            >
              CLEAR
            </button>
            <button
              type="button"
              className="keypad-btn"
              onClick={() => handleKeyPress('0')}
            >
              0
            </button>
            <button
              type="button"
              className="keypad-btn"
              style={{ color: '#f87171' }}
              onClick={handleBackspace}
            >
              <Delete size={22} />
            </button>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || pin.length < 4}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '1.05rem',
              opacity: pin.length < 4 ? 0.6 : 1,
              cursor: pin.length < 4 ? 'not-allowed' : 'pointer'
            }}
          >
            {isLoading ? 'Authenticating...' : 'Sign In to Register'}
            <ArrowRight size={18} />
          </button>
        </form>


      </div>
    </div>
  );
};
