import type { CsvFile } from "@/types";
import { cn } from "@/lib/utils";

interface FileListProps {
  files: CsvFile[];
}

export function FileList({ files }: FileListProps) {
  if (files.length === 0) return null;

  const sorted = [...files].sort((a, b) => b.year - a.year || a.type.localeCompare(b.type));

  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Archivo
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Tipo
            </th>
            <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Año
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((file) => (
            <tr key={file.name} className="border-b border-gray-50 last:border-0">
              <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{file.name}</td>
              <td className="px-4 py-2.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    file.type === "dividendos"
                      ? "bg-purple-50 text-purple-700"
                      : "bg-blue-50 text-blue-700"
                  )}
                >
                  {file.type === "dividendos" ? "Dividendos" : "Operaciones"}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-600">{file.year}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
