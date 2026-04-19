"use client";

import { ExcelDownloadButton } from "@/components/informe/ExcelDownloadButton";
import { ReportTable } from "@/components/informe/ReportTable";
import { useExtractos } from "@/context/ExtractosContext";
import { calcularInformeDividendos } from "@/lib/csv-parser";

const COLUMNS = [
  "Año",
  "País",
  "Importe Bruto (€)",
  "Reten. Ori.(€)",
  "Reten. Des.(€)",
  "% Retenciones",
  "Casilla 0029 — Importe Bruto (€)",
  "Reten. dest. -España- (€)",
  "Casilla 0588 — Bruto Doble Impo. (€)",
  "Reten. ori. Doble Impo. (€)",
  "% según lím. convenio",
];

export default function InformeDividendosPage() {
  const { csvFiles, validation } = useExtractos();
  const rows = calcularInformeDividendos(csvFiles) as unknown as Record<string, unknown>[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-gray-900">Informe de Dividendos</h2>
        <ExcelDownloadButton
          data={rows}
          sheetName="InformeDividendos"
          filename="autorenta_informe_dividendos"
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
            <li>El formato del CSV ha cambiado (posible actualización de IBKR).</li>
          </ul>
        </div>
      )}
    </div>
  );
}
