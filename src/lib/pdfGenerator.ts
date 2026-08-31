// src/lib/pdfGenerator.ts
// Precision 3x4 A4 Landscape vector PDF generator matching the exact ink-saving template

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { Label, Product } from './supabase';

export interface GenerateSheetOptions {
  product: Product;
  productTypeDisplay: string; // e.g. "IND", "CH", "PD", or custom code (printed in sheet margin)
  batchCode: string;
  qtyPerLabel: number;
  labels: Label[];
}

export async function generateLabelPdf(options: GenerateSheetOptions): Promise<jsPDF> {
  const { product, productTypeDisplay, batchCode, qtyPerLabel, labels } = options;

  // A4 Landscape dimensions in mm
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const PAGE_WIDTH = 297;
  const PAGE_HEIGHT = 210;

  // Grid configuration: 3 columns x 4 rows = 12 labels per sheet
  const COLS = 3;
  const ROWS = 4;
  const LABELS_PER_PAGE = COLS * ROWS;

  // Top header space for sheet indicators
  const TOP_MARGIN = 12;
  const BOTTOM_MARGIN = 6;
  const SIDE_MARGIN = 6;

  const GRID_WIDTH = PAGE_WIDTH - (SIDE_MARGIN * 2); // 285mm
  const GRID_HEIGHT = PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN; // 192mm

  const LABEL_WIDTH = GRID_WIDTH / COLS; // 95mm (~3.74" or 3.0" printable)
  const LABEL_HEIGHT = GRID_HEIGHT / ROWS; // 48mm (~1.89" or 2.0" printable)

  const totalPages = Math.ceil(labels.length / LABELS_PER_PAGE);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage('a4', 'landscape');
    }

    // -------------------------------------------------------------
    // Exact Top Sheet Margin Header matching template
    // -------------------------------------------------------------
    // Left: LABEL SIZE: 3.0" x 2.0" (in red)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(220, 38, 38); // Red
    doc.text('LABEL SIZE: 3.0" x 2.0"', SIDE_MARGIN + 2, 7.5);

    // Center: 12 LABELS PER A4 (LANDSCAPE) - BORDERLESS
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // Black
    let centerHeader = '12 LABELS PER A4 (LANDSCAPE) - BORDERLESS';
    if (productTypeDisplay) {
      centerHeader += `  •  TYPE: [ ${productTypeDisplay.toUpperCase()} ]`;
    }
    doc.text(centerHeader, PAGE_WIDTH / 2, 7.5, { align: 'center' });

    // Right: REMOVE DOTTED LINES AFTER PRINTING
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(70, 70, 70);
    doc.text('REMOVE DOTTED LINES AFTER PRINTING', PAGE_WIDTH - SIDE_MARGIN - 2, 7.5, { align: 'right' });

    // -------------------------------------------------------------
    // Dotted Cutting Grid Lines
    // -------------------------------------------------------------
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    // @ts-ignore
    doc.setLineDashPattern([1.5, 1.5], 0);

    // Vertical cutting lines
    for (let c = 0; c <= COLS; c++) {
      const x = SIDE_MARGIN + c * LABEL_WIDTH;
      doc.line(x, TOP_MARGIN, x, TOP_MARGIN + GRID_HEIGHT);
    }

    // Horizontal cutting lines
    for (let r = 0; r <= ROWS; r++) {
      const y = TOP_MARGIN + r * LABEL_HEIGHT;
      doc.line(SIDE_MARGIN, y, SIDE_MARGIN + GRID_WIDTH, y);
    }

    // Reset line dash to solid
    // @ts-ignore
    doc.setLineDashPattern([], 0);

    // Draw the 12 labels for this page
    const pageLabels = labels.slice(pageIdx * LABELS_PER_PAGE, (pageIdx + 1) * LABELS_PER_PAGE);

    for (let i = 0; i < pageLabels.length; i++) {
      const label = pageLabels[i];
      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const x = SIDE_MARGIN + col * LABEL_WIDTH;
      const y = TOP_MARGIN + row * LABEL_HEIGHT;

      await renderTemplateLabel(doc, {
        x,
        y,
        width: LABEL_WIDTH,
        height: LABEL_HEIGHT,
        product,
        label,
        batchCode,
        qtyPerLabel
      });
    }
  }

  return doc;
}

interface TemplateLabelParams {
  x: number;
  y: number;
  width: number;
  height: number;
  product: Product;
  label: Label;
  batchCode: string;
  qtyPerLabel: number;
}

