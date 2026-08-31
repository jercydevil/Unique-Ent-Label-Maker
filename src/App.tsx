// src/App.tsx
// Main Application Router & Container

import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar, type ActiveTab } from './components/Navbar';
import { PinLogin } from './components/PinLogin';
import { DeliveryWorkflow } from './components/DeliveryWorkflow';
import { LabelSheetGenerator } from './components/LabelSheetGenerator';
import { TransactionLedger } from './components/TransactionLedger';
import { BatchHistory } from './components/BatchHistory';
import { StaffManager } from './components/StaffManager';
import { OfflineBanner } from './components/OfflineBanner';
import { SecureScanLanding } from './components/SecureScanLanding';

export const App: React.FC = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('scan');

  // URL QR Scan Detection (/s/<8-char-code> or ?label=<8-char-code>)
  const [scannedUrlCode, setScannedUrlCode] = useState<string | null>(() => {
    const path = window.location.pathname;
    const match = path.match(/\/s\/([a-z0-9]{8})/i);
    if (match && match[1]) return match[1].toLowerCase();

    const params = new URLSearchParams(window.location.search);
    const qLabel = params.get('label');
    if (qLabel && /^[a-z0-9]{8}$/i.test(qLabel)) return qLabel.toLowerCase();

    return null;
  });

  const [landingCodeToDeliver, setLandingCodeToDeliver] = useState<string | null>(null);

  // If user navigated directly via physical QR scan and is not logged in:
  if (scannedUrlCode && !isAuthenticated) {
    return (
      <SecureScanLanding
        labelCode={scannedUrlCode}
        onAuthenticated={(code) => {
          setScannedUrlCode(null);
          setLandingCodeToDeliver(code);
          setActiveTab('scan');
        }}
      />
    );
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
          color: 'var(--text-secondary)',
          fontSize: '1.1rem',
          fontWeight: 700
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div className="pulse-glow" style={{ fontSize: '2.5rem', marginBottom: '12px' }}>
            🏷️
          </div>
          <div>Loading Unique Enterprise Register...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PinLogin />;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <OfflineBanner />
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} showTabs={activeTab !== 'scan'} />

      <main style={{ flex: 1, paddingBottom: '60px' }}>
        {activeTab === 'scan' && (
          <DeliveryWorkflow
            initialCode={scannedUrlCode || landingCodeToDeliver}
            onClearInitialCode={() => {
              setScannedUrlCode(null);
              setLandingCodeToDeliver(null);
            }}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'labels' && user?.role === 'admin' && <LabelSheetGenerator />}
        {activeTab === 'ledger' && user?.role === 'admin' && <TransactionLedger />}
        {activeTab === 'batches' && user?.role === 'admin' && <BatchHistory />}
        {activeTab === 'staff' && user?.role === 'admin' && <StaffManager />}
      </main>
    </div>
  );
};
