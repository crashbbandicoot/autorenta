"use client";

import { ExcelDownloadButton } from "@/components/informe/ExcelDownloadButton";
import { ReportTable } from "@/components/informe/ReportTable";
import { useExtractos } from "@/context/ExtractosContext";
import { parseDividendos } from "@/lib/csv-parser";

const COLUMNS = ["Fecha", "ISIN", "Producto", "Pais", "Valor Bruto (€)", "Retencion origen(€)", "Valor Neto(€)"];

export default function DividendosPage() {
  const { csvFiles, validation } = useExtractos();
  const rows = parseDividendos(csvFiles);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-gray-900">Histórico de Dividendos</h2>
        <ExcelDownloadButton
          data={rows}
          sheetName="Dividendos"
          filename="autorenta_dividendos"
          disabled={!validation?.valid}
        />
      </div>
      <ReportTable columns={COLUMNS} rows={rows} />
      {rows.length === 0 && validation?.valid && csvFiles.some((f) => f.type === "dividendos") && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800 space-y-1">
          <p className="font-medium">No se generaron filas a partir de los archivos de dividendos.</p>
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
