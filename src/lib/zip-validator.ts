import JSZip from "jszip";
import Papa from "papaparse";
import type { ValidationResult, CsvFile } from "@/types";

const VALID_FILE_REGEX = /^(dividendos|operaciones|actividad)_(\d{4})\.csv$/i;

// Asset classes the parser knows how to handle. Anything outside this set
// gets treated as STK (non-cash), which may produce wrong P&L figures.
const KNOWN_ASSET_CLASSES = new Set(["STK", "OPT", "FUT", "FOP", "CASH", "WAR"]);

// Columns the operaciones parser depends on by name
const OPERACIONES_REQUIRED_COLS = [
  "LevelOfDetail",
  "TransactionType",
  "Buy/Sell",
  "TradeDate",
  "ISIN",
  "Symbol",
  "AssetClass",
  "FXRateToBase",
  "IBCommission",
  "Quantity",
  "TradeMoney",
  "NetCash",
  "TradePrice",
  "IBOrderID",
  "CostBasis",
  "CurrencyPrimary",
  "Notes/Codes",
];

function validateCsvContent(csvFile: CsvFile): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (csvFile.rawContent.trim().length === 0) {
    errors.push(`${csvFile.name}: el archivo está vacío.`);
    return { errors, warnings };
  }

  if (csvFile.type === "operaciones") {
    const parsed = Papa.parse<Record<string, string>>(csvFile.rawContent, {
      header: true,
      skipEmptyLines: true,
    });

    const headers = parsed.meta.fields ?? [];
    const missing = OPERACIONES_REQUIRED_COLS.filter((c) => !headers.includes(c));

    if (missing.length > 0) {
      errors.push(
        `${csvFile.name}: columnas no encontradas: ${missing.join(", ")}. ` +
          `¿Ha cambiado el formato de exportación de IBKR? Reporta este error adjuntando el nombre del archivo.`
      );
    } else {
      const execRows = parsed.data.filter(
        (r) => r["LevelOfDetail"] === "EXECUTION" && r["Model"] !== "Model"
      );
      if (execRows.length === 0) {
        warnings.push(
          `${csvFile.name}: no contiene operaciones ejecutadas (LevelOfDetail=EXECUTION). ` +
            `El archivo es estructuralmente correcto pero no aportará datos al informe.`
        );
      }

      // Warn about unknown asset classes — treated as STK which may produce wrong P&L
      const unknownClasses = [
        ...new Set(
          execRows
            .filter((r) => r["TransactionType"] === "ExchTrade")
            .map((r) => r["AssetClass"])
            .filter((ac): ac is string => !!ac && !KNOWN_ASSET_CLASSES.has(ac))
        ),
      ];
      if (unknownClasses.length > 0) {
        warnings.push(
          `${csvFile.name}: tipo(s) de activo no reconocido(s): ${unknownClasses.join(", ")}. ` +
            `El programa los calculará como acciones ordinarias, lo que puede producir cifras incorrectas. ` +
            `Reporta este aviso indicando el nombre del archivo y el tipo de activo.`
        );
      }
    }
  } else if (csvFile.type === "actividad") {
    const hasSection = csvFile.rawContent.includes(
      "Realized & Unrealized Performance Summary"
    );
    if (!hasSection) {
      errors.push(
        `${csvFile.name}: no se encontró la sección "Realized & Unrealized Performance Summary". ` +
          `Este archivo no parece ser un Activity Statement de IBKR. ` +
          `Descarga el informe en formato CSV desde IBKR y renómbralo a actividad_AÑO.csv.`
      );
    }
  } else if (csvFile.type === "dividendos") {
    const parsed = Papa.parse<string[]>(csvFile.rawContent, {
      header: false,
      skipEmptyLines: true,
    });

    const hasDividendSection = parsed.data.some((row) => row[0] === "DividendDetail");

    if (!hasDividendSection) {
      errors.push(
        `${csvFile.name}: no se encontró la sección "DividendDetail". ` +
          `Este archivo no parece ser un extracto de dividendos de IBKR. ` +
          `Reporta este error adjuntando el nombre del archivo.`
      );
    } else {
      const dataRows = parsed.data.filter(
        (row) =>
          row[0] === "DividendDetail" &&
          row[1] === "Data" &&
          row[2] === "RevenueComponent"
      );

      if (dataRows.length === 0) {
        warnings.push(
          `${csvFile.name}: contiene la sección DividendDetail pero sin filas de datos (RevenueComponent). ` +
            `¿Ha cambiado el formato de exportación de IBKR? Reporta este error si los datos parecen correctos.`
        );
      } else {
        // Validate that key positional columns look right in the first data row
        const sample = dataRows[0];
        const dateField = sample[7] ?? "";
        const grossField = sample[13] ?? "";
        if (!/^\d{8}$/.test(dateField) || isNaN(parseFloat(grossField))) {
          errors.push(
            `${csvFile.name}: las columnas de fecha (pos 7: "${dateField}") o importe (pos 13: "${grossField}") ` +
              `no tienen el formato esperado. ¿Ha cambiado el orden de columnas de IBKR? Reporta este error.`
          );
        }
      }
    }
  }

  return { errors, warnings };
}

export async function validateZip(file: File): Promise<ValidationResult> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return {
      valid: false,
      errors: ["El archivo debe tener extensión .zip"],
      warnings: [],
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
      warnings: [],
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
    return { valid: false, errors: ["El ZIP está vacío"], warnings: [], files: [] };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
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
      const csvFile: CsvFile = {
        name: basename,
        year: parseInt(match[2], 10),
        type: match[1].toLowerCase() as "dividendos" | "operaciones" | "actividad",
        rawContent: content,
      };

      const contentCheck = validateCsvContent(csvFile);
      errors.push(...contentCheck.errors);
      warnings.push(...contentCheck.warnings);

      csvFiles.push(csvFile);
    }
  }

  const names = csvFiles.map((f) => f.name);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicates.length > 0) {
    errors.push(`Archivos duplicados: ${duplicates.join(", ")}`);
  }

  return { valid: errors.length === 0, errors, warnings, files: csvFiles };
}
