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
      {validation?.valid && (
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800 space-y-1">
          <p className="font-medium">El cálculo del Informe de Dividendos está pendiente de implementación.</p>
          <p>Las columnas ya reflejan el formato final del informe (casillas 0029 y 0588). Los datos se mostrarán aquí en cuanto se complete el backend.</p>
        </div>
      )}
    </div>
  );
}
