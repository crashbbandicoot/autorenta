"use client";

import { exportToExcel } from "@/lib/excel-exporter";

interface ExcelDownloadButtonProps {
  data: Record<string, unknown>[];
  sheetName: string;
  filename: string;
  disabled?: boolean;
}

export function ExcelDownloadButton({
  data,
  sheetName,
  filename,
  disabled,
}: ExcelDownloadButtonProps) {
  const handleDownload = () => {
    exportToExcel(data, sheetName, filename);
  };

  return (
    <button
      onClick={handleDownload}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
      Descargar Excel
    </button>
  );
}
