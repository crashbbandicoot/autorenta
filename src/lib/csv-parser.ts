import Papa from "papaparse";
import type { CsvFile, DividendRow, TransaccionRow, PygRow } from "@/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(yyyymmdd: string): string {
  // "20220506" → "2022-05-06"
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

function f(s: string | undefined): number {
  return parseFloat(s ?? "0") || 0;
}

// ─── parseDividendos ─────────────────────────────────────────────────────────

export function parseDividendos(files: CsvFile[]): DividendRow[] {
  const rows: DividendRow[] = [];

  const divFiles = files
    .filter((f) => f.type === "dividendos")
    .sort((a, b) => a.year - b.year);

  for (const file of divFiles) {
    const parsed = Papa.parse<string[]>(file.rawContent, {
      header: false,
      skipEmptyLines: true,
    });

    for (const row of parsed.data) {
      if (
        row[0] !== "DividendDetail" ||
        row[1] !== "Data" ||
        row[2] !== "RevenueComponent"
      ) {
        continue;
      }

      const revenueComponent = row[10] ?? "";
      const grossInBase = f(row[13]);
      const withholdInBase = f(row[16]);
      const valorBruto = r2(grossInBase);
      const valorNeto = r2(grossInBase + withholdInBase);

      rows.push({
        Broker: "IBKR",
        Fecha: fmtDate(row[7]),
        Pais: revenueComponent.includes("Return of Capital")
          ? "Return of Capital"
          : (row[6] ?? ""),
        ISIN: row[5] ?? "",
        Producto: `${row[4]}-${revenueComponent}`,
        "Valor Bruto (€)": valorBruto,
        "Valor Neto(€)": valorNeto,
        "Retencion origen(€)": r2(Math.abs(withholdInBase)),
        "Retencion destino(€)": 0,
      });
    }
  }

  return rows;
}

// ─── helpers for parseOperaciones ─────────────────────────────────────────

function hasPartialFlag(notes: string): boolean {
  return (notes ?? "").split(";").includes("P");
}

function collectRawOpRows(files: CsvFile[]): Record<string, string>[] {
  const allRows: Record<string, string>[] = [];
  const opFiles = files
    .filter((f) => f.type === "operaciones")
    .sort((a, b) => a.year - b.year);

  for (const file of opFiles) {
    const parsed = Papa.parse<Record<string, string>>(file.rawContent, {
      header: true,
      skipEmptyLines: true,
    });
    parsed.data
      .filter(
        (r) =>
          r["Model"] !== "Model" &&
          r["LevelOfDetail"] === "EXECUTION" &&
          r["TransactionType"] === "ExchTrade" &&
          (r["Buy/Sell"] === "BUY" || r["Buy/Sell"] === "SELL")
      )
      .forEach((r) => allRows.push(r));
  }
  return allRows;
}

function aggregatePartialFills(
  rawRows: Record<string, string>[]
): Record<string, string>[] {
  // Group by IBOrderID to detect partial fills
  const byOrderId = new Map<string, Record<string, string>[]>();
  for (const r of rawRows) {
    const id = r["IBOrderID"] ?? "";
    const group = byOrderId.get(id) ?? [];
    group.push(r);
    byOrderId.set(id, group);
  }

  const result: Record<string, string>[] = [];
  for (const rows of byOrderId.values()) {
    const hasP = rows.some((r) => hasPartialFlag(r["Notes/Codes"]));
    if (!hasP || rows.length === 1) {
      result.push(...rows);
    } else {
      // Aggregate: sum numeric fields, use last fill for metadata
      // Use first fill's DateTime so sort position reflects when the order started
      const first = rows[0];
      const last = rows[rows.length - 1];
      const sumQty = rows.reduce((s, r) => s + f(r["Quantity"]), 0);
      const sumTM = rows.reduce((s, r) => s + f(r["TradeMoney"]), 0);
      const sumNC = rows.reduce((s, r) => s + f(r["NetCash"]), 0);
      const sumComm = rows.reduce((s, r) => s + f(r["IBCommission"]), 0);
      const sumCB = rows.reduce((s, r) => s + f(r["CostBasis"]), 0);
      const avgPrice = sumQty !== 0 ? Math.abs(sumTM) / Math.abs(sumQty) : 0;

      result.push({
        ...last,
        DateTime: first["DateTime"] || last["DateTime"],
        Quantity: String(sumQty),
        TradeMoney: String(sumTM),
        NetCash: String(sumNC),
        IBCommission: String(sumComm),
        CostBasis: String(sumCB),
        TradePrice: String(avgPrice),
      });
    }
  }

  // Sort by DateTime ascending; secondary sort by ISIN/Symbol for same-second ties
  result.sort((a, b) => {
    const dtCmp = (a["DateTime"] ?? a["TradeDate"] ?? "").localeCompare(
      b["DateTime"] ?? b["TradeDate"] ?? ""
    );
    if (dtCmp !== 0) return dtCmp;
    const aKey = a["ISIN"] || a["Symbol"] || "";
    const bKey = b["ISIN"] || b["Symbol"] || "";
    return aKey.localeCompare(bKey);
  });
  return result;
}

