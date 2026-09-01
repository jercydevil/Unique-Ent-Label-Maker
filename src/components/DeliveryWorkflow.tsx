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
  Truck,
  Printer,
  History,
  Layers,
  Users
} from 'lucide-react';
import { ScannerView } from './ScannerView';
import { callRpc, type Client, type LabelDetails } from '../lib/supabase';
import { queueOfflineDelivery } from '../lib/offlineQueue';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

interface CartItem {
  labelCode: string;
  labelDetails: LabelDetails;
  qty: number;
  error?: string | null;
}

interface DeliveryWorkflowProps {
  initialCode?: string | null;
  onClearInitialCode?: () => void;
  activeTab?: 'scan' | 'labels' | 'ledger' | 'batches' | 'staff';
  setActiveTab?: (tab: 'scan' | 'labels' | 'ledger' | 'batches' | 'staff') => void;
}

export const DeliveryWorkflow: React.FC<DeliveryWorkflowProps> = ({ initialCode, onClearInitialCode, activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const { isSandbox, setSandbox } = useMode();

  // Workflow Steps: 'scan' (add to cart) -> 'checkout' (select client) -> 'success'
  const [step, setStep] = useState<'scan' | 'checkout' | 'success'>('scan');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoadingLabel, setIsLoadingLabel] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  // Client State (for checkout)
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [clientSearch, setClientSearch] = useState('');
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState('');

  // Submission & Result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxResult, setLastTxResult] = useState<{ id?: string; offline?: boolean; itemCount?: number; client?: string; totalQty?: number } | null>(null);

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
    setIsLoadingLabel(true);
    setLabelError(null);

    const { data, error } = await callRpc<LabelDetails>('lookup_label_details', { p_label_code: clean }, user?.token);
    setIsLoadingLabel(false);

    if (error || !data) {
      // Add to cart with error
      const cartItem: CartItem = {
        labelCode: clean,
        labelDetails: {
          label_code: clean,
          batch_code: 'UNKNOWN',
          label_heading: `Invalid Label: ${clean}`,
          size_mm: 0,
          color: 'Unknown',
          qty_per_label: 0,
          product_type: 'N/A',
          source_schema: 'unknown'
        } as any,
        qty: 0,
        error: `Label "${clean}" not found in database`
      };
      setCart([...cart, cartItem]);
      setLabelError(null);
      return;
    }

    const sourceMode = data.source_schema === 'sandbox';
    if (sourceMode !== isSandbox) {
      setSandbox(sourceMode);
    }

    const labelDetailsFormatted: LabelDetails = {
      ...data,
      qty_per_label: Number(data.qty_per_label) || 25
    };

    let itemError: string | null = null;
    if (data.status === 'used') {
      itemError = '⚠️ ALREADY DELIVERED — This label was already scanned & processed!';
    } else if (data.status !== 'unused') {
      itemError = `⚠️ BLOCKED — Status: "${data.status.toUpperCase()}". Cannot deliver.`;
    }

    // Add item to cart
    const cartItem: CartItem = {
      labelCode: clean,
      labelDetails: labelDetailsFormatted,
      qty: Number(data.qty_per_label) || 25,
      error: itemError
    };

    setCart([...cart, cartItem]);
    setLabelError(null);
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

    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    // Filter out items with errors
    const validItems = cart.filter(item => !item.error);
    if (validItems.length === 0) {
      alert('Cannot checkout: all items in cart have delivery errors');
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let failureCount = 0;

    try {
      // Submit each valid item in the cart
      for (const item of validItems) {
        const clientTxUuid = crypto.randomUUID();
        const occurredAt = new Date().toISOString();

        try {
          if (!navigator.onLine) {
            // Enqueue offline delivery
            await queueOfflineDelivery({
              client_tx_uuid: clientTxUuid,
              label_code: item.labelCode,
              client_name: selectedClient.trim(),
              qty: item.qty,
              occurred_at: occurredAt,
              device_id: deviceId,
              is_sandbox: isSandbox
            });
            successCount++;
            continue;
          }

          // Online RPC delivery recording
          const { data, error } = await callRpc(
            'record_delivery',
            {
              p_label_code: item.labelCode,
              p_client_name: selectedClient.trim(),
              p_qty: item.qty,
              p_client_tx_uuid: clientTxUuid,
              p_occurred_at: occurredAt,
              p_device_id: deviceId,
              p_is_sandbox: isSandbox
            },
            user?.token
          );

          if (error) {
            console.error(`Failed to record ${item.labelCode}:`, error);
            failureCount++;
          } else if (data?.result === 'already_processed') {
            console.warn(`${item.labelCode}: Already processed`);
            failureCount++;
          } else if (data?.result === 'blocked') {
            console.warn(`${item.labelCode}: Blocked (${data.reason})`);
            failureCount++;
          } else if (data?.result === 'ok') {
            successCount++;
          }
        } catch (err: any) {
          console.error(`Exception processing ${item.labelCode}:`, err);
          // Save offline
          await queueOfflineDelivery({
            client_tx_uuid: clientTxUuid,
            label_code: item.labelCode,
            client_name: selectedClient.trim(),
            qty: item.qty,
            occurred_at: occurredAt,
            device_id: deviceId,
            is_sandbox: isSandbox
          });
          successCount++;
        }
      }

      triggerSuccessUI({
        itemCount: successCount,
        offline: !navigator.onLine,
        totalQty: validItems.reduce((sum, item) => sum + item.qty, 0)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const triggerSuccessUI = (info: { itemCount?: number; offline?: boolean; totalQty?: number }) => {
    // Confetti celebration
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });

    setLastTxResult({
      ...info,
      client: selectedClient
    });
    setStep('success');
  };

  const resetForNextScan = () => {
    setCart([]);
    setLabelError(null);
    setSelectedClient('');
    setClientSearch('');
    setNewClientName('');
    setIsAddingClient(false);
    setStep('scan');
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '20px 16px' }}>
      {/* STEP 1: SCAN & BUILD CART */}
      {step === 'scan' && (
        <div style={{ maxWidth: '640px', margin: '0 auto', padding: '0 16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <ScannerView onScanSuccess={handleCodeScanned} />

            {setActiveTab && (
              <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', padding: '4px 0', marginTop: '2px' }}>
                <button
                  onClick={() => setActiveTab('scan')}
                  className={activeTab === 'scan' ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
                >
                  <QrCode size={18} />
                  <span>Scan & Deliver</span>
                </button>

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
            )}

            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <span className="badge badge-production" style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.5)', fontSize: '0.72rem', padding: '5px 10px' }}>
                  ADD TO CART
                </span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 800, letterSpacing: '0.08em' }}>
                  SCAN PRODUCT LABELS
                </span>
              </div>
              <h2 style={{ fontSize: '1.9rem', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.1, margin: 0 }}>Scan Items to Cart</h2>
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

            {/* CART DISPLAY */}
            {cart.length > 0 && (
              <div className="glass-panel" style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <PackageCheck size={20} color="#a78bfa" />
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.08em' }}>CART ({cart.length} items)</span>
                </div>

                <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {cart.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: item.error ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                        border: item.error ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        opacity: item.error ? 0.6 : 1
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
                          {item.labelDetails.label_heading} ({item.labelDetails.size_mm}mm)
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
                          <span>{item.labelCode}</span>
                          <span>{item.qty} pcs</span>
                        </div>
                        {item.error && <div style={{ fontSize: '0.7rem', color: '#fca5a5', marginTop: '4px' }}>{item.error}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(idx)}
                        className="btn-secondary"
                        style={{ padding: '6px 10px', fontSize: '0.8rem', minWidth: '50px' }}
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '14px', display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setStep('checkout')}
                    className="btn-success"
                    style={{ flex: 1, padding: '14px' }}
                    disabled={cart.filter(item => !item.error).length === 0}
                  >
                    <ArrowRight size={18} />
                    <span>Checkout</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      // Keep scanning - user can stay on this screen
                    }}
                    className="btn-primary"
                    style={{ flex: 1, padding: '14px' }}
                  >
                    <Plus size={18} />
                    <span>Scan More</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STEP 2: CHECKOUT - CLIENT & CONFIRM */}
      {step === 'checkout' && (
        <div className="glass-panel delivery-form-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '24px' }}>Checkout</h2>

          {/* Cart Summary */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              marginBottom: '24px'
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Order Summary
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Items in cart: </span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#a78bfa' }}>{cart.filter(item => !item.error).length}</span>
              </div>
              <div>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total quantity: </span>
                <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#a78bfa' }}>
                  {cart.filter(item => !item.error).reduce((sum, item) => sum + item.qty, 0)} pcs
                </span>
              </div>
            </div>
          </div>

          {/* CLIENT SELECTION */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
              Customer / Store Name
            </label>

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
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingClient(false);
                    setNewClientName('');
                  }}
                  className="btn-secondary"
                  style={{ padding: '12px 18px' }}
                >
                  Back
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
                    placeholder="Search or type customer name..."
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
                    padding: '4px 0',
                    marginBottom: '10px'
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
                  <div style={{ fontSize: '0.85rem', color: '#38bdf8', marginBottom: '12px' }}>
                    Selected: <strong>{selectedClient}</strong>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setIsAddingClient(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Plus size={14} />
                  <span>+ New Customer</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              disabled={isSubmitting || !selectedClient}
              onClick={handleConfirmDelivery}
              className="btn-success"
              style={{
                opacity: isSubmitting || !selectedClient ? 0.5 : 1,
                cursor: isSubmitting || !selectedClient ? 'not-allowed' : 'pointer'
              }}
            >
              <PackageCheck size={22} />
              <span>{isSubmitting ? 'Processing...' : 'OK - Confirm & Send to Ledger'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedClient('');
                setClientSearch('');
                setNewClientName('');
                setIsAddingClient(false);
                setStep('scan');
              }}
              className="btn-secondary"
              style={{ width: '100%' }}
            >
              <RotateCcw size={16} />
              <span>Back to Cart</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS RECEIPT */}
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
            Checkout Complete!
          </h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '24px' }}>
            {lastTxResult.offline ? 'Saved to offline queue. Will sync automatically.' : 'All deliveries recorded in ledger.'}
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
              <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
              <strong>{lastTxResult.client}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Items Delivered:</span>
              <strong>{lastTxResult.itemCount}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Total Quantity:</span>
              <strong>{lastTxResult.totalQty} PCS</strong>
            </div>
          </div>

          <button
            onClick={resetForNextScan}
            className="btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '1.1rem' }}
          >
            <QrCode size={20} />
            <span>Start New Cart</span>
          </button>
        </div>
      )}
    </div>
  );
};
