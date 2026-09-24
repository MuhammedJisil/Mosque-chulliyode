import * as XLSX from 'xlsx';

export const exportToExcel = ({
  data = [],
  sheetName = 'Statement',
  fileName = 'statement.xlsx'
}) => {
  // Create worksheet from json data
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Set column auto-widths
  const colWidths = Object.keys(data[0] || {}).map(key => ({
    wch: Math.max(key.length, 14)
  }));
  worksheet['!cols'] = colWidths;

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Write file
  XLSX.writeFile(workbook, fileName);
};
