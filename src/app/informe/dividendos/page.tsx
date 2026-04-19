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
      {rows.length === 0 && validation?.valid && (
        <p className="text-xs text-gray-400 text-center">
          El procesamiento de CSVs se implementará en la próxima versión.
        </p>
      )}
    </div>
  );
}
