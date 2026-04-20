const JSZip = require('./node_modules/jszip');
const Papa = require('./node_modules/papaparse');
const fs = require('fs');

// ── helpers ──────────────────────────────────────────────────────────────────
function f(s) { return parseFloat(s ?? "0") || 0; }
function r2(n) { return Math.round(n * 100) / 100; }
function r5(n) { return Math.round(n * 100000) / 100000; }
function hasPartialFlag(notes) { return (notes ?? "").split(";").includes("P"); }

function collectRawOpRows(csvFiles) {
  const allRows = [];
  for (const file of csvFiles.filter(f => f.type === "operaciones").sort((a, b) => a.year - b.year)) {
    const parsed = Papa.parse(file.rawContent, { header: true, skipEmptyLines: true });
    parsed.data.filter(r =>
      r["Model"] !== "Model" &&
      r["LevelOfDetail"] === "EXECUTION" &&
      r["TransactionType"] === "ExchTrade" &&
      (r["Buy/Sell"] === "BUY" || r["Buy/Sell"] === "SELL")
    ).forEach(r => allRows.push(r));
  }
  return allRows;
}

function aggregatePartialFills(rawRows) {
  const byOrderId = new Map();
  for (const r of rawRows) {
    const id = r["IBOrderID"] ?? "";
    const group = byOrderId.get(id) ?? [];
    group.push(r);
    byOrderId.set(id, group);
  }
  const result = [];
  for (const rows of byOrderId.values()) {
    const hasP = rows.some(r => hasPartialFlag(r["Notes/Codes"]));
    if (!hasP || rows.length === 1) {
      result.push(...rows);
    } else {
      const first = rows[0], last = rows[rows.length - 1];
      const sumQty   = rows.reduce((s, r) => s + f(r["Quantity"]), 0);
      const sumTM    = rows.reduce((s, r) => s + f(r["TradeMoney"]), 0);
      const sumNC    = rows.reduce((s, r) => s + f(r["NetCash"]), 0);
      const sumComm  = rows.reduce((s, r) => s + f(r["IBCommission"]), 0);
      const sumCB    = rows.reduce((s, r) => s + f(r["CostBasis"]), 0);
      const avgPrice = sumQty !== 0 ? Math.abs(sumTM) / Math.abs(sumQty) : 0;
      result.push({ ...last, DateTime: first["DateTime"] || last["DateTime"], Quantity: String(sumQty), TradeMoney: String(sumTM), NetCash: String(sumNC), IBCommission: String(sumComm), CostBasis: String(sumCB), TradePrice: String(avgPrice) });
    }
  }
  result.sort((a, b) => {
    const dtCmp = (a["DateTime"] ?? a["TradeDate"] ?? "").localeCompare(b["DateTime"] ?? b["TradeDate"] ?? "");
    if (dtCmp !== 0) return dtCmp;
    return (a["ISIN"] || a["Symbol"] || "").localeCompare(b["ISIN"] || b["Symbol"] || "");
  });
  return result;
}

function parseCorporateActions(csvFiles) {
  const oldToNew = new Map();
  for (const file of csvFiles.filter(f => f.type === "operaciones")) {
    const parsed = Papa.parse(file.rawContent, { header: true, skipEmptyLines: true });
    const caRows = parsed.data.filter(r => r["Model"] !== "Model" && r["TradeMoney"] === "IC");
    if (caRows.length === 0) continue;
    const losers  = caRows.filter(r => (r["TransactionType"] ?? "").startsWith("-"));
    const gainers = caRows.filter(r => !(r["TransactionType"] ?? "").startsWith("-") && r["TransactionType"] !== "");
    for (const loser of losers) {
      const fx     = loser["FXRateToBase"] ?? "";
      const gainer = gainers.find(r => r["FXRateToBase"] === fx);
      if (!gainer) continue;
      const oldIsin = loser["ISIN"] || loser["Symbol"] || "";
      const newIsin = gainer["ISIN"] || gainer["Symbol"] || "";
      if (oldIsin && newIsin && oldIsin !== newIsin) oldToNew.set(oldIsin, newIsin);
    }
  }
  return oldToNew;
}

