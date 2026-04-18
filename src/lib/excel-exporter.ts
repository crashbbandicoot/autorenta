import * as XLSX from "xlsx";

export function exportToExcel(
  data: Record<string, unknown>[],
  sheetName: string,
  filename: string
) {
  const ws = XLSX.utils.json_to_sheet(data.length > 0 ? data : [{}]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
