// src/components/ScannerView.tsx
// High-performance camera QR scanner with laser viewfinder and manual code entry fallback

import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Flashlight, RefreshCcw, Keyboard, ArrowRight, X, AlertTriangle } from 'lucide-react';

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
  const [isManualOpen, setIsManualOpen] = useState(false);

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
          // Check for torch capability
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
          setIsManualOpen(true);
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
        maxWidth: '480px',
        margin: '0 auto',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #050b13 0%, #02060d 100%)',
        boxShadow: '0 0 0 1px rgba(99, 102, 241, 0.35), 0 18px 38px rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(99, 102, 241, 0.28)'
      }}
    >
      {/* Top Controls Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 14,
          right: 14,
          zIndex: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Camera size={14} color="#38bdf8" />
          <span>Point camera at QR code</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {hasTorch && (
            <button
              onClick={toggleTorch}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: torchOn ? '#eab308' : 'rgba(0, 0, 0, 0.65)',
                color: torchOn ? '#000' : '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Flashlight size={18} />
            </button>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.65)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* HTML5 QR Camera Element */}
      <div
        id={scannerContainerId}
        style={{
          width: '100%',
          minHeight: '340px',
          background: '#000',
          position: 'relative',
          border: '3px solid rgba(99, 102, 241, 0.8)',
          borderRadius: '18px',
          margin: '8px',
          overflow: 'hidden',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), 0 0 0 1px rgba(99,102,241,0.35), 0 0 28px rgba(99,102,241,0.18)'
        }}
      />

      {/* Laser Scanning Animation Overlay */}
      {isScanning && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '240px',
            height: '240px',
            pointerEvents: 'none',
            border: '2px solid rgba(99, 102, 241, 0.9)',
            borderRadius: '16px',
            zIndex: 10,
            overflow: 'hidden',
            boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.25), 0 0 24px rgba(99, 102, 241, 0.35)'
          }}
        >
          {/* Viewfinder Corners */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 24, height: 24, borderTop: '4px solid #6366f1', borderLeft: '4px solid #6366f1', borderTopLeftRadius: 8 }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: 24, height: 24, borderTop: '4px solid #6366f1', borderRight: '4px solid #6366f1', borderTopRightRadius: 8 }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderBottom: '4px solid #6366f1', borderLeft: '4px solid #6366f1', borderBottomLeftRadius: 8 }} />
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderBottom: '4px solid #6366f1', borderRight: '4px solid #6366f1', borderBottomRightRadius: 8 }} />

          {/* Sweeping Laser Line */}
          <div className="laser-line" />
        </div>
      )}

      {/* Camera Error / Manual Fallback Prompt */}
      {cameraError && (
        <div
          style={{
            padding: '20px',
            background: 'rgba(239, 68, 68, 0.12)',
            borderTop: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <AlertTriangle size={20} />
          <span>{cameraError}</span>
        </div>
      )}

      {/* Bottom Manual Entry Drawer */}
      <div
        style={{
          background: '#111827',
          padding: '16px 20px',
          borderTop: '1px solid var(--border-subtle)'
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
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                color: '#fff',
                fontFamily: 'var(--font-mono)',
                fontSize: '1rem',
                letterSpacing: '0.1em'
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!manualCode.trim()}
            className="btn-primary"
            style={{
              padding: '12px 18px',
              borderRadius: 'var(--radius-md)',
              opacity: manualCode.trim() ? 1 : 0.6
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
