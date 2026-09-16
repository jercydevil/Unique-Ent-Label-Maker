// src/components/LabelSheetGenerator.tsx
// 3x4 A4 Landscape Label Sheet Generator matching Labler.jpeg with Margin Product Codes

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  Layers,
  Sparkles,
  Eye,
  Info,
  Check,
  AlertCircle,
  Tag
} from 'lucide-react';
import { callRpc, type Product, type Label } from '../lib/supabase';
import { generateLabelPdf } from '../lib/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { useMode } from '../context/ModeContext';

const fallbackProducts: Product[] = [
  {
    id: 'demo-product-1',
    size_mm: 63,
    color: 'Golden',
    product_type: 'CH',
    sku: 'UE-CH-63G',
    label_heading: 'LUG CAPS 63 MM GOLDEN CH',
    label_color_hex: '#B8860B',
    active: true
  },
  {
    id: 'demo-product-2',
    size_mm: 53,
    color: 'Golden',
    product_type: 'CH',
    sku: 'UE-CH-53G',
    label_heading: 'LUG CAPS 53 MM GOLDEN CH',
    label_color_hex: '#B8860B',
    active: true
  },
  {
    id: 'demo-product-3',
    size_mm: 63,
    color: 'Black',
    product_type: 'CH',
    sku: 'UE-CH-63B',
    label_heading: 'LUG CAPS 63 MM BLACK CH',
    label_color_hex: '#111827',
    active: true
  },
  {
    id: 'demo-product-4',
    size_mm: 53,
    color: 'Black',
    product_type: 'CH',
    sku: 'UE-CH-53B',
    label_heading: 'LUG CAPS 53 MM BLACK CH',
    label_color_hex: '#111827',
    active: true
  },
  {
    id: 'demo-product-5',
    size_mm: 63,
    color: 'Green',
    product_type: 'CH',
    sku: 'UE-CH-63GN',
    label_heading: 'LUG CAPS 63 MM GREEN CH',
    label_color_hex: '#16A34A',
    active: true
  },
  {
    id: 'demo-product-6',
    size_mm: 53,
    color: 'Green',
    product_type: 'CH',
    sku: 'UE-CH-53GN',
    label_heading: 'LUG CAPS 53 MM GREEN CH',
    label_color_hex: '#16A34A',
    active: true
  },
  {
    id: 'demo-product-7',
    size_mm: 58,
    color: 'Golden',
    product_type: 'CH',
    sku: 'UE-CH-58G',
    label_heading: 'LUG CAPS 58 MM GOLDEN CH',
    label_color_hex: '#B8860B',
    active: true
  },
  {
    id: 'demo-product-8',
    size_mm: 66,
    color: 'Golden',
    product_type: 'CH',
    sku: 'UE-CH-66G',
    label_heading: 'LUG CAPS 66 MM GOLDEN CH',
    label_color_hex: '#B8860B',
    active: true
  },
  {
    id: 'demo-product-9',
    size_mm: 63,
    color: 'Golden',
    product_type: 'PD',
    sku: 'UE-PD-63G',
    label_heading: 'LUG CAPS 63 MM GOLDEN PD',
    label_color_hex: '#B8860B',
    active: true
  },
  {
    id: 'demo-product-10',
    size_mm: 53,
    color: 'Golden',
    product_type: 'PD',
    sku: 'UE-PD-53G',
    label_heading: 'LUG CAPS 53 MM GOLDEN PD',
    label_color_hex: '#B8860B',
    active: true
  },
  {
    id: 'demo-product-11',
    size_mm: 63,
    color: 'Black',
    product_type: 'PD',
    sku: 'UE-PD-63B',
    label_heading: 'LUG CAPS 63 MM BLACK PD',
    label_color_hex: '#111827',
    active: true
  },
  {
    id: 'demo-product-12',
    size_mm: 53,
    color: 'Black',
    product_type: 'PD',
    sku: 'UE-PD-53B',
    label_heading: 'LUG CAPS 53 MM BLACK PD',
    label_color_hex: '#111827',
    active: true
  },
  {
    id: 'demo-product-13',
    size_mm: 38,
    color: 'Black',
    product_type: 'PD',
    sku: 'UE-PD-38B',
    label_heading: 'LUG CAPS 38 MM BLACK PD',
    label_color_hex: '#111827',
    active: true
  },
  {
    id: 'demo-product-14',
    size_mm: 30,
    color: 'Red',
    product_type: 'PD',
    sku: 'UE-PD-30R',
    label_heading: 'LUG CAPS 30 MM RED PD',
    label_color_hex: '#DC2626',
    active: true
  },
  {
    id: 'demo-product-15',
    size_mm: 63,
    color: 'Golden',
    product_type: 'IND',
    sku: 'UE-IND-63G',
    label_heading: 'LUG CAPS 63 MM GOLDEN IND',
    label_color_hex: '#B8860B',
    active: true
  }
];

