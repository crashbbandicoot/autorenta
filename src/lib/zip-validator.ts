import JSZip from "jszip";
import type { ValidationResult, CsvFile } from "@/types";

const VALID_FILE_REGEX = /^(dividendos|operaciones)_(\d{4})\.csv$/i;

export async function validateZip(file: File): Promise<ValidationResult> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return {
      valid: false,
      errors: ["El archivo debe tener extensión .zip"],
      files: [],
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    return {
      valid: false,
      errors: ["El archivo ZIP está corrupto o no es válido"],
      files: [],
    };
  }

  const entries = Object.entries(zip.files).filter(
    ([name, entry]) =>
      !name.startsWith("__MACOSX") &&
      !name.endsWith(".DS_Store") &&
      !entry.dir
  );

  if (entries.length === 0) {
    return { valid: false, errors: ["El ZIP está vacío"], files: [] };
  }

  const errors: string[] = [];
  const csvFiles: CsvFile[] = [];

  for (const [name, zipEntry] of entries) {
    const basename = name.split("/").pop() ?? name;
    const match = VALID_FILE_REGEX.exec(basename);
    if (!match) {
      errors.push(
        `Archivo no permitido: "${basename}". Solo se aceptan archivos con formato dividendos_AÑO.csv u operaciones_AÑO.csv`
      );
    } else {
      const content = await zipEntry.async("string");
      csvFiles.push({
        name: basename,
        year: parseInt(match[2], 10),
        type: match[1].toLowerCase() as "dividendos" | "operaciones",
        rawContent: content,
      });
    }
  }

  const names = csvFiles.map((f) => f.name);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicates.length > 0) {
    errors.push(`Archivos duplicados: ${duplicates.join(", ")}`);
  }

  return { valid: errors.length === 0, errors, files: csvFiles };
}
