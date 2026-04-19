"use client";

import { ExcelDownloadButton } from "@/components/informe/ExcelDownloadButton";
import { ReportTable } from "@/components/informe/ReportTable";
import { useExtractos } from "@/context/ExtractosContext";
import { calcularPyG } from "@/lib/csv-parser";

const COLUMNS = ["Año", "Ticker", "Tipo", "F. Compra", "F. Venta", "Precio Compra", "Precio Venta", "Resultado (EUR)"];

export default function PygPage() {
  const { csvFiles, validation } = useExtractos();
  const rows = calcularPyG(csvFiles) as unknown as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-gray-900">Informe de Pérdidas y Ganancias</h2>
        <ExcelDownloadButton
          data={rows}
          sheetName="PyG"
          filename="autorenta_pyg"
          disabled={!validation?.valid}
        />
      </div>
      <ReportTable columns={COLUMNS} rows={rows} />
      {rows.length === 0 && validation?.valid && csvFiles.some((f) => f.type === "operaciones") && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800 space-y-1">
          <p className="font-medium">No se generaron filas de P&amp;G a partir de los archivos de transacciones.</p>
          <p>Causas posibles:</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700">
            <li>La sesión expiró — vuelve a <a href="/subir-extractos" className="underline">Subir extractos</a> para recargar el ZIP.</li>
            <li>El formato del CSV ha cambiado (posible actualización de IBKR). Si los datos parecen correctos, reporta el problema indicando el nombre del archivo afectado.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