export const LabelSheetGenerator: React.FC = () => {
  const { user } = useAuth();
  const { isSandbox } = useMode();

  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  // Requirement 8: Product Code Selector (IND, CH, PD, or Custom)
  const [productTypeCode, setProductTypeCode] = useState<string>('IND');
  const [customTypeCode, setCustomTypeCode] = useState<string>('');

  const [qtyPerLabel, setQtyPerLabel] = useState<number>(25);
  const [sheetCount, setSheetCount] = useState<number>(1); // 1 sheet = 25 labels

  const [isGenerating, setIsGenerating] = useState(false);
  const [previewQrMap, setPreviewQrMap] = useState<Record<string, string>>({});
  const [generatedBatch, setGeneratedBatch] = useState<{ id: string; labels: Label[]; batchCode: string } | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      const { data, error } = await callRpc<Product[]>('get_products', { p_is_sandbox: isSandbox }, user?.token);

      if (!error && data && Array.isArray(data) && data.length > 0) {
        setProducts(data);
        if (!selectedProductId) {
          setSelectedProductId(data[0].id);
          if (data[0].product_type) {
            setProductTypeCode(data[0].product_type);
          }
        }
        return;
      }

      setProducts(fallbackProducts);
      if (!selectedProductId) {
        setSelectedProductId(fallbackProducts[0].id);
        setProductTypeCode(fallbackProducts[0].product_type || 'IND');
      }
    };

    loadProducts();
  }, [isSandbox, user?.token]);

  useEffect(() => {
    setGeneratedBatch(null);
    setPreviewQrMap({});
  }, [selectedProductId, qtyPerLabel, sheetCount, isSandbox]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const effectiveProductTypeCode = productTypeCode === 'CUSTOM' ? (customTypeCode.trim() || 'CUSTOM') : productTypeCode;

  // Build live preview QR codes only from the current batch, never from stale static data.
  useEffect(() => {
    if (!generatedBatch?.labels || generatedBatch.labels.length === 0) {
      setPreviewQrMap({});
      return;
    }

    const genPreview = async () => {
      const { default: QRCode } = await import('qrcode');
      const map: Record<string, string> = {};
      for (const label of generatedBatch.labels.slice(0, 25)) {
        const code = label.label_code;
        if (!code) continue;
        map[code] = await QRCode.toDataURL(code, {
          margin: 0,
          width: 120
        });
      }
      setPreviewQrMap(map);
    };
    genPreview();
  }, [generatedBatch]);

  const handleGenerateBatch = async () => {
    if (!selectedProduct) return;
    setIsGenerating(true);
    setGeneratedBatch(null);

    const totalLabels = sheetCount * 25;

    try {
      // 1. Call RPC to generate batch and labels in database
      const { data: batchId, error } = await callRpc<string>(
        'create_batch_and_labels',
        {
          p_product_id: selectedProduct.id,
          p_qty_per_label: qtyPerLabel,
          p_label_count: totalLabels,
          p_is_sandbox: isSandbox
        },
        user?.token
      );

      if (error || !batchId) {
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const batchCode = `B${dateStr}-DEMO`;
        const labels: Label[] = Array.from({ length: totalLabels }, (_, index) => ({
          id: `demo-label-${index + 1}`,
          label_code: `${selectedProduct.sku || 'UE'}-${String(index + 1).padStart(4, '0')}`,
          batch_id: 'demo-batch',
          product_id: selectedProduct.id,
          status: 'unused',
          created_at: new Date().toISOString()
        }));

        setGeneratedBatch({
          id: 'demo-batch',
          labels,
          batchCode
        });

        const pdf = await generateLabelPdf({
          product: selectedProduct,
          productTypeDisplay: effectiveProductTypeCode,
          batchCode,
          qtyPerLabel,
          labels
        });

        pdf.save(`Labels_${selectedProduct.label_heading.replace(/\s+/g, '_')}_${batchCode}.pdf`);
        setIsGenerating(false);
        return;
      }

      // 2. Fetch the newly created labels
      const { data: labels } = await callRpc<Label[]>(
        'get_batch_labels',
        { p_batch_id: batchId, p_is_sandbox: isSandbox },
        user?.token
      );

      if (labels && labels.length > 0) {
        // Fetch batch info for code
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const batchCode = `B${dateStr}-01`;

        setGeneratedBatch({
          id: batchId,
          labels,
          batchCode
        });

        // 3. Generate high-res PDF
        const pdf = await generateLabelPdf({
          product: selectedProduct,
          productTypeDisplay: effectiveProductTypeCode,
          batchCode,
          qtyPerLabel,
          labels
        });

        // Auto download
        pdf.save(`Labels_${selectedProduct.label_heading.replace(/\s+/g, '_')}_${batchCode}.pdf`);
      }
    } catch (err: any) {
      alert(`Error generating PDF: ${err?.message || 'Error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>
          3×4 A4 Label Grid Generator
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Produce A4 landscape sheets using the selected product size with vector QR codes matching the factory layout.
        </p>
      </div>

      <div className="label-generator-grid" style={{ display: 'grid', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Configuration Controls */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={18} color="var(--accent-primary)" />
            Batch Configuration
          </h2>

          {/* Product Select */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              1. Select Lug Caps Items
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                const prod = products.find((p) => p.id === e.target.value);
                if (prod?.product_type) setProductTypeCode(prod.product_type);
              }}
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                color: '#fff',
                fontSize: '0.95rem',
                fontWeight: 600,
                outline: 'none'
              }}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id} style={{ background: '#1e293b', color: '#fff' }}>
                  {p.label_heading} ({p.size_mm} MM - {p.color}) [{p.product_type || 'N/A'}]
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Per Label */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              3. Pack Quantity Per Label
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[25, 50, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setQtyPerLabel(val)}
                  style={{
                    flex: 1,
                    background: qtyPerLabel === val ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: qtyPerLabel === val ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: qtyPerLabel === val ? '#fff' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {val} pcs
                </button>
              ))}
              <input
                type="number"
                value={qtyPerLabel}
                onChange={(e) => setQtyPerLabel(Math.max(1, parseInt(e.target.value) || 1))}
                style={{
                  width: '80px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  fontWeight: 700
                }}
              />
            </div>
          </div>

          {/* Sheet Count (Multiples of 12 labels) */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
              4. Number of Sheets ({sheetCount * 25} Total Labels)
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[1, 2, 5, 10].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSheetCount(count)}
                  style={{
                    flex: 1,
                    background: sheetCount === count ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                    border: sheetCount === count ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.1)',
                    color: sheetCount === count ? '#fff' : 'var(--text-secondary)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {count} {count === 1 ? 'Sheet' : 'Sheets'}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateBatch}
            disabled={isGenerating || !selectedProduct}
            className="btn-primary"
            style={{ width: '100%', padding: '16px', fontSize: '1.05rem', justifyContent: 'center' }}
          >
            <Download size={20} />
            <span>{isGenerating ? 'Generating Labels & PDF...' : `Generate & Download PDF (${sheetCount * 25} Labels)`}</span>
          </button>
        </div>

        {/* Right Column: Live 3x4 Grid Visual Preview matching Labler.jpeg */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={18} color="#38bdf8" />
              A4 Landscape Sheet Preview (5×5 Grid)
            </h2>
            <span className="badge badge-production" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
              25 Labels / Sheet
            </span>
          </div>

          {/* Sheet Simulated Paper Container */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '8px',
              padding: '14px',
              color: '#111827',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
              overflowX: 'auto'
            }}
          >
            {/* Sheet Margin Header Banner (Requirement 8) */}
            <div
              style={{
                borderBottom: '1px solid #cbd5e1',
                paddingBottom: '6px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.65rem',
                fontWeight: 700,
                color: '#475569'
              }}
            >
              <span>
                UNIQUE ENTERPRISE PRODUCTION SHEET • TYPE: <span style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#0f172a' }}>[{effectiveProductTypeCode}]</span> • PRODUCT: {selectedProduct?.label_heading}
              </span>
              <span>A4 LANDSCAPE • 300 DPI</span>
            </div>

            {/* 5 Columns x 5 Rows Grid */}
            {generatedBatch?.labels && generatedBatch.labels.length > 0 ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gridTemplateRows: 'repeat(5, minmax(0, 1fr))',
                  gap: '2px',
                  width: '100%',
                  aspectRatio: '297 / 210',
                  minHeight: '0'
                }}
              >
                {generatedBatch.labels.slice(0, 25).map((item, idx) => {
                  const labelCode = item.label_code || `preview-${idx + 1}`;
                  const qr = previewQrMap[labelCode];

                  return (
                    <div
                      key={`${labelCode}-${idx}`}
                      style={{
                        border: '1px solid #cbd5e1',
                        borderRadius: '5px',
                        overflow: 'hidden',
                        background: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                        height: '100%',
                        width: '100%',
                        minHeight: '0'
                      }}
                    >
                      <div
                        style={{
                          background: selectedProduct?.label_color_hex || '#B8860B',
                          color: '#fff',
                          textAlign: 'center',
                          padding: '3px 4px 2px',
                          lineHeight: 1.1,
                          marginTop: '1px'
                        }}
                      >
                        <div style={{ fontSize: '0.60rem', fontWeight: 800, letterSpacing: '0.02em' }}>
                          {selectedProduct?.label_heading || 'LUG CAPS 63 MM GOLDEN'}
                        </div>
                        <div style={{ fontSize: '0.24rem', fontWeight: 700, opacity: 0.9 }}>
                          UNIQUE ENTERPRISE • PREMIUM QUALITY
                        </div>
                      </div>

                      <div style={{ padding: '4px', display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'space-between', flex: 1 }}>
                        <div style={{ flex: 1, fontSize: '0.48rem', lineHeight: 1.2, minWidth: 0, marginTop: '1px' }}>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 800,
                              background: '#f1f5f9',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              marginBottom: '2px',
                              display: 'inline-block',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {labelCode}
                          </div>
                          <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.49rem', marginTop: '1px' }}>
                            QTY: {qtyPerLabel} PCS
                          </div>
                          <div style={{ color: '#64748b', fontSize: '0.40rem', marginTop: '1px' }}>
                            BATCH: {generatedBatch.batchCode}
                          </div>
                        </div>

                        <div
                          style={{
                            width: '20px',
                            height: '20px',
                            background: '#fff',
                            padding: '1px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: '2px'
                          }}
                        >
                          {qr ? (
                            <img src={qr} alt="QR" style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <div style={{ fontSize: '0.4rem' }}>QR</div>
                          )}
                        </div>
                      </div>

                      <div
                        style={{
                          borderTop: '1px solid #f1f5f9',
                          padding: '2px',
                          textAlign: 'center',
                          fontSize: '0.29rem',
                          fontWeight: 700,
                          color: '#94a3b8'
                        }}
                      >
                        GENUINE PRODUCT • AUTHORIZED SCAN ONLY
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  border: '1px dashed #cbd5e1',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  color: '#475569',
                  padding: '32px 16px',
                  textAlign: 'center',
                  fontWeight: 700
                }}
              >
                Generate a batch to preview the live A4 sheet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
