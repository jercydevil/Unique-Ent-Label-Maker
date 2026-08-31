// src/components/TransactionLedger.tsx
// Daily Sales History & Transaction Ledger with Product Code Tracking & Audit Modals

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Ban,
  Edit3,
  Calendar,
  Building2,
  Package,
  User,
  ShieldCheck,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  X
} from 'lucide-react';
import { callRpc, type Transaction } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

export const TransactionLedger: React.FC = () => {
  const { user } = useAuth();
  const { isSandbox } = useMode();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'voided'>('all');

  // Modals
  const [selectedTxForVoid, setSelectedTxForVoid] = useState<Transaction | null>(null);
  const [voidReason, setVoidReason] = useState('');

  const [selectedTxForEdit, setSelectedTxForEdit] = useState<Transaction | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [editReason, setEditReason] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);

  const loadTransactions = async () => {
    setIsLoading(true);
    const { data, error } = await callRpc<Transaction[]>(
      'get_transactions',
      { p_is_sandbox: isSandbox, p_limit: 200 },
      user?.token
    );
    setIsLoading(false);
    if (data && Array.isArray(data)) {
      setTransactions(data);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, [isSandbox, user?.token]);

  // Execute Void Action
  const handleConfirmVoid = async () => {
    if (!selectedTxForVoid || !voidReason.trim()) {
      alert('Please enter a reason for voiding this transaction');
      return;
    }
    setIsProcessing(true);
    const { error } = await callRpc(
      'admin_void_transaction',
      {
        p_transaction_id: selectedTxForVoid.id,
        p_reason: voidReason.trim(),
        p_is_sandbox: isSandbox
      },
      user?.token
    );
    setIsProcessing(false);
    if (error) {
      alert(`Could not void transaction: ${error}`);
    } else {
      setSelectedTxForVoid(null);
      setVoidReason('');
      loadTransactions();
    }
  };

  // Execute Correct Action
  const handleConfirmCorrection = async () => {
    if (!selectedTxForEdit || editQty <= 0 || !editReason.trim()) {
      alert('Please enter a valid quantity and correction reason');
      return;
    }
    setIsProcessing(true);
    const { error } = await callRpc(
      'admin_correct_transaction',
      {
        p_transaction_id: selectedTxForEdit.id,
        p_field: 'qty',
        p_new_value: String(editQty),
        p_reason: editReason.trim(),
        p_is_sandbox: isSandbox
      },
      user?.token
    );
    setIsProcessing(false);
    if (error) {
      alert(`Could not correct transaction: ${error}`);
    } else {
      setSelectedTxForEdit(null);
      setEditReason('');
      loadTransactions();
    }
  };

  // Filter transactions
  const filtered = transactions.filter((tx) => {
    const matchesSearch =
      tx.client_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.label_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.label_heading?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.staff_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate totals
  const totalPcs = filtered.reduce((acc, tx) => (tx.status === 'confirmed' ? acc + (tx.qty || 0) : acc), 0);
  const totalConfirmed = filtered.filter((t) => t.status === 'confirmed').length;
  const totalVoided = filtered.filter((t) => t.status === 'voided').length;

  return (
    <div style={{ maxWidth: '1380px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header & KPI Summary Cards */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={26} color="var(--accent-primary)" />
            Daily Sales History & Transaction Ledger
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Immutable audit log of all scanned deliveries with product type codes and operator accountability.
          </p>
        </div>

        <button
          onClick={loadTransactions}
          className="btn-secondary"
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          Refresh Data
        </button>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Total Delivered Volume
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#38bdf8' }}>
            {totalPcs.toLocaleString()} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>PCS</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Confirmed Transactions
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#34d399' }}>
            {totalConfirmed}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
            Voided Records
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f87171' }}>
            {totalVoided}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-panel" style={{ padding: '16px', marginBottom: '20px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, label code, product heading, staff..."
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

        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'confirmed', 'voided'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              style={{
                background: statusFilter === st ? 'var(--accent-primary)' : 'rgba(255, 255, 255, 0.05)',
                color: statusFilter === st ? '#fff' : 'var(--text-secondary)',
                border: statusFilter === st ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                cursor: 'pointer'
              }}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="glass-panel" style={{ overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '14px 18px' }}>Occurred At</th>
                <th style={{ padding: '14px 18px' }}>Label Code</th>
                <th style={{ padding: '14px 18px' }}>Product Heading</th>
                {/* Requirement 8: Product Code column */}
                <th style={{ padding: '14px 18px' }}>Type Code</th>
                <th style={{ padding: '14px 18px' }}>Customer / Client</th>
                <th style={{ padding: '14px 18px' }}>Delivered Qty</th>
                <th style={{ padding: '14px 18px' }}>Staff</th>
                <th style={{ padding: '14px 18px' }}>Status</th>
                {user?.role === 'admin' && <th style={{ padding: '14px 18px', textAlign: 'right' }}>Admin Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Loading transaction ledger...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No transactions found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((tx) => {
                  const dateStr = new Date(tx.occurred_at).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                        opacity: tx.status === 'voided' ? 0.6 : 1
                      }}
                    >
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        {dateStr}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className="ledger-label-code">{tx.label_code}</span>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 700 }}>
                        {tx.label_heading}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>
                          {tx.size_mm} MM • {tx.color}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: 0,
                            borderRadius: 0,
                            fontWeight: 700,
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                            color: '#f59e0b'
                          }}
                        >
                          {tx.product_type || 'IND'}
                        </span>
                      </td>
                      <td className="ledger-client-name" style={{ padding: '14px 18px', fontWeight: 700 }}>
                        {tx.client_name}
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 800, color: '#38bdf8', fontSize: '1rem' }}>
                        {tx.qty} PCS
                      </td>
                      <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>
                        {tx.staff_name}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span className={`badge ${tx.status === 'confirmed' ? 'badge-success' : 'badge-danger'}`}>
                          {tx.status}
                        </span>
                      </td>
                      {user?.role === 'admin' && (
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          {tx.status === 'confirmed' && (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => {
                                  setSelectedTxForEdit(tx);
                                  setEditQty(tx.qty);
                                }}
                                title="Correct Quantity"
                                className="btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => setSelectedTxForVoid(tx)}
                                title="Void Transaction"
                                className="btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.75rem', color: '#f87171' }}
                              >
                                <Ban size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* -------------------------------------------------------------
          MODAL: VOID TRANSACTION
          ------------------------------------------------------------- */}
      {selectedTxForVoid && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} />
                Void Transaction
              </h2>
              <button
                onClick={() => setSelectedTxForVoid(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Voiding transaction for label <strong className="code-tag">{selectedTxForVoid.label_code}</strong> ({selectedTxForVoid.client_name}, {selectedTxForVoid.qty} PCS). This will log an audit reason and update the ledger.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Mandatory Reason for Void:
              </label>
              <textarea
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Customer cancelled order / Wrong scan / Damaged on arrival"
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setSelectedTxForVoid(null)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmVoid}
                disabled={isProcessing || !voidReason.trim()}
                className="btn-primary"
                style={{ flex: 1, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}
              >
                {isProcessing ? 'Voiding...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          MODAL: CORRECT QUANTITY
          ------------------------------------------------------------- */}
      {selectedTxForEdit && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 100
          }}
        >
          <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={20} />
                Correct Transaction Quantity
              </h2>
              <button
                onClick={() => setSelectedTxForEdit(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                New Quantity (PCS):
              </label>
              <input
                type="number"
                value={editQty}
                onChange={(e) => setEditQty(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '2px solid rgba(99, 102, 241, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  textAlign: 'center'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Mandatory Reason for Correction:
              </label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="e.g. Correcting typo in count entered by staff"
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '0.9rem'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setSelectedTxForEdit(null)}
                className="btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmCorrection}
                disabled={isProcessing || editQty <= 0 || !editReason.trim()}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                {isProcessing ? 'Saving...' : 'Save Correction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
