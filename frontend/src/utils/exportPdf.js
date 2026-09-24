import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const exportToPdf = ({
  title = 'جامعة النور Financial Statement',
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

  // Emerald Green Header Banner
  doc.setFillColor(5, 150, 105); // #059669
  doc.rect(0, 0, doc.internal.pageSize.width, 80, 'F');

  // Mosque Title & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('JAMIA AN-NOOR', doc.internal.pageSize.width / 2, 30, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 252, 231);
  doc.text('\u062c\u0627\u0645\u0639\u0629 \u0627\u0644\u0646\u0648\u0631  \u2022  Masjid Management System', doc.internal.pageSize.width / 2, 48, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(236, 253, 245);
  doc.text(title.toUpperCase(), doc.internal.pageSize.width / 2, 66, { align: 'center' });

  // Metadata Card
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const printDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  doc.text(`Generated On: ${printDate}`, 40, 105);
  doc.text(`Period / Filter: ${dateRange}`, 40, 120);

  if (subtitle) {
    doc.text(subtitle, doc.internal.pageSize.width - 40, 105, { align: 'right' });
  }

  // Generate Table
  doc.autoTable({
    startY: 135,
    head: [columns],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [6, 78, 59], // #064e3b
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
    didDrawPage: (data) => {
      // Footer page numbers
      const str = `Page ${doc.internal.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 20, { align: 'center' });
    }
  });

  // Summary box or Totals at the end of the table
  let finalY = doc.lastAutoTable.finalY + 20;

  if (summaryRows && summaryRows.length > 0) {
    if (finalY + (summaryRows.length * 18) > doc.internal.pageSize.height - 80) {
      doc.addPage();
      finalY = 50;
    }

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(167, 243, 208);
    doc.rect(doc.internal.pageSize.width - 260, finalY, 220, (summaryRows.length * 20) + 12, 'FD');

    let currentSumY = finalY + 16;
    summaryRows.forEach(item => {
      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      doc.setFontSize(9);
      doc.setTextColor(item.highlight ? 5 : 51, item.highlight ? 150 : 65, item.highlight ? 105 : 85);
      doc.text(item.label, doc.internal.pageSize.width - 250, currentSumY);
      doc.text(item.value, doc.internal.pageSize.width - 50, currentSumY, { align: 'right' });
      currentSumY += 18;
    });

    finalY = currentSumY + 40;
  }

  // Signatures
  if (finalY + 50 > doc.internal.pageSize.height - 40) {
    doc.addPage();
    finalY = 60;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('_____________________________', 40, finalY + 30);
  doc.text('Prepared By (Staff / Admin)', 40, finalY + 45);

  doc.text('_____________________________', doc.internal.pageSize.width - 180, finalY + 30);
  doc.text('Approved By (President / Treasurer)', doc.internal.pageSize.width - 180, finalY + 45);

  // Save the PDF
  doc.save(fileName);
};
