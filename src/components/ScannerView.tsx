// src/components/ScannerView.tsx
// High-performance camera QR scanner with laser viewfinder and manual code entry fallback

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, ArrowRight, AlertTriangle } from 'lucide-react';

interface ScannerViewProps {
  onScanSuccess: (code: string) => void;
  onCancel?: () => void;
}

export const ScannerView: React.FC<ScannerViewProps> = ({ onScanSuccess, onCancel }) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  const qrReaderRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-reader-container';

  const extractLabelCode = (scannedText: string): string => {
    // If QR is full URL: https://<domain>/s/<8-char-code>
    const match = scannedText.match(/\/s\/([a-z0-9]{8})/i);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
    // If raw 8-character string:
    const clean = scannedText.trim().toLowerCase();
    if (/^[a-z0-9]{8}$/.test(clean)) {
      return clean;
    }
    return clean;
  };

  useEffect(() => {
    let mounted = true;

    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerContainerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });
        qrReaderRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (!mounted) return;
            const code = extractLabelCode(decodedText);
            // Play subtle haptic / audio feedback
            if (navigator.vibrate) navigator.vibrate(80);
            stopScanner().then(() => onScanSuccess(code));
          },
          () => {
            // Frame scan failure (expected during search)
          }
        );

        if (mounted) {
          setIsScanning(true);
          try {
            const capabilities = (html5QrCode as any).getRunningTrackCapabilities();
            if (capabilities && (capabilities as any).torch) {
              setHasTorch(true);
            }
          } catch (e) {
            // Torch not supported
          }
        }
      } catch (err: any) {
        if (mounted) {
          console.warn('Camera start error:', err);
          setCameraError('Camera access denied or unavailable. You can type the 8-character code below.');
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (qrReaderRef.current && isScanning) {
      try {
        await qrReaderRef.current.stop();
        qrReaderRef.current.clear();
      } catch (e) {
        // Stop failed or already stopped
      }
    }
  };

  const toggleTorch = async () => {
    if (qrReaderRef.current && hasTorch) {
      try {
        await (qrReaderRef.current as any).applyVideoConstraints({
          advanced: [{ torch: !torchOn } as any]
        });
        setTorchOn(!torchOn);
      } catch (e) {
        console.error('Torch error:', e);
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim().toLowerCase();
    if (!clean) return;
    stopScanner().then(() => onScanSuccess(clean));
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '560px',
        margin: '0 auto',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'rgba(10, 15, 29, 0.25)',
        border: '1px solid rgba(99, 102, 241, 0.45)',
        boxShadow: 'none'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#e2e8f0',
          fontWeight: 800,
          fontSize: '1.05rem',
          padding: '12px 16px 10px',
          background: 'transparent'
        }}
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
            border: '1px solid rgba(139, 92, 246, 0.9)',
            color: '#a78bfa',
            background: 'rgba(139, 92, 246, 0.08)'
          }}
        >
          <Camera size={12} />
        </div>
        <span>Point camera at QR code</span>
      </div>

      <div
        id={scannerContainerId}
        style={{
          width: '100%',
          height: '220px',
          background: '#000',
          position: 'relative',
          border: '2px solid rgba(99, 102, 241, 0.7)',
          borderRadius: '12px',
          margin: '0 8px',
          overflow: 'hidden',
          boxShadow: 'none'
        }}
      />

      {isScanning && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '72%',
            maxWidth: '320px',
            height: '180px',
            pointerEvents: 'none',
            border: '2px solid rgba(99, 102, 241, 0.9)',
            borderRadius: '14px',
            zIndex: 10,
            overflow: 'hidden',
            boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)'
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, width: 22, height: 22, borderTop: '4px solid #8b5cf6', borderLeft: '4px solid #8b5cf6', borderTopLeftRadius: 6 }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderTop: '4px solid #8b5cf6', borderRight: '4px solid #8b5cf6', borderTopRightRadius: 6 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 22, height: 22, borderBottom: '4px solid #8b5cf6', borderLeft: '4px solid #8b5cf6', borderBottomLeftRadius: 6 }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderBottom: '4px solid #8b5cf6', borderRight: '4px solid #8b5cf6', borderBottomRightRadius: 6 }} />
          <div className="laser-line" />
        </div>
      )}

      {cameraError && (
        <div
          style={{
            margin: '12px 8px 0',
            padding: '14px 12px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.5)',
            borderRadius: '12px',
            color: '#fda4af',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontWeight: 800,
            lineHeight: 1.4
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(239,68,68,0.18)' }}>
            <AlertTriangle size={16} />
          </div>
          <span>{cameraError}</span>
        </div>
      )}

      <div
        style={{
          background: 'transparent',
          padding: '12px 10px 14px'
        }}
      >
        <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '10px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or type 8-char code..."
              maxLength={8}
              autoCapitalize="none"
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '12px 14px',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '1rem',
                letterSpacing: '0.08em'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="btn-primary"
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              opacity: manualCode.trim() ? 1 : 0.6,
              minWidth: '110px'
            }}
          >
            <span>Proceed</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  );
};
