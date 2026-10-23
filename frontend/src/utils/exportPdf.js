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

/**
 * Generate official Single Income Receipt Bill (A5 Landscape)
 */
export const exportSingleIncomeReceiptPdf = async (item) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a5'
  });

  const fontLoaded = await loadNotoSansFont(doc);
  const fontName = fontLoaded ? 'NotoSans' : 'helvetica';
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;

  const safe = (str) => {
    if (!str && str !== 0) return '-';
    const s = String(str);
    return fontLoaded ? s : s.replace(/₹/g, 'Rs. ');
  };

  // Format date as DD/MM/YYYY
  let dateFormatted = '-';
  if (item.date) {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      dateFormatted = `${day}/${month}/${year}`;
    }
  }

  // Outer Border Box
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(20, 18, pageW - 40, pageH - 36, 6, 6, 'S');

  // Header Banner
  doc.setFillColor(5, 150, 105);
  doc.roundedRect(21, 19, pageW - 42, 58, 5, 5, 'F');

  // Header Mosque Details
  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Masjid al noor', 35, 42);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 252, 231);
  doc.text('sirajul huda sangam chulliyode • PIN: 673592', 35, 57);

  // Receipt Badge on Right
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(pageW - 195, 28, 160, 24, 4, 4, 'F');
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(5, 150, 105);
  doc.text('OFFICIAL INCOME RECEIPT', pageW - 115, 44, { align: 'center' });

  // Receipt Info Strip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(21, 78, pageW - 42, 28, 'FD');

  const receiptNo = item.receiptNo || `RCP-INC-${String(item.id).padStart(5, '0')}`;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Receipt No: ${receiptNo}`, 35, 96);
  doc.text(`Date: ${dateFormatted}`, pageW - 35, 96, { align: 'right' });

  // Details Grid
  let curY = 126;
  const drawRow = (label, value, y) => {
    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(label, 35, y);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(safe(value), 175, y);
  };

  drawRow('Received From (Donor):', item.donorName || 'General Donor', curY);
  curY += 22;

  if (item.donorPhone || item.donorAddress) {
    const contactInfo = [item.donorPhone, item.donorAddress].filter(Boolean).join(' • ');
    drawRow('Contact / Address:', contactInfo, curY);
    curY += 22;
  }

  drawRow('Income Category / Head:', item.category || 'General Donation', curY);
  curY += 22;

  drawRow('Payment Mode:', item.paymentMode || 'Cash', curY);
  curY += 22;

  if (item.description) {
    drawRow('Particulars / Remarks:', item.description, curY);
    curY += 24;
  } else {
    curY += 6;
  }

  // Amount Highlight Box
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(110, 231, 183);
  doc.setLineWidth(1.5);
  doc.roundedRect(35, curY, pageW - 70, 46, 6, 6, 'FD');

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(4, 120, 87);
  doc.text('AMOUNT RECEIVED:', 48, curY + 18);

  const amtFormatted = safe(`₹ ${Number(item.amount || 0).toLocaleString('en-IN')}`);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(5, 150, 105);
  doc.text(amtFormatted, 48, curY + 38);

  // Status Stamp inside Box
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(4, 120, 87);
  doc.text('PAID & ACKNOWLEDGED ✓', pageW - 48, curY + 28, { align: 'right' });

  // Signature lines at bottom
  const sigY = pageH - 55;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.line(35, sigY, 190, sigY);
  doc.line(pageW - 190, sigY, pageW - 35, sigY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Treasurer / Authorized Signature', 35, sigY + 14);
  doc.text('Secretary / Seal', pageW - 35, sigY + 14, { align: 'right' });

  // Footer blessing
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text('May Allah accept this contribution and bless your family with barakah.', pageW / 2, pageH - 24, { align: 'center' });

  const cleanName = (item.donorName || 'income').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Receipt_${receiptNo}_${cleanName}.pdf`);
};

/**
 * Generate official Single Expense Voucher Bill (A5 Landscape)
 */
export const exportSingleExpenseVoucherPdf = async (item) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a5'
  });

  const fontLoaded = await loadNotoSansFont(doc);
  const fontName = fontLoaded ? 'NotoSans' : 'helvetica';
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;

  const safe = (str) => {
    if (!str && str !== 0) return '-';
    const s = String(str);
    return fontLoaded ? s : s.replace(/₹/g, 'Rs. ');
  };

  // Format date as DD/MM/YYYY
  let dateFormatted = '-';
  if (item.date) {
    const d = new Date(item.date);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      dateFormatted = `${day}/${month}/${year}`;
    }
  }

  // Outer Border Box
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1);
  doc.roundedRect(20, 18, pageW - 40, pageH - 36, 6, 6, 'S');

  // Header Banner (Rose / Slate themed for expense)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(21, 19, pageW - 42, 58, 5, 5, 'F');

  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('Masjid al noor', 35, 42);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text('sirajul huda sangam chulliyode • Financial Administration', 35, 57);

  // Voucher Badge on Right
  doc.setFillColor(225, 29, 72); // rose-600
  doc.roundedRect(pageW - 205, 28, 170, 24, 4, 4, 'F');
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('PAYMENT EXPENSE VOUCHER', pageW - 120, 44, { align: 'center' });

  // Voucher Info Strip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(21, 78, pageW - 42, 28, 'FD');

  const voucherNo = `VCH-EXP-${String(item.id).padStart(5, '0')}`;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`Voucher No: ${voucherNo}`, 35, 96);
  doc.text(`Date: ${dateFormatted}`, pageW - 35, 96, { align: 'right' });

  // Details Grid
  let curY = 126;
  const drawRow = (label, value, y) => {
    doc.setFont(fontName, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(label, 35, y);

    doc.setFont(fontName, 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(safe(value), 175, y);
  };

  drawRow('Paid To (Recipient / Vendor):', item.paidTo || '-', curY);
  curY += 22;

  drawRow('Expense Category:', item.category || 'General Expense', curY);
  curY += 22;

  if (item.purpose) {
    drawRow('Purpose of Payment:', item.purpose, curY);
    curY += 22;
  }

  drawRow('Payment Mode:', item.paymentMode || 'Cash', curY);
  curY += 22;

  if (item.description) {
    drawRow('Particulars / Remarks:', item.description, curY);
    curY += 24;
  } else {
    curY += 6;
  }

  // Amount Highlight Box
  doc.setFillColor(255, 241, 242); // rose-50
  doc.setDrawColor(253, 164, 175); // rose-300
  doc.setLineWidth(1.5);
  doc.roundedRect(35, curY, pageW - 70, 46, 6, 6, 'FD');

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(190, 18, 60);
  doc.text('TOTAL AMOUNT DISBURSED:', 48, curY + 18);

  const amtFormatted = safe(`₹ ${Number(item.amount || 0).toLocaleString('en-IN')}`);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.setTextColor(225, 29, 72);
  doc.text(amtFormatted, 48, curY + 38);

  // Status Stamp inside Box
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(190, 18, 60);
  doc.text('DISBURSED & VERIFIED ✓', pageW - 48, curY + 28, { align: 'right' });

  // Signature lines at bottom
  const sigY = pageH - 55;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.8);
  doc.line(35, sigY, 190, sigY);
  doc.line(pageW - 190, sigY, pageW - 35, sigY);

  doc.setFont(fontName, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Passed & Prepared By', 35, sigY + 14);
  doc.text('Approved By (President / Treasurer)', pageW - 35, sigY + 14, { align: 'right' });

  const cleanName = (item.paidTo || item.category || 'expense').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Voucher_${voucherNo}_${cleanName}.pdf`);
};