function calcularPyG(csvFiles) {
  const isinRemap = parseCorporateActions(csvFiles);
  const rawRows   = aggregatePartialFills(collectRawOpRows(csvFiles));

  const trades = rawRows
    .filter(r => r["AssetClass"] !== "CASH")
    .map(r => {
      const isin = isinRemap.get(r["ISIN"] || r["Symbol"] || "") ?? (r["ISIN"] || r["Symbol"] || "");
      return {
        date:        r["TradeDate"] ?? "",
        isin,
        description: r["Description"] ?? "",
        assetClass:  r["AssetClass"] ?? "",
        buySell:     r["Buy/Sell"] ?? "",
        qty:         Math.abs(f(r["Quantity"])),
        tradeMoney:  Math.abs(f(r["TradeMoney"])),
        netCash:     Math.abs(f(r["NetCash"])),
        costBasis:   Math.abs(f(r["CostBasis"])),
        fx:          f(r["FXRateToBase"]),
      };
    });

  const lots = new Map();
  const acc  = new Map();

  for (const trade of trades) {
    const { isin, description, assetClass, buySell, qty, netCash, costBasis, fx, date } = trade;

    if (buySell === "BUY") {
      const lotList      = lots.get(isin) ?? [];
      const costPerUnit  = qty > 0 ? costBasis / qty : 0;
      lotList.push({ qty, costPerUnit, fxAtBuy: fx, buyDate: date });
      lots.set(isin, lotList);
    } else {
      const lotList = lots.get(isin) ?? [];
      let remainingQty = qty;
      let costBasisEur = 0;
      for (let i = 0; i < lotList.length && remainingQty > 0; i++) {
        const lot     = lotList[i];
        const matched = Math.min(remainingQty, lot.qty);
        costBasisEur += matched * lot.costPerUnit * lot.fxAtBuy;
        lot.qty      -= matched;
        remainingQty -= matched;
      }
      lots.set(isin, lotList.filter(l => l.qty > 1e-10));

      const proceedsEur = netCash * fx;
      const pnl         = proceedsEur - costBasisEur;
      const year        = parseInt(date.slice(0, 4), 10);
      const key         = `${year}|${isin}|${assetClass}`;

      if (!acc.has(key)) acc.set(key, { año: year, tipo: assetClass, isin, producto: description, ganancia: 0, perdida: 0 });
      const entry = acc.get(key);
      if (pnl >= 0) entry.ganancia = r2(entry.ganancia + pnl);
      else          entry.perdida  = r2(entry.perdida  + pnl);
    }
  }

  return [...acc.values()];
}

// ── Expected STK values from PDF ─────────────────────────────────────────────
const EXPECTED = [
  // 2022
  { año: 2022, isin: "US0758961009", ganancia:   0.00, perdida:  -23.83 },
  // 2023
  { año: 2023, isin: "GB00BL6NGV24", ganancia:   0.51, perdida:    0.00 },
  { año: 2023, isin: "KYG144921056", ganancia:   0.00, perdida:  -33.34 },
  { año: 2023, isin: "MHY1146L1258", ganancia:   0.00, perdida:  -27.58 },
  { año: 2023, isin: "PLATAL000046", ganancia: 198.78, perdida:    0.00 },
  { año: 2023, isin: "PLMOBRK00013", ganancia:   0.00, perdida:  -15.31 },
  { año: 2023, isin: "US00507V1098", ganancia: 141.33, perdida:    0.00 },
  { año: 2023, isin: "US00770C1018", ganancia:  80.94, perdida:    0.00 },
  { año: 2023, isin: "US1729674242", ganancia:   0.00, perdida: -148.27 },
  { año: 2023, isin: "US3448491049", ganancia:  68.14, perdida:    0.00 },
  { año: 2023, isin: "US4581401001", ganancia:   0.00, perdida:  -46.53 },
  { año: 2023, isin: "US47632P1012", ganancia:   0.00, perdida:  -12.93 },
  { año: 2023, isin: "US48563L1017", ganancia:   0.00, perdida:  -10.38 },
  { año: 2023, isin: "US58463J3041", ganancia:   9.41, perdida:    0.00 },
  { año: 2023, isin: "US69327R1014", ganancia:  63.28, perdida:    0.00 },
  { año: 2023, isin: "US6952631033", ganancia:   0.00, perdida:  -66.02 },
  { año: 2023, isin: "US8170705011", ganancia: 166.56, perdida:    0.00 },
  { año: 2023, isin: "US9344231041", ganancia:   5.83, perdida:    0.00 },
  // 2024
  { año: 2024, isin: "CA28617B6061", ganancia:   0.00, perdida:  -39.32 },
  { año: 2024, isin: "CA47733C2076", ganancia:   6.28, perdida:    0.00 },
  { año: 2024, isin: "CA53681K1003", ganancia:   0.00, perdida:  -20.07 },
  { año: 2024, isin: "CA88346B1031", ganancia:   0.00, perdida:  -50.26 },
  { año: 2024, isin: "DE000A3H2200", ganancia:  39.32, perdida:  -73.58 },
  { año: 2024, isin: "DK0015998017", ganancia:  88.70, perdida:    0.00 },
  { año: 2024, isin: "GB0006449366", ganancia:   0.00, perdida:  -27.25 },
  { año: 2024, isin: "GB00BL6NGV24", ganancia:   0.00, perdida: -146.28 },
  { año: 2024, isin: "KYG1144A1058", ganancia:   0.00, perdida:  -25.89 },
  { año: 2024, isin: "KYG851581069", ganancia:  68.15, perdida:    0.00 },
  { año: 2024, isin: "MHY2065G1219", ganancia:  28.27, perdida:    0.00 },
  { año: 2024, isin: "PL4MASS00011", ganancia:   8.27, perdida:    0.00 },
  { año: 2024, isin: "PLARTFX00011", ganancia:   0.00, perdida: -438.48 },
  { año: 2024, isin: "PLATAL000046", ganancia: 117.22, perdida:    0.00 },
  { año: 2024, isin: "US01609W1027", ganancia:   0.00, perdida:  -97.43 },
  { año: 2024, isin: "US1053682035", ganancia:  75.34, perdida:    0.00 },
  { año: 2024, isin: "US1055321053", ganancia:  74.01, perdida:    0.00 },
  { año: 2024, isin: "US1266501006", ganancia:  48.96, perdida:    0.00 },
  { año: 2024, isin: "US2107511030", ganancia:   0.00, perdida: -103.97 },
  { año: 2024, isin: "US2199481068", ganancia: 101.50, perdida:    0.00 },
  { año: 2024, isin: "US43114Q1058", ganancia:   1.82, perdida:    0.00 },
  { año: 2024, isin: "US52567D1072", ganancia:   0.00, perdida:  -75.36 },
  { año: 2024, isin: "US6388423021", ganancia:   0.00, perdida:  -21.56 },
  { año: 2024, isin: "US70450Y1038", ganancia: 208.64, perdida: -479.63 },
  { año: 2024, isin: "US71654V1017", ganancia: 208.00, perdida:    0.00 },
  { año: 2024, isin: "US74144T1088", ganancia:   0.00, perdida:  -91.26 },
  { año: 2024, isin: "US75524W1080", ganancia:   3.05, perdida:    0.00 },
  { año: 2024, isin: "US75574U1016", ganancia:   0.00, perdida:  -10.43 },
  { año: 2024, isin: "US82575P1075", ganancia:   0.00, perdida:  -26.57 },
  { año: 2024, isin: "US91324P1021", ganancia: 218.78, perdida:    0.00 },
];

