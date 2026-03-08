import * as XLSX from 'xlsx';

export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  if (data.length === 0) return;

  // Convert data array to worksheet
  const ws = XLSX.utils.json_to_sheet(data);

  // Auto-size columns based on content
  const keys = Object.keys(data[0] || {});
  const colWidths = keys.map(key => ({
    wch: Math.max(
      key.length,
      ...data.map(row => String(row[key] ?? '').length)
    ) + 2
  }));
  ws['!cols'] = colWidths;

  // Create workbook and add worksheet
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate and download file
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
