// src/components/OfflineBanner.tsx
// Displays network status, pending offline queue count, and triggers background sync

import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { getPendingCount, syncOfflineDeliveries } from '../lib/offlineQueue';
import { useAuth } from '../context/AuthContext';

export const OfflineBanner: React.FC = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const refreshCount = async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSync = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);
    setSyncStatus('Syncing offline deliveries...');
    try {
      const { synced, failed } = await syncOfflineDeliveries(user?.token);
      await refreshCount();
      if (synced > 0) {
        setSyncStatus(`Successfully synced ${synced} record${synced > 1 ? 's' : ''}!`);
        setTimeout(() => setSyncStatus(null), 4000);
      } else if (failed > 0) {
        setSyncStatus(`Warning: ${failed} item(s) could not be synced`);
      } else {
        setSyncStatus(null);
      }
    } catch (err: any) {
      setSyncStatus('Sync error occurred');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    refreshCount();
    const handleOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const interval = setInterval(refreshCount, 5000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [user]);

  if (isOnline && pendingCount === 0 && !syncStatus) {
    return null;
  }

  return (
    <div
      style={{
        background: !isOnline
          ? 'linear-gradient(90deg, #991b1b 0%, #7f1d1d 100%)'
          : 'linear-gradient(90deg, #1e1b4b 0%, #312e81 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        fontSize: '0.85rem',
        fontWeight: 600,
        zIndex: 50
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {!isOnline ? (
          <>
            <WifiOff size={18} color="#fca5a5" />
            <span>
              <strong>Offline Mode</strong> — Deliveries will be stored locally and synced automatically when connected.
            </span>
          </>
        ) : (
          <>
            <Wifi size={18} color="#86efac" />
            <span>{syncStatus || `Connected. ${pendingCount} offline transaction(s) pending upload.`}</span>
          </>
        )}
      </div>

      {pendingCount > 0 && isOnline && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.15)' }}
        >
          <RefreshCw size={14} className={isSyncing ? 'pulse-glow' : ''} />
          {isSyncing ? 'Syncing...' : `Sync (${pendingCount})`}
        </button>
      )}
    </div>
  );
};
