"use client";

import { ExcelDownloadButton } from "@/components/informe/ExcelDownloadButton";
import { ReportTable } from "@/components/informe/ReportTable";
import { useExtractos } from "@/context/ExtractosContext";
import { parseOperaciones } from "@/lib/csv-parser";

const COLUMNS = ["Fecha", "ISIN", "Descripcion", "Compra/Venta (C-V)", "Numero", "Precio accion", "Moneda", "Comision(€)-Incluye AutoFX (DeGiro)", "Valor Total Transaccion en (€)"];

export default function TransaccionesPage() {
  const { csvFiles, validation } = useExtractos();
  const rows = parseOperaciones(csvFiles);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium text-gray-900">Histórico de Transacciones</h2>
        <ExcelDownloadButton
          data={rows}
          sheetName="Transacciones"
          filename="autorenta_transacciones"
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