async function renderTemplateLabel(doc: jsPDF, params: TemplateLabelParams) {
  const { x, y, width, height, product, label, batchCode, qtyPerLabel } = params;

  // Padding inside label cell
  const padLeft = x + 5;
  const padTop = y + 7;

  // -------------------------------------------------------------
  // 1. Heading: Size in Black + Color in Specific Color
  // e.g. "30 MM " in Black, "RED" in Red
  // -------------------------------------------------------------
  const sizeText = `${product.size_mm} MM `;
  const colorText = (product.color || '').toUpperCase();

  // Extract RGB for color
  const hex = product.label_color_hex || (colorText === 'RED' ? '#DC2626' : colorText === 'GREEN' ? '#16A34A' : colorText === 'GOLDEN' ? '#B8860B' : '#000000');
  const colorR = parseInt(hex.slice(1, 3), 16) || 0;
  const colorG = parseInt(hex.slice(3, 5), 16) || 0;
  const colorB = parseInt(hex.slice(5, 7), 16) || 0;

  // Draw Size Part (Black, Extra Bold)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0); // Black
  doc.text(sizeText, padLeft, padTop + 4.5);

  const sizeTextWidth = doc.getTextWidth(sizeText);

  // Draw Color Part (Specific Color, Extra Bold)
  doc.setTextColor(colorR, colorG, colorB);
  doc.text(colorText, padLeft + sizeTextWidth, padTop + 4.5);

  const fullHeadingWidth = sizeTextWidth + doc.getTextWidth(colorText);

  // -------------------------------------------------------------
  // 2. Horizontal Color Accent Line under Heading
  // -------------------------------------------------------------
  const lineY = padTop + 7.5;
  doc.setDrawColor(colorR, colorG, colorB);
  doc.setLineWidth(0.6);
  doc.line(padLeft, lineY, padLeft + Math.max(fullHeadingWidth, 48), lineY);

  // -------------------------------------------------------------
  // 3. Details (QTY, BATCH, ID)
  // -------------------------------------------------------------
  // QTY : 500 PCS (Bold Black)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12.5);
  doc.setTextColor(0, 0, 0);
  doc.text(`QTY :  ${qtyPerLabel}  PCS`, padLeft, lineY + 9);

  // BATCH : B260829-01
  const batchY = lineY + 16.5;
  drawCalendarIcon(doc, padLeft, batchY - 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(`BATCH :  ${batchCode}`, padLeft + 5.5, batchY);

  // ID : UE-000191 / label_code
  const idY = batchY + 6.5;
  drawTagIcon(doc, padLeft, idY - 3.2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 30, 30);
  doc.text(`ID :  ${label.label_code}`, padLeft + 5.5, idY);

  // -------------------------------------------------------------
  // 4. Right Side: Vector QR Code with Rounded Border Frame
  // -------------------------------------------------------------
  const qrSize = 30; // 30mm x 30mm
  const qrX = x + width - qrSize - 5;
  const qrY = y + (height - qrSize) / 2;

  // Generate QR Data URL
  const qrUrl = `https://broken-frost-10eb.jercydevil.workers.dev/s/${label.label_code}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    margin: 0,
    width: 250,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  // QR Outer Box (Rounded, Thin Black Border with white background)
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.roundedRect(qrX - 1.5, qrY - 1.5, qrSize + 3, qrSize + 3, 2, 2, 'FD');

  // Insert QR Code image inside frame
  doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
}

// Helper: Vector Calendar Icon
function drawCalendarIcon(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(40, 40, 40);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, 3.8, 3.8, 0.6, 0.6, 'S');

  // Top header bar of calendar
  doc.setFillColor(40, 40, 40);
  doc.rect(x, y, 3.8, 1.2, 'F');

  // Binder hooks
  doc.setDrawColor(0, 0, 0);
  doc.line(x + 0.9, y - 0.4, x + 0.9, y + 0.4);
  doc.line(x + 2.9, y - 0.4, x + 2.9, y + 0.4);
}

// Helper: Vector Tag Icon
function drawTagIcon(doc: jsPDF, x: number, y: number) {
  doc.setDrawColor(40, 40, 40);
  doc.setFillColor(40, 40, 40);
  doc.setLineWidth(0.3);

  // Diamond / tag polygon
  const w = 3.6;
  const h = 3.6;
  doc.triangle(x + 0.2, y + h / 2, x + w / 2, y + 0.2, x + w / 2, y + h - 0.2, 'F');
  doc.rect(x + w / 2 - 0.1, y + 0.2, w / 2, h - 0.4, 'F');

  // Center white hole
  doc.setFillColor(255, 255, 255);
  doc.circle(x + w - 1.1, y + h / 2, 0.5, 'F');
}
