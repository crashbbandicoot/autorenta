"use client";

import { ExcelDownloadButton } from "@/components/informe/ExcelDownloadButton";
import { ReportTable } from "@/components/informe/ReportTable";
import { useExtractos } from "@/context/ExtractosContext";
import { parseOperaciones, calcularPyG } from "@/lib/csv-parser";

const COLUMNS = ["Año", "Ticker", "Tipo", "F. Compra", "F. Venta", "Precio Compra", "Precio Venta", "Resultado (EUR)"];

export default function PygPage() {
  const { csvFiles, validation } = useExtractos();
  const transacciones = parseOperaciones(csvFiles);
  const rows = calcularPyG(transacciones) as Record<string, unknown>[];

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
      {rows.length === 0 && validation?.valid && (
        <p className="text-xs text-gray-400 text-center">
          El procesamiento de CSVs se implementará en la próxima versión.
        </p>
      )}
    </div>
  );
}
