// src/components/DeliveryWorkflow.tsx
// High-speed 3-Tap Scan & Deliver workflow for warehouse & delivery staff

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  QrCode,
  Building2,
  PackageCheck,
  Plus,
  CheckCircle2,
  AlertOctagon,
  RotateCcw,
  Search,
  Minus,
  ArrowRight,
  ShieldCheck,
  Flame,
  Truck
} from 'lucide-react';
import { ScannerView } from './ScannerView';
import { callRpc, type Client, type LabelDetails } from '../lib/supabase';
import { queueOfflineDelivery } from '../lib/offlineQueue';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

interface DeliveryWorkflowProps {
  initialCode?: string | null;
  onClearInitialCode?: () => void;
}

export const DeliveryWorkflow: React.FC<DeliveryWorkflowProps> = ({ initialCode, onClearInitialCode }) => {
  const { user } = useAuth();
  const { isSandbox, setSandbox } = useMode();

  // Workflow Steps: 'scan' (1) -> 'client_qty' (2 & 3) -> 'success'
  const [step, setStep] = useState<'scan' | 'form' | 'success'>('scan');
  const [labelCode, setLabelCode] = useState<string>('');
  const [labelDetails, setLabelDetails] = useState<LabelDetails | null>(null);
  const [isLoadingLabel, setIsLoadingLabel] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  // Client State
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Quantity State
  const [qty, setQty] = useState<number>(25);

  // Submission & Result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxResult, setLastTxResult] = useState<{ id?: string; offline?: boolean; code?: string; client?: string; qty?: number } | null>(null);

  // Device ID persisted per installation
  const [deviceId] = useState(() => {
    let d = localStorage.getItem('unique_ent_device_id');
    if (!d) {
      d = 'dev-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('unique_ent_device_id', d);
    }
    return d;
  });

  // Load clients catalog
  const loadClients = async () => {
    const { data } = await callRpc<Client[]>('get_clients', { p_is_sandbox: isSandbox }, user?.token);
    if (data && Array.isArray(data)) {
      setClients(data);
    }
  };

  useEffect(() => {
    loadClients();
  }, [isSandbox, user?.token]);

  // Handle scanned code (or initialCode from URL QR scan)
  useEffect(() => {
    if (initialCode) {
      handleCodeScanned(initialCode);
      if (onClearInitialCode) onClearInitialCode();
    }
  }, [initialCode]);

  const handleCodeScanned = async (code: string) => {
    const clean = code.trim().toLowerCase();
    setLabelCode(clean);
    setIsLoadingLabel(true);
    setLabelError(null);

    const { data, error } = await callRpc<LabelDetails>('lookup_label_details', { p_label_code: clean }, user?.token);
    setIsLoadingLabel(false);

    if (error || !data) {
      setLabelError(`Label "${clean}" was not found in the database.`);
      setStep('scan');
      return;
    }

    const sourceMode = data.source_schema === 'sandbox';
    if (sourceMode !== isSandbox) {
      setSandbox(sourceMode);
    }

    setLabelDetails({
      ...data,
      qty_per_label: Number(data.qty_per_label) || 25
    });
    setQty(Number(data.qty_per_label) || 25);

    if (data.status === 'used') {
      setLabelError('⚠️ ALREADY DELIVERED — This label was already scanned & processed previously!');
    } else if (data.status !== 'unused') {
      setLabelError(`⚠️ BLOCKED — This label has status: "${data.status.toUpperCase()}". Delivery cannot be recorded.`);
    }

    setStep('form');
  };

  const handleCreateNewClient = () => {
    if (!newClientName.trim()) return;
    const name = newClientName.trim();
    setSelectedClient(name);
    setIsAddingClient(false);
    setNewClientName('');
  };

  const handleConfirmDelivery = async () => {
    if (!selectedClient.trim()) {
      alert('Please select or enter a client name');
      return;
    }
    if (qty <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    const clientTxUuid = crypto.randomUUID();
    const occurredAt = new Date().toISOString();

    try {
      if (!navigator.onLine) {
        // Enqueue offline delivery
        await queueOfflineDelivery({
          client_tx_uuid: clientTxUuid,
          label_code: labelCode,
          client_name: selectedClient.trim(),
          qty,
          occurred_at: occurredAt,
          device_id: deviceId,
          is_sandbox: isSandbox
        });

        triggerSuccessUI({ offline: true });
        return;
      }

      // Online RPC delivery recording
      const { data, error } = await callRpc(
        'record_delivery',
        {
          p_label_code: labelCode,
          p_client_name: selectedClient.trim(),
          p_qty: qty,
          p_client_tx_uuid: clientTxUuid,
          p_occurred_at: occurredAt,
          p_device_id: deviceId,
          p_is_sandbox: isSandbox
        },
        user?.token
      );

      if (error) {
        alert(`Could not record delivery: ${error}`);
      } else if (data?.result === 'already_processed') {
        alert('⚠️ DUPLICATE BLOCKED: This label was already confirmed delivered!');
      } else if (data?.result === 'blocked') {
        alert(`⚠️ Label is blocked (${data.reason})`);
      } else if (data?.result === 'ok') {
        triggerSuccessUI({ id: data.transaction_id });
      }
    } catch (err: any) {
      // Network failed mid-request: save offline
      await queueOfflineDelivery({
        client_tx_uuid: clientTxUuid,
        label_code: labelCode,
        client_name: selectedClient.trim(),
        qty,
        occurred_at: occurredAt,
        device_id: deviceId,
        is_sandbox: isSandbox
      });
      triggerSuccessUI({ offline: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerSuccessUI = (info: { id?: string; offline?: boolean }) => {
    // Confetti celebration
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    setLastTxResult({
      ...info,
      code: labelCode,
      client: selectedClient,
      qty
    });
    setStep('success');
  };

  const resetForNextScan = () => {
    setLabelCode('');
    setLabelDetails(null);
    setLabelError(null);
    setSelectedClient('');
    setClientSearch('');
    setNewClientName('');
    setIsAddingClient(false);
    setQty(25);
    setStep('scan');
  };

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase())
  );

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px' }}>
      {/* -------------------------------------------------------------
          STEP 1: SCAN QR CODE
          ------------------------------------------------------------- */}
      {step === 'scan' && (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <ScannerView onScanSuccess={handleCodeScanned} />

            <div
              style={{
                position: 'sticky',
                top: '96px',
                zIndex: 20,
                background: 'linear-gradient(180deg, rgba(10,15,29,0.98) 0%, rgba(10,15,29,0.9) 100%)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                paddingTop: '8px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(99,102,241,0.35)',
                boxShadow: '0 10px 18px rgba(0,0,0,0.18)'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span className="badge badge-production" style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', fontSize: '0.72rem', padding: '5px 10px' }}>
                    TAP 1 OF 3
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 800, letterSpacing: '0.08em' }}>
                    SCAN PRODUCT LABEL
                  </span>
                </div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.2, margin: 0 }}>Scan Label to Deliver</h2>
              </div>
            </div>

            {labelError && (
              <div
                style={{
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px',
                  color: '#fca5a5',
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <AlertOctagon size={20} />
                <span>{labelError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          STEP 2 & 3: PRODUCT PREVIEW + CLIENT + QTY CONFIRMATION
          ------------------------------------------------------------- */}
      {step === 'form' && labelDetails && (
        <div className="glass-panel delivery-form-panel" style={{ padding: '24px' }}>
          {/* Header Product Card */}
          <div
            className="delivery-header-card"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '18px',
              marginBottom: '20px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Color Accent Bar */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: '6px',
                background: labelDetails.color === 'Golden' ? '#B8860B' : labelDetails.color === 'Green' ? '#16A34A' : labelDetails.color === 'Red' ? '#DC2626' : '#000000'
              }}
            />

            <div style={{ paddingLeft: '8px' }}>
              <div className="delivery-header-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '10px', flexWrap: 'wrap' }}>
                <span className="code-tag">{labelDetails.label_code}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Batch: <strong>{labelDetails.batch_code}</strong>
                </span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                {labelDetails.label_heading}
              </h3>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Size: <strong>{labelDetails.size_mm} MM</strong> • Color: <strong>{labelDetails.color}</strong> • Pack: <strong>{labelDetails.qty_per_label} pcs</strong>
              </div>
            </div>
          </div>

          {/* Warning Banner if already processed */}
          {labelError && (
            <div
              style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                marginBottom: '20px',
                color: '#fca5a5',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <AlertOctagon size={24} />
              <div>
                <strong>CANNOT DELIVER:</strong> {labelError}
              </div>
            </div>
          )}

          {/* TAP 2: SELECT CLIENT */}
          <div style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '10px', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Tap 2: Select Customer / Store
              </label>
              <button
                type="button"
                onClick={() => setIsAddingClient(!isAddingClient)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-primary)',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={14} />
                <span>{isAddingClient ? 'Search Existing' : '+ New Customer'}</span>
              </button>
            </div>

            {isAddingClient ? (
              <div className="delivery-client-row" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Enter store/customer name..."
                  autoFocus
                  style={{
                    flex: '1 1 220px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    color: '#fff',
                    fontSize: '0.95rem',
                    minWidth: 0
                  }}
                />
                <button
                  type="button"
                  onClick={handleCreateNewClient}
                  className="btn-primary"
                  style={{ padding: '12px 18px' }}
                >
                  Set
                </button>
              </div>
            ) : (
              <div>
                {/* Search / Filter box */}
                <div style={{ position: 'relative', marginBottom: '10px' }}>
                  <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Search customer list..."
                    style={{
                      width: '100%',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 14px 10px 38px',
                      color: '#fff',
                      fontSize: '0.9rem'
                    }}
                  />
                </div>

                {/* Quick Select Client Pills */}
                <div
                  style={{
                    maxHeight: '140px',
                    overflowY: 'auto',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '4px 0'
                  }}
                >
                  {filteredClients.map((c) => {
                    const isSelected = selectedClient === c.name;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedClient(c.name)}
                        style={{
                          background: isSelected ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.06)',
                          color: isSelected ? '#fff' : 'var(--text-secondary)',
                          border: isSelected ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 'var(--radius-full)',
                          padding: '6px 14px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Building2 size={14} />
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>

                {selectedClient && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#38bdf8' }}>
                    Selected Customer: <strong>{selectedClient}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TAP 3: QUANTITY FIXED FROM LABEL */}
          <div className="delivery-qty-box" style={{ marginBottom: '26px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
              Tap 3: Quantity from Label
            </label>

            <div className="delivery-qty-value" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 16px',
              minHeight: '80px',
              flexWrap: 'wrap'
            }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, color: '#fff' }}>
                {qty}
              </span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                PCS
              </span>
            </div>

            <div style={{ marginTop: '10px', color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>
              This label is packed as <strong>{qty} PCS</strong> and will be recorded as that quantity.
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              disabled={isSubmitting || !!labelError || !selectedClient}
              onClick={handleConfirmDelivery}
              className="btn-success"
              style={{
                opacity: isSubmitting || !!labelError || !selectedClient ? 0.5 : 1,
                cursor: isSubmitting || !!labelError || !selectedClient ? 'not-allowed' : 'pointer'
              }}
            >
              <PackageCheck size={22} />
              <span>{isSubmitting ? 'Recording...' : 'Confirm & Record Delivery'}</span>
            </button>

            <button
              type="button"
              onClick={resetForNextScan}
              className="btn-secondary"
              style={{ width: '100%' }}
            >
              <RotateCcw size={16} />
              <span>Cancel / Scan Another</span>
            </button>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          STEP 4: SUCCESS RECEIPT
          ------------------------------------------------------------- */}
      {step === 'success' && lastTxResult && (
        <div
          className="glass-panel"
          style={{
            padding: '36px 24px',
            textAlign: 'center',
            border: '2px solid rgba(16, 185, 129, 0.5)',
            boxShadow: '0 0 35px rgba(16, 185, 129, 0.25)'
          }}
        >
          <div
            style={{
              width: '68px',
              height: '68px',
              margin: '0 auto 16px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 25px rgba(16, 185, 129, 0.6)'
            }}
          >
            <CheckCircle2 size={38} color="#fff" />
          </div>

          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
            Delivery Confirmed!
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {lastTxResult.offline ? 'Saved to offline queue. Will sync automatically.' : 'Transaction recorded permanently in ledger.'}
          </p>

          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              textAlign: 'left',
              marginBottom: '28px',
              fontSize: '0.9rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Label Code:</span>
              <span className="code-tag">{lastTxResult.code}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
              <strong>{lastTxResult.client}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Quantity:</span>
              <strong>{lastTxResult.qty} PCS</strong>
            </div>
            {lastTxResult.id && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <span>Tx ID:</span>
                <span>{lastTxResult.id}</span>
              </div>
            )}
          </div>

          <button
            onClick={resetForNextScan}
            className="btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
          >
            <QrCode size={20} />
            <span>Scan Next Label</span>
          </button>
        </div>
      )}
    </div>
  );
};
