// src/components/Navbar.tsx
// Responsive navigation header with active mode switch, user profile, and tabs

import React from 'react';
import {
  QrCode,
  Printer,
  History,
  Users,
  LogOut,
  Layers,
  FlaskConical,
  ShieldAlert
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

export type ActiveTab = 'scan' | 'labels' | 'ledger' | 'batches' | 'staff';

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const { isSandbox, toggleSandbox } = useMode();

  return (
    <header className="glass-panel no-print" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0, position: 'sticky', top: 0, zIndex: 40 }}>
      {/* Test Mode Warning Banner if active */}
      {isSandbox && (
        <div
          style={{
            background: 'linear-gradient(90deg, #b45309 0%, #d97706 100%)',
            color: '#fff',
            padding: '6px 16px',
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <ShieldAlert size={16} />
          <span>TEST MODE ACTIVE (SANDBOX) — Deliveries & labels will NOT affect real ledger!</span>
        </div>
      )}

      <div
        style={{
          maxWidth: '1380px',
          margin: '0 auto',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        {/* Brand Logo & Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
            }}
          >
            <QrCode size={24} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              UNIQUE ENTERPRISE
              <span className={`badge ${isSandbox ? 'badge-sandbox' : 'badge-production'}`}>
                {isSandbox ? 'TEST SANDBOX' : 'LIVE CORE'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              QR Sales & Delivery System
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '4px 0' }}>
          {/* Scan Tab - Available for Staff & Admin */}
          <button
            onClick={() => setActiveTab('scan')}
            className={activeTab === 'scan' ? 'btn-primary' : 'btn-secondary'}
            style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
          >
            <QrCode size={18} />
            <span>Scan & Deliver</span>
          </button>

          {/* Admin Tabs */}
          {user?.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('labels')}
                className={activeTab === 'labels' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
              >
                <Printer size={18} />
                <span>Print Labels</span>
              </button>

              <button
                onClick={() => setActiveTab('ledger')}
                className={activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
              >
                <History size={18} />
                <span>Sales Ledger</span>
              </button>

              <button
                onClick={() => setActiveTab('batches')}
                className={activeTab === 'batches' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
              >
                <Layers size={18} />
                <span>Batches</span>
              </button>

              <button
                onClick={() => setActiveTab('staff')}
                className={activeTab === 'staff' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
              >
                <Users size={18} />
                <span>Staff</span>
              </button>
            </>
          )}
        </nav>

        {/* User Profile, Mode Switch, & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Mode Switch Toggle Button */}
          <button
            onClick={toggleSandbox}
            title="Toggle between Live Production and Test Mode Sandbox"
            style={{
              background: isSandbox ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)',
              border: `1px solid ${isSandbox ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255, 255, 255, 0.12)'}`,
              color: isSandbox ? '#fbbf24' : 'var(--text-secondary)',
              borderRadius: '10px',
              padding: '8px 12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.8rem',
              fontWeight: 700,
              transition: 'all 0.2s ease'
            }}
          >
            <FlaskConical size={16} />
            <span style={{ display: 'inline-block' }}>{isSandbox ? 'Test Mode' : 'Live Mode'}</span>
          </button>

          {/* User Profile */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 12px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle)'
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{user?.display_name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                {user?.staff_code} • {user?.role}
              </div>
            </div>
            <button
              onClick={logout}
              title="Sign Out"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
