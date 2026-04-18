import Link from "next/link";

interface ReportTableProps {
  columns: string[];
  rows: Record<string, unknown>[];
}

export function ReportTable({ columns, rows }: ReportTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
        <svg className="h-10 w-10 text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="text-sm font-medium text-gray-500">No hay datos disponibles</p>
        <p className="mt-1 text-xs text-gray-400">
          Sube un ZIP válido en{" "}
          <Link href="/subir-extractos" className="underline hover:text-gray-600">
            Subir extractos
          </Link>{" "}
          para ver el informe.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
              {columns.map((col) => (
                <td key={col} className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                  {String(row[col] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