function rowToTransaccion(r: Record<string, string>): TransaccionRow {
  const isCash = r["AssetClass"] === "CASH";
  const fx = f(r["FXRateToBase"]);
  const qty = Math.abs(f(r["Quantity"]));
  const tradeMoney = Math.abs(f(r["TradeMoney"]));
  const ibComm = f(r["IBCommission"]); // always ≤ 0
  const buySell = r["Buy/Sell"];

  // For CASH forex: SELL base currency = buying quote currency (EUR perspective)
  const cv = isCash
    ? buySell === "SELL"
      ? "C"
      : "V"
    : buySell === "BUY"
      ? "C"
      : "V";

  const isBuy = cv === "C";

  // CASH: IBCommission is already in EUR. STK/OPT/FUT: convert via FX.
  const comisionEur = isCash ? ibComm : ibComm * fx; // always ≤ 0

  const precioTxMonedaRaw = tradeMoney * fx;

  // BUY total cost = trade EUR value + commission (commission is negative, so subtract)
  // SELL net proceeds = trade EUR value - commission (commission is negative, so add)
  const valorTotal = isBuy
    ? r5(precioTxMonedaRaw - comisionEur)
    : r5(precioTxMonedaRaw + comisionEur);

  return {
    Broker: "IBKR",
    ISIN: isCash ? (r["Symbol"] ?? "") : (r["ISIN"] ?? ""),
    Descripcion: isCash ? (r["Symbol"] ?? "") : (r["Description"] ?? ""),
    "Compra/Venta (C-V)": cv,
    Fecha: fmtDate(r["TradeDate"]),
    Numero: qty.toFixed(8),
    "Numero (despues de acciones corporativas)": qty.toFixed(8),
    Moneda: r["CurrencyPrimary"] ?? "",
    "Precio accion": Math.abs(f(r["TradePrice"])).toFixed(8),
    "Precio transaccion en moneda accion": r5(tradeMoney * fx),
    "Precio transaccion": r5(tradeMoney),
    "Comision(€)-Incluye AutoFX (DeGiro)": comisionEur,
    "Valor Total Transaccion en (€)": valorTotal,
    "Tipo de Cambio (Moneda/EUR)": fx.toFixed(8),
  };
}

// ─── parseOperaciones ────────────────────────────────────────────────────────

export function parseOperaciones(files: CsvFile[]): TransaccionRow[] {
  const rawRows = collectRawOpRows(files);
  const aggregated = aggregatePartialFills(rawRows);
  return aggregated.map(rowToTransaccion);
}

// ─── calcularPyG ─────────────────────────────────────────────────────────────

interface Lot {
  qty: number;
  costPerUnit: number; // in native currency
  fxAtBuy: number;
  buyDate: string;
}

interface RawTrade {
  date: string;
  isin: string; // ISIN for STK/OPT, Symbol for CASH
  assetClass: string;
  buySell: string;
  qty: number;
  tradeMoney: number; // abs value
  netCash: number; // abs value
  costBasis: number; // abs value (from CostBasis field)
  fx: number;
}

function parseRawTrades(files: CsvFile[]): RawTrade[] {
  const rawRows = collectRawOpRows(files);
  const aggregated = aggregatePartialFills(rawRows); // already sorted by date

  return aggregated.map((r) => ({
    date: r["TradeDate"] ?? "",
    isin:
      r["AssetClass"] === "CASH" ? (r["Symbol"] ?? "") : (r["ISIN"] ?? ""),
    assetClass: r["AssetClass"] ?? "",
    buySell: r["Buy/Sell"] ?? "",
    qty: Math.abs(f(r["Quantity"])),
    tradeMoney: Math.abs(f(r["TradeMoney"])),
    netCash: Math.abs(f(r["NetCash"])),
    costBasis: Math.abs(f(r["CostBasis"])),
    fx: f(r["FXRateToBase"]),
  }));
}

export function calcularPyG(files: CsvFile[]): PygRow[] {
  const rawTrades = parseRawTrades(files);
  const lots = new Map<string, Lot[]>();
  const result: PygRow[] = [];

  for (const trade of rawTrades) {
    const { isin, assetClass, buySell, qty, tradeMoney, netCash, costBasis, fx, date } = trade;
    const isCash = assetClass === "CASH";

    if (buySell === "BUY") {
      const lotList = lots.get(isin) ?? [];
      // costPerUnit in native currency
      const costPerUnit = isCash
        ? (qty > 0 ? tradeMoney / qty : 0)
        : (qty > 0 ? costBasis / qty : 0);

      lotList.push({ qty, costPerUnit, fxAtBuy: fx, buyDate: date });
      lots.set(isin, lotList);
    } else {
      // SELL — match against FIFO lots
      const lotList = lots.get(isin) ?? [];
      let remainingQty = qty;
      let costBasisEur = 0;
      let oldestBuyDate = date;

      for (let i = 0; i < lotList.length && remainingQty > 0; i++) {
        const lot = lotList[i];
        const matched = Math.min(remainingQty, lot.qty);
        costBasisEur += matched * lot.costPerUnit * lot.fxAtBuy;
        if (i === 0) oldestBuyDate = lot.buyDate;
        lot.qty -= matched;
        remainingQty -= matched;
      }

      // Remove exhausted lots
      lots.set(
        isin,
        lotList.filter((l) => l.qty > 1e-10)
      );

      const proceedsEur = isCash ? tradeMoney * fx : netCash * fx;
      const pnl = proceedsEur - costBasisEur;
      const year = parseInt(date.slice(0, 4), 10);

      result.push({
        Año: year,
        Ticker: isin,
        Tipo: assetClass,
        "F. Compra": fmtDate(oldestBuyDate),
        "F. Venta": fmtDate(date),
        "Precio Compra": r2(costBasisEur),
        "Precio Venta": r2(proceedsEur),
        "Resultado (EUR)": r2(pnl),
      });
    }
  }

  return result;
}
