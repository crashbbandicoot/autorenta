export interface CsvFile {
  name: string;
  year: number;
  type: "dividendos" | "operaciones";
  rawContent: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  files: CsvFile[];
}

export interface DividendRow {
  [key: string]: string | number;
}

export interface TransaccionRow {
  [key: string]: string | number;
}

export interface PygRow {
  [key: string]: string | number;
}

export interface ExtractosState {
  zipFile: File | null;
  validation: ValidationResult | null;
  csvFiles: CsvFile[];
  isValidating: boolean;
  setZipFile: (file: File) => Promise<void>;
  clearFiles: () => void;
}
