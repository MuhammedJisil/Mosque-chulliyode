import jsPDF from 'jspdf';
import 'jspdf-autotable';

/**
 * Safe currency formatter for jsPDF.
 * jsPDF Helvetica does NOT support ₹ (U+20B9) — it renders as superscript "¹".
 * Always use "Rs." inside PDF-rendered strings.
 */
export const fmtPdfAmount = (num) =>
  'Rs. ' + Number(num || 0).toLocaleString('en-IN');

// Strips ₹ glyph from any string destined for jsPDF
const safe = (str) =>
  typeof str === 'string' ? str.replace(/₹/g, 'Rs.') : str;

export const exportToPdf = ({
  title = 'JAMIA AN-NOOR Financial Statement',
  subtitle = '',
  dateRange = 'All Records',
  columns = [],
  rows = [],
  summaryRows = [],
  fileName = 'jamia_annoor_statement.pdf'
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const pageW = doc.internal.pageSize.width;

  // ── Emerald Green Header Banner ─────────────────────────────────────────────
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, pageW, 80, 'F');

  // Main title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('JAMIA AN-NOOR', pageW / 2, 30, { align: 'center' });

  // English subtitle only — Arabic is unsupported in Helvetica and renders as garbage
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 252, 231);
  doc.text('Masjid Management System', pageW / 2, 48, { align: 'center' });

  // Report type label
  doc.setFontSize(11);
  doc.setTextColor(236, 253, 245);
  doc.text(safe(title).toUpperCase(), pageW / 2, 66, { align: 'center' });

  // ── Metadata ────────────────────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const printDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  doc.text(`Generated On: ${printDate}`, 40, 105);
  doc.text(`Period / Filter: ${dateRange}`, 40, 120);
  if (subtitle) {
    doc.text(safe(subtitle), pageW - 40, 105, { align: 'right' });
  }

  // ── Table ───────────────────────────────────────────────────────────────────
  const safeRows = rows.map(row =>
    row.map(cell => (typeof cell === 'string' ? safe(cell) : cell))
  );

  doc.autoTable({
    startY: 135,
    head: [columns.map(c => safe(c))],
    body: safeRows,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 78, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageW / 2, doc.internal.pageSize.height - 20, { align: 'center' });
    }
  });

  // ── Summary box ─────────────────────────────────────────────────────────────
  let finalY = doc.lastAutoTable.finalY + 20;

  if (summaryRows && summaryRows.length > 0) {
    if (finalY + (summaryRows.length * 18) > doc.internal.pageSize.height - 80) {
      doc.addPage();
      finalY = 50;
    }

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(167, 243, 208);
    doc.rect(pageW - 260, finalY, 220, (summaryRows.length * 20) + 12, 'FD');

    let sumY = finalY + 16;
    summaryRows.forEach(item => {
      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(
        item.highlight ? 5 : 51,
        item.highlight ? 150 : 65,
        item.highlight ? 105 : 85
      );
      doc.text(safe(item.label || ''), pageW - 250, sumY);
      doc.text(safe(item.value || ''), pageW - 50, sumY, { align: 'right' });
      sumY += 18;
    });

    finalY = sumY + 40;
  }

  // ── Signatures ──────────────────────────────────────────────────────────────
  if (finalY + 50 > doc.internal.pageSize.height - 40) {
    doc.addPage();
    finalY = 60;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('_____________________________', 40, finalY + 30);
  doc.text('Prepared By (Staff / Admin)', 40, finalY + 45);
  doc.text('_____________________________', pageW - 180, finalY + 30);
  doc.text('Approved By (President / Treasurer)', pageW - 180, finalY + 45);

  doc.save(fileName);
};
