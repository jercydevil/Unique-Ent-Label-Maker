// src/lib/pdfGenerator.ts
// Precision 3x4 A4 Landscape vector PDF generator matching the exact ink-saving template

import type { jsPDF } from 'jspdf';
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

  const { jsPDF: JsPdfClass } = await import('jspdf');

  // A4 Landscape dimensions in mm
  const doc = new JsPdfClass({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  const PAGE_WIDTH = 297;
  const PAGE_HEIGHT = 210;

  // Dense A4 landscape layout for a 2 x 1.5 inch label target.
  const COLS = 5;
  const ROWS = 5;
  const LABELS_PER_PAGE = COLS * ROWS;

  // Recommended best-fit layout with no extra wasted space.
  const TOP_MARGIN = 10;
  const BOTTOM_MARGIN = 4;
  const SIDE_MARGIN = 6;
  const CELL_GAP_X = 0.2;
  const CELL_GAP_Y = 0.2;

  // Keep the 6×3 layout compact enough to fit 18 labels on one A4 landscape sheet.
  const GRID_WIDTH = PAGE_WIDTH - (SIDE_MARGIN * 2) - (CELL_GAP_X * (COLS - 1));
  const GRID_HEIGHT = PAGE_HEIGHT - TOP_MARGIN - BOTTOM_MARGIN - (CELL_GAP_Y * (ROWS - 1));

  const LABEL_WIDTH = GRID_WIDTH / COLS;
  const LABEL_HEIGHT = GRID_HEIGHT / ROWS;

  const totalPages = Math.ceil(labels.length / LABELS_PER_PAGE);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage('a4', 'landscape');
    }

    // -------------------------------------------------------------
    // Exact Top Sheet Margin Header matching template
    // -------------------------------------------------------------
    // Left: Actual label size (in red)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(220, 38, 38); // Red
    doc.text(`LABEL SIZE: ${product.size_mm} MM`, SIDE_MARGIN + 2, 7.5);

    // Center: 25 LABELS PER A4 (LANDSCAPE) - BORDERLESS
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42); // Black
    let centerHeader = '25 LABELS PER A4 (LANDSCAPE) - BORDERLESS';
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
      const x = SIDE_MARGIN + c * (LABEL_WIDTH + CELL_GAP_X);
      doc.line(x, TOP_MARGIN, x, TOP_MARGIN + GRID_HEIGHT + (ROWS - 1) * CELL_GAP_Y);
    }

    // Horizontal cutting lines
    for (let r = 0; r <= ROWS; r++) {
      const y = TOP_MARGIN + r * (LABEL_HEIGHT + CELL_GAP_Y);
      doc.line(SIDE_MARGIN, y, SIDE_MARGIN + GRID_WIDTH + (COLS - 1) * CELL_GAP_X, y);
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

      const x = SIDE_MARGIN + col * (LABEL_WIDTH + CELL_GAP_X);
      const y = TOP_MARGIN + row * (LABEL_HEIGHT + CELL_GAP_Y);

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

  const inset = 1;
  const padLeft = x + inset;
  const padTop = y + 1;

  // Recommended best-fit compact label geometry with cleaner proportions.
  const qrBoxWidth = 19.5;
  const qrSize = 16;
  const textBlockWidth = width - (inset * 2) - qrBoxWidth - 0.9;

  const headingFontSize = 15;
  const bodyFontSize = 12;
  const detailFontSize = 7.5;

  const sizeText = `${product.size_mm} MM `;
  const colorText = (product.color || '').toUpperCase();

  const hex = product.label_color_hex || (colorText === 'RED' ? '#DC2626' : colorText === 'GREEN' ? '#16A34A' : colorText === 'GOLDEN' ? '#B8860B' : '#000000');
  const colorR = parseInt(hex.slice(1, 3), 16) || 0;
  const colorG = parseInt(hex.slice(3, 5), 16) || 0;
  const colorB = parseInt(hex.slice(5, 7), 16) || 0;

  const headingY = padTop + 3.2;
  const lineY = headingY + 3.0;
  const qtyY = lineY + 5.5;
  const batchY = qtyY + 5.4;
  const idY = batchY + 5.1;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(headingFontSize);
  doc.setTextColor(0, 0, 0);
  doc.text(sizeText, padLeft, headingY);

  const sizeTextWidth = doc.getTextWidth(sizeText);
  doc.setTextColor(colorR, colorG, colorB);
  doc.text(colorText, padLeft + sizeTextWidth, headingY);

  const fullHeadingWidth = Math.min(textBlockWidth, sizeTextWidth + doc.getTextWidth(colorText));

  doc.setDrawColor(colorR, colorG, colorB);
  doc.setLineWidth(0.5);
  doc.line(padLeft, lineY, padLeft + fullHeadingWidth + 1, lineY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(bodyFontSize);
  doc.setTextColor(0, 0, 0);
  doc.text(`QTY: ${qtyPerLabel} PCS`, padLeft, qtyY);

  const detailX = padLeft + 4.2;
  const batchText = `BATCH: ${batchCode}`;
  const idText = `ID: ${label.label_code}`;

  drawCalendarIcon(doc, padLeft, batchY - 3.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(detailFontSize);
  doc.setTextColor(30, 30, 30);
  doc.text(batchText, detailX, batchY);

  drawTagIcon(doc, padLeft, idY - 3.3);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(detailFontSize);
  doc.setTextColor(30, 30, 30);
  doc.text(idText, detailX, idY);

  const qrX = x + width - qrBoxWidth - inset + 0.3;
  const qrY = y + height - qrSize - 1 - 0.8;

  const { default: QRCode } = await import('qrcode');
  const qrDataUrl = await QRCode.toDataURL(label.label_code, {
    margin: 0,
    width: 240,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });

  doc.addImage(qrDataUrl, 'PNG', qrX + 0.4, qrY + 0.4, qrSize, qrSize);
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
