// src/components/BatchHistory.tsx
// History of all printed batches with live consumption analytics and PDF re-print

import React, { useState, useEffect } from 'react';
import { Layers, Download, RefreshCw, Printer, CheckCircle2, Clock } from 'lucide-react';
import { callRpc, type Batch, type Label, type Product } from '../lib/supabase';
import { generateLabelPdf } from '../lib/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

export const BatchHistory: React.FC = () => {
  const { user } = useAuth();
  const { isSandbox } = useMode();

  const [batches, setBatches] = useState<Batch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [printingBatchId, setPrintingBatchId] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const [batchRes, prodRes] = await Promise.all([
      callRpc<Batch[]>('get_batches', { p_is_sandbox: isSandbox }, user?.token),
      callRpc<Product[]>('get_products', { p_is_sandbox: isSandbox }, user?.token)
    ]);
    setIsLoading(false);

    if (batchRes.data && Array.isArray(batchRes.data)) {
      setBatches(batchRes.data);
    }
    if (prodRes.data && Array.isArray(prodRes.data)) {
      setProducts(prodRes.data);
    }
  };

  useEffect(() => {
    loadData();
  }, [isSandbox, user?.token]);

  const handleReprintPdf = async (batch: Batch) => {
    setPrintingBatchId(batch.id);
    try {
      const { data: labels } = await callRpc<Label[]>(
        'get_batch_labels',
        { p_batch_id: batch.id, p_is_sandbox: isSandbox },
        user?.token
      );

      const product = products.find((p) => p.id === batch.product_id) || {
        id: batch.product_id,
        label_heading: batch.label_heading,
        size_mm: batch.size_mm,
        color: batch.color,
        product_type: 'IND',
        sku: null,
        label_color_hex: '#B8860B',
        active: true
      };

      if (labels && labels.length > 0) {
        const pdf = await generateLabelPdf({
          product,
          productTypeDisplay: product.product_type || 'IND',
          batchCode: batch.batch_code,
          qtyPerLabel: batch.qty_per_label,
          labels
        });

        pdf.save(`Labels_${batch.batch_code}.pdf`);
      }
    } catch (err: any) {
      alert(`Could not generate PDF: ${err?.message || 'Error'}`);
    } finally {
      setPrintingBatchId(null);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={24} color="var(--accent-primary)" />
            Generated Batch History
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Track batch consumption, print history, and re-download label sheets.
          </p>
        </div>

        <button onClick={loadData} className="btn-secondary" style={{ padding: '8px 16px' }}>
          <RefreshCw size={16} />
          <span>Refresh</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
        {isLoading ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            Loading batch records...
          </div>
        ) : batches.length === 0 ? (
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            No batches generated yet. Click "Print Labels" to create your first batch.
          </div>
        ) : (
          batches.map((batch) => {
            const used = Number(batch.used_count) || 0;
            const total = Number(batch.label_count) || 1;
            const percentUsed = Math.min(100, Math.round((used / total) * 100));

            const dateStr = new Date(batch.created_at).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            });

            return (
              <div key={batch.id} className="glass-panel" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="code-tag" style={{ fontSize: '0.95rem' }}>
                    {batch.batch_code}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateStr}</span>
                </div>

                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                  {batch.label_heading}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Size: <strong>{batch.size_mm} MM</strong> • Color: <strong>{batch.color}</strong> • Pack: <strong>{batch.qty_per_label} pcs/label</strong>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>CONSUMPTION RATE</span>
                    <span>{used} / {total} USED ({percentUsed}%)</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${percentUsed}%`,
                        background: percentUsed === 100 ? '#10b981' : 'var(--accent-gradient)',
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Created by: <strong>{batch.creator_name}</strong>
                  </span>
                  <button
                    onClick={() => handleReprintPdf(batch)}
                    disabled={printingBatchId === batch.id}
                    className="btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <Download size={14} />
                    <span>{printingBatchId === batch.id ? 'Generating...' : 'PDF'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
