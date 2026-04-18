import type { CsvFile, DividendRow, TransaccionRow } from "@/types";

export function parseDividendos(_files: CsvFile[]): DividendRow[] {
  // STUB: implementar cuando se conozca la estructura de columnas IBKR
  return [];
}

export function parseOperaciones(_files: CsvFile[]): TransaccionRow[] {
  // STUB: implementar cuando se conozca la estructura de columnas IBKR
  return [];
}

export function calcularPyG(_transacciones: TransaccionRow[]): Record<string, unknown>[] {
  // STUB: cálculo FIFO pendiente de implementar
  return [];
}
