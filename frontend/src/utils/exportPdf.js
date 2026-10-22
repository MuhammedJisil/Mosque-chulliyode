import jsPDF from 'jspdf';
import 'jspdf-autotable';

let cachedFontBase64 = null;

const loadNotoSansFont = async (doc) => {
  try {
    if (!cachedFontBase64) {
      const res = await fetch('/fonts/NotoSans-Regular.ttf');
      if (!res.ok) throw new Error('Font file fetch failed');
      const buffer = await res.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      const CHUNK = 8192;
      for (let i = 0; i < len; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + CHUNK, len)));
      }
      cachedFontBase64 = btoa(binary);
    }
    doc.addFileToVFS('NotoSans.ttf', cachedFontBase64);
    doc.addFont('NotoSans.ttf', 'NotoSans', 'normal');
    doc.addFont('NotoSans.ttf', 'NotoSans', 'bold');
    doc.setFont('NotoSans', 'normal');
    return true;
  } catch (err) {
    console.warn('Could not load custom NotoSans font for PDF, falling back to Helvetica:', err);
    return false;
  }
};

/**
 * Currency formatter for jsPDF with ₹ symbol.
 */
export const fmtPdfAmount = (num) =>
  '₹ ' + Number(num || 0).toLocaleString('en-IN');

export const exportToPdf = async ({
  title = 'Masjid al noor Financial Statement',
  subtitle = '',
  dateRange = 'All Records',
  columns = [],
  rows = [],
  summaryRows = [],
  fileName = 'masjid_al_noor_statement.pdf'
}) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4'
  });

  const fontLoaded = await loadNotoSansFont(doc);
  const fontName = fontLoaded ? 'NotoSans' : 'helvetica';

  // If font failed to load, fallback to replace ₹ with Rs.
  const safe = (str) => {
    if (typeof str !== 'string') return str;
    return fontLoaded ? str : str.replace(/₹/g, 'Rs. ');
  };

  const pageW = doc.internal.pageSize.width;

  // ── Emerald Green Header Banner ─────────────────────────────────────────────
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, pageW, 80, 'F');

  // Main title
  doc.setFont(fontName, 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Masjid al noor', pageW / 2, 30, { align: 'center' });

  // Subtitle
  doc.setFont(fontName, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 252, 231);
  doc.text('sirajul huda sangam chulliyode', pageW / 2, 48, { align: 'center' });

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
      font: fontName,
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left'
    },
    bodyStyles: {
      font: fontName,
      fontSize: 8.5,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 40, right: 40 },
    didDrawPage: () => {
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFont(fontName, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageW / 2, doc.internal.pageSize.height - 20, { align: 'center' });
    }
  });

  // ── Summary box ─────────────────────────────────────────────────────────────
  let finalY = doc.lastAutoTable.finalY + 18;

  if (summaryRows && summaryRows.length > 0) {
    const boxW = 280;
    const boxX = pageW - 40 - boxW;
    const rowH = 19;
    const boxH = (summaryRows.length * rowH) + 16;

    if (finalY + boxH > doc.internal.pageSize.height - 70) {
      doc.addPage();
      finalY = 40;
    }

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(167, 243, 208);
    doc.roundedRect(boxX, finalY, boxW, boxH, 4, 4, 'FD');

    let sumY = finalY + 16;
    summaryRows.forEach(item => {
      doc.setFont(fontName, item.bold ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(
        item.highlight ? 5 : 51,
        item.highlight ? 150 : 65,
        item.highlight ? 105 : 85
      );
      doc.text(safe(item.label || ''), boxX + 12, sumY);
      doc.text(safe(item.value || ''), boxX + boxW - 12, sumY, { align: 'right' });
      sumY += rowH;
    });

    finalY = finalY + boxH + 25;
  }

  // ── Signatures ──────────────────────────────────────────────────────────────
  if (finalY + 50 > doc.internal.pageSize.height - 40) {
    doc.addPage();
    finalY = 60;
  }

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('_____________________________', 40, finalY + 30);
  doc.text('Prepared By (Staff / Admin)', 40, finalY + 45);
  doc.text('_____________________________', pageW - 180, finalY + 30);
  doc.text('Approved By (President / Treasurer)', pageW - 180, finalY + 45);

  doc.save(fileName);
};

/**
 * Dedicated Family Census / Survey PDF Export
 * Exports member name, division, job, family members (adults, children), and family notes/ages.
 */
export const exportFamilySurveyPdf = ({
  members = [],
  division = 'All Divisions',
  fileName = 'mahallu_family_survey_report.pdf'
}) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const pageW = doc.internal.pageSize.width;

  // Header banner
  doc.setFillColor(5, 150, 105);
  doc.rect(0, 0, pageW, 75, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('Masjid al noor', pageW / 2, 28, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 252, 231);
  doc.text('sirajul huda sangam chulliyode', pageW / 2, 45, { align: 'center' });

  doc.setFontSize(11);
  doc.setTextColor(236, 253, 245);
  doc.text('MAHALLU MEMBERS & FAMILY CENSUS SURVEY REPORT', pageW / 2, 63, { align: 'center' });

  // Metadata
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const printDate = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  doc.text(`Generated On: ${printDate}`, 40, 95);
  doc.text(`Division / Area: ${division}`, 40, 108);

  const totalMembers = members.length;
  const totalAdults = members.reduce((sum, m) => sum + (m.hasFamily ? (parseInt(m.adultsCount) || 0) : 0), 0);
  const totalChildren = members.reduce((sum, m) => sum + (m.hasFamily ? (parseInt(m.childrenCount) || 0) : 0), 0);
  const totalIndividuals = totalMembers + totalAdults + totalChildren;

  doc.text(`Total Houses/Members: ${totalMembers}  |  Adults: ${totalAdults}  |  Children: ${totalChildren}  |  Total Population: ${totalIndividuals}`, pageW - 40, 95, { align: 'right' });

  const columns = [
    '#',
    'ID No',
    'Head of House / Member',
    'Phone',
    'Division / Area',
    'Job / Profession',
    'Adults',
    'Children',
    'Family Details & Ages'
  ];

  const rows = members.map((m, idx) => [
    idx + 1,
    m.idNumber || '-',
    m.name || '-',
    m.phone || '-',
    m.division || '-',
    m.job || '-',
    m.hasFamily ? (m.adultsCount || 0) : '-',
    m.hasFamily ? (m.childrenCount || 0) : '-',
    m.familyDetails || (m.hasFamily ? 'Family registered' : 'Single Member')
  ]);

  const safeRows = rows.map(row =>
    row.map(cell => (typeof cell === 'string' ? safe(cell) : cell))
  );

  doc.autoTable({
    startY: 120,
    head: [columns.map(c => safe(c))],
    body: safeRows,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 78, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 45 },
      2: { cellWidth: 120 },
      3: { cellWidth: 75 },
      4: { cellWidth: 80 },
      5: { cellWidth: 80 },
      6: { cellWidth: 40, halign: 'center' },
      7: { cellWidth: 45, halign: 'center' },
      8: { cellWidth: 'auto' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 30, right: 30 },
    didDrawPage: () => {
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, pageW / 2, doc.internal.pageSize.height - 15, { align: 'center' });
    }
  });

  doc.save(fileName);
};

