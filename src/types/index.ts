export interface CsvFile {
  name: string;
  year: number;
  type: "dividendos" | "operaciones" | "actividad";
  rawContent: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  files: CsvFile[];
}

export interface DividendRow {
  [key: string]: string | number;
}

export interface TransaccionRow {
  [key: string]: string | number;
}

export interface PygRow {
  Año: number;
  Tipo: string;
  ISIN: string;
  Producto: string;
  "Ganancia (€)": number;
  "Pérdida si puede imputarse (€)": number;
  "Pérdida desbloqueada de otros años (ya incluida en la perdida que puede imputarse) (€)": number;
  "Pérdida que no puede imputarse (regla 2 meses) (€)": number;
}

export interface InformeDividendosRow {
  Año: number;
  País: string;
  "Importe Bruto (€)": number;
  "Reten. Ori.(€)": number;
  "Reten. Des.(€)": number;
  "% Retenciones": number;
  "Casilla 0029 — Importe Bruto (€)": number;
  "Reten. dest. -España- (€)": number;
  "Casilla 0588 — Bruto Doble Impo. (€)": number;
  "Reten. ori. Doble Impo. (€)": number;
  "% según lím. convenio": number;
}

export interface ExtractosState {
  zipFile: File | null;
  validation: ValidationResult | null;
  csvFiles: CsvFile[];
  isValidating: boolean;
  setZipFile: (file: File) => Promise<void>;
  clearFiles: () => void;
}