// ── Run ───────────────────────────────────────────────────────────────────────
async function main() {
  const zipData  = fs.readFileSync('./test_data/inputs/renta_2025.zip');
  const zip      = await JSZip.loadAsync(zipData);
  const csvFiles = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    const m = name.match(/^(dividendos|operaciones)_(\d{4})\.csv$/i);
    if (m) {
      const content = await entry.async('string');
      csvFiles.push({ name, year: parseInt(m[2]), type: m[1].toLowerCase(), rawContent: content });
    }
  }

  const results = calcularPyG(csvFiles);
  const stkResults = results.filter(r => r.tipo === "STK");

  // Index computed results by año+isin
  const computed = new Map();
  for (const r of stkResults) computed.set(`${r.año}|${r.isin}`, r);

  // Index expected by año+isin
  const expected = new Map();
  for (const e of EXPECTED) expected.set(`${e.año}|${e.isin}`, e);

  let pass = 0, fail = 0;
  const failures = [];

  // Check every expected entry
  for (const [key, exp] of expected) {
    const got = computed.get(key);
    if (!got) {
      fail++;
      failures.push(`MISSING  ${key}  expected G=${exp.ganancia} P=${exp.perdida}`);
      continue;
    }
    const gOk = Math.abs(got.ganancia - exp.ganancia) < 0.015;
    const pOk = Math.abs(got.perdida  - exp.perdida)  < 0.015;
    if (gOk && pOk) {
      pass++;
    } else {
      fail++;
      failures.push(`MISMATCH ${key}  expected G=${exp.ganancia} P=${exp.perdida}  got G=${got.ganancia} P=${got.perdida}`);
    }
  }

  // Check for unexpected STK entries not in PDF
  const extras = [];
  for (const [key, got] of computed) {
    if (!expected.has(key)) extras.push(`EXTRA    ${key}  G=${got.ganancia} P=${got.perdida}  (${got.producto})`);
  }

  // Print
  console.log(`\n=== PyG STK Validation ===`);
  console.log(`PASS: ${pass}  FAIL: ${fail}  EXTRA: ${extras.length}\n`);

  if (failures.length) {
    console.log("── Failures ─────────────────────────────────────────────────────");
    failures.forEach(l => console.log(l));
  }
  if (extras.length) {
    console.log("\n── Unexpected rows (in output but not in PDF) ───────────────────");
    extras.forEach(l => console.log(l));
  }

  if (!failures.length && !extras.length) console.log("All STK rows match the PDF exactly.");

  // Subtotal check
  console.log("\n── Subtotals by year ────────────────────────────────────────────");
  const pdfSubtotals = { 2022: [0, -23.83], 2023: [734.78, -360.36], 2024: [1296.31, -1727.34] };
  for (const [yr, [eg, ep]] of Object.entries(pdfSubtotals)) {
    const rows = stkResults.filter(r => r.año === parseInt(yr));
    const tg   = r2(rows.reduce((s, r) => s + r.ganancia, 0));
    const tp   = r2(rows.reduce((s, r) => s + r.perdida,  0));
    const gOk  = Math.abs(tg - eg) < 0.015;
    const pOk  = Math.abs(tp - ep) < 0.015;
    console.log(`  ${yr}  G=${tg} (exp ${eg}) ${gOk ? '✓' : '✗'}   P=${tp} (exp ${ep}) ${pOk ? '✓' : '✗'}`);
  }
}

main().catch(console.error);
