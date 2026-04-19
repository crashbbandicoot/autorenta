const JSZip = require('./node_modules/jszip');
const Papa = require('./node_modules/papaparse');
const fs = require('fs');

function r2(n) { return Math.round(n * 100) / 100; }
function f(s) { return parseFloat(s ?? "0") || 0; }
function hasPartialFlag(notes) { return (notes ?? "").split(";").includes("P"); }

function collectRawOpRows(csvFiles) {
  const allRows = [];
  const opFiles = csvFiles.filter(f => f.type === "operaciones").sort((a,b)=>a.year-b.year);
  for (const file of opFiles) {
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
      const sumQty = rows.reduce((s,r) => s + f(r["Quantity"]), 0);
      const sumTM = rows.reduce((s,r) => s + f(r["TradeMoney"]), 0);
      const sumNC = rows.reduce((s,r) => s + f(r["NetCash"]), 0);
      const sumComm = rows.reduce((s,r) => s + f(r["IBCommission"]), 0);
      const sumCB = rows.reduce((s,r) => s + f(r["CostBasis"]), 0);
      const avgPrice = sumQty !== 0 ? Math.abs(sumTM) / Math.abs(sumQty) : 0;
      result.push({ ...last, DateTime: first["DateTime"] || last["DateTime"], Quantity: String(sumQty), TradeMoney: String(sumTM), NetCash: String(sumNC), IBCommission: String(sumComm), CostBasis: String(sumCB), TradePrice: String(avgPrice) });
    }
  }
  result.sort((a,b) => {
    const dtCmp = (a["DateTime"] ?? a["TradeDate"] ?? "").localeCompare(b["DateTime"] ?? b["TradeDate"] ?? "");
    if (dtCmp !== 0) return dtCmp;
    const aKey = a["ISIN"] || a["Symbol"] || "";
    const bKey = b["ISIN"] || b["Symbol"] || "";
    return aKey.localeCompare(bKey);
  });
  return result;
}

function parseCorporateActions(csvFiles) {
  const oldToNew = new Map();
  for (const file of csvFiles.filter(f => f.type === "operaciones")) {
    const parsed = Papa.parse(file.rawContent, { header: true, skipEmptyLines: true });
    const caRows = parsed.data.filter(r => r["Model"] !== "Model" && r["TradeMoney"] === "IC");
    if (caRows.length === 0) continue;
    const losers = caRows.filter(r => (r["TransactionType"] ?? "").startsWith("-"));
    const gainers = caRows.filter(r => !(r["TransactionType"] ?? "").startsWith("-") && r["TransactionType"] !== "");
    for (const loser of losers) {
      const fx = loser["FXRateToBase"] ?? "";
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
  const rawRows = collectRawOpRows(csvFiles);
  const aggregated = aggregatePartialFills(rawRows);

  const rawTrades = aggregated.map(r => {
    const origIsin = r["AssetClass"] === "CASH" ? (r["Symbol"] ?? "") : (r["ISIN"] || r["Symbol"] || "");
    return {
      date: r["TradeDate"] ?? "",
      isin: isinRemap.get(origIsin) ?? origIsin,
      description: r["AssetClass"] === "CASH" ? (r["Symbol"] ?? "") : (r["Description"] ?? ""),
      assetClass: r["AssetClass"] ?? "",
      buySell: r["Buy/Sell"] ?? "",
      qty: Math.abs(f(r["Quantity"])),
      tradeMoney: Math.abs(f(r["TradeMoney"])),
      netCash: Math.abs(f(r["NetCash"])),
      costBasis: Math.abs(f(r["CostBasis"])),
      fx: f(r["FXRateToBase"]),
    };
  });

  const lots = new Map();
  const acc = new Map();

  for (const trade of rawTrades) {
    const { isin, description, assetClass, buySell, qty, tradeMoney, netCash, costBasis, fx, date } = trade;
    const isCash = assetClass === "CASH";

    if (buySell === "BUY") {
      const lotList = lots.get(isin) ?? [];
      const costPerUnit = isCash
        ? (qty > 0 ? tradeMoney / qty : 0)
        : (qty > 0 ? costBasis / qty : 0);
      lotList.push({ qty, costPerUnit, fxAtBuy: fx, buyDate: date });
      lots.set(isin, lotList);
    } else {
      const lotList = lots.get(isin) ?? [];
      let remainingQty = qty;
      let costBasisEur = 0;
      for (let i = 0; i < lotList.length && remainingQty > 0; i++) {
        const lot = lotList[i];
        const matched = Math.min(remainingQty, lot.qty);
        costBasisEur += matched * lot.costPerUnit * lot.fxAtBuy;
        lot.qty -= matched;
        remainingQty -= matched;
      }
      lots.set(isin, lotList.filter(l => l.qty > 1e-10));
      if (isCash && remainingQty > 1e-10) costBasisEur += remainingQty;

      const proceedsEur = isCash ? tradeMoney * fx : netCash * fx;
      const pnl = proceedsEur - costBasisEur;
      const year = parseInt(date.slice(0, 4), 10);
      const key = `${year}|${isin}|${assetClass}`;

      if (!acc.has(key)) acc.set(key, { año: year, tipo: assetClass, isin, producto: description, ganancia: 0, perdida: 0 });
      const entry = acc.get(key);
      if (pnl >= 0) entry.ganancia = r2(entry.ganancia + pnl);
      else entry.perdida = r2(entry.perdida + pnl);
    }
  }

  return [...acc.values()];
}

// ── Expected data extracted from InformePyG.pdf ──────────────────────────────
const EXPECTED = [
  // 2022
  { año: 2022, tipo: "STK", isin: "US0758961009", ganancia: 0,      perdida: -23.83 },
  { año: 2022, tipo: "CASH", isin: "EUR.GBP",     ganancia: 0,      perdida: 0      },
  // 2023
  { año: 2023, tipo: "STK", isin: "GB00BL6NGV24", ganancia: 0.51,   perdida: 0      },
  { año: 2023, tipo: "STK", isin: "KYG144921056", ganancia: 0,      perdida: -33.34 },
  { año: 2023, tipo: "STK", isin: "MHY1146L1258", ganancia: 0,      perdida: -27.58 },
  { año: 2023, tipo: "STK", isin: "PLATAL000046", ganancia: 198.78, perdida: 0      },
  { año: 2023, tipo: "STK", isin: "PLMOBRK00013", ganancia: 0,      perdida: -15.31 },
  { año: 2023, tipo: "STK", isin: "US00507V1098", ganancia: 141.33, perdida: 0      },
  { año: 2023, tipo: "STK", isin: "US00770C1018", ganancia: 80.94,  perdida: 0      },
  { año: 2023, tipo: "STK", isin: "US1729674242", ganancia: 0,      perdida: -148.27},
  { año: 2023, tipo: "STK", isin: "US3448491049", ganancia: 68.14,  perdida: 0      },
  { año: 2023, tipo: "STK", isin: "US4581401001", ganancia: 0,      perdida: -46.53 },
  { año: 2023, tipo: "STK", isin: "US47632P1012", ganancia: 0,      perdida: -12.93 },
  { año: 2023, tipo: "STK", isin: "US48563L1017", ganancia: 0,      perdida: -10.38 },
  { año: 2023, tipo: "STK", isin: "US58463J3041", ganancia: 9.41,   perdida: 0      },
  { año: 2023, tipo: "STK", isin: "US69327R1014", ganancia: 63.28,  perdida: 0      },
  { año: 2023, tipo: "STK", isin: "US6952631033", ganancia: 0,      perdida: -66.02 },
  { año: 2023, tipo: "STK", isin: "US8170705011", ganancia: 166.56, perdida: 0      },
  { año: 2023, tipo: "STK", isin: "US9344231041", ganancia: 5.83,   perdida: 0      },
  { año: 2023, tipo: "CASH", isin: "EUR.USD",     ganancia: 0,      perdida: -0.01  },
  { año: 2023, tipo: "CASH", isin: "GBP.USD",     ganancia: 0,      perdida: -16.83 },
  { año: 2023, tipo: "CASH", isin: "USD.PLN",     ganancia: 0,      perdida: -10.83 },
  // 2024
  { año: 2024, tipo: "STK", isin: "CA28617B6061", ganancia: 0,      perdida: -39.32 },
  { año: 2024, tipo: "STK", isin: "CA47733C2076", ganancia: 6.28,   perdida: 0      },
  { año: 2024, tipo: "STK", isin: "CA53681K1003", ganancia: 0,      perdida: -20.07 },
  { año: 2024, tipo: "STK", isin: "CA88346B1031", ganancia: 0,      perdida: -50.26 },
  { año: 2024, tipo: "STK", isin: "DE000A3H2200", ganancia: 39.32,  perdida: -73.58 },
  { año: 2024, tipo: "STK", isin: "DK0015998017", ganancia: 88.70,  perdida: 0      },
  { año: 2024, tipo: "STK", isin: "GB0006449366", ganancia: 0,      perdida: -27.25 },
  { año: 2024, tipo: "STK", isin: "GB00BL6NGV24", ganancia: 0,      perdida: -146.28},
  { año: 2024, tipo: "STK", isin: "KYG1144A1058", ganancia: 0,      perdida: -25.89 },
  { año: 2024, tipo: "STK", isin: "KYG851581069", ganancia: 68.15,  perdida: 0      },
  { año: 2024, tipo: "STK", isin: "MHY2065G1219", ganancia: 28.27,  perdida: 0      },
  { año: 2024, tipo: "STK", isin: "PL4MASS00011", ganancia: 8.27,   perdida: 0      },
  { año: 2024, tipo: "STK", isin: "PLARTFX00011", ganancia: 0,      perdida: -438.48},
  { año: 2024, tipo: "STK", isin: "PLATAL000046", ganancia: 117.22, perdida: 0      },
  { año: 2024, tipo: "STK", isin: "US01609W1027", ganancia: 0,      perdida: -97.43 },
  { año: 2024, tipo: "STK", isin: "US1053682035", ganancia: 75.34,  perdida: 0      },
  { año: 2024, tipo: "STK", isin: "US1055321053", ganancia: 74.01,  perdida: 0      },
  { año: 2024, tipo: "STK", isin: "US1266501006", ganancia: 48.96,  perdida: 0      },
  { año: 2024, tipo: "STK", isin: "US2107511030", ganancia: 0,      perdida: -103.97},
  { año: 2024, tipo: "STK", isin: "US2199481068", ganancia: 101.50, perdida: 0      },
  { año: 2024, tipo: "STK", isin: "US43114Q1058", ganancia: 1.82,   perdida: 0      },
  { año: 2024, tipo: "STK", isin: "US52567D1072", ganancia: 0,      perdida: -75.36 },
  { año: 2024, tipo: "STK", isin: "US6388423021", ganancia: 0,      perdida: -21.56 },
  { año: 2024, tipo: "STK", isin: "US70450Y1038", ganancia: 208.64, perdida: -479.63},
  { año: 2024, tipo: "STK", isin: "US71654V1017", ganancia: 208.00, perdida: 0      },
  { año: 2024, tipo: "STK", isin: "US74144T1088", ganancia: 0,      perdida: -91.26 },
  { año: 2024, tipo: "STK", isin: "US75524W1080", ganancia: 3.05,   perdida: 0      },
  { año: 2024, tipo: "STK", isin: "US75574U1016", ganancia: 0,      perdida: -10.43 },
  { año: 2024, tipo: "STK", isin: "US82575P1075", ganancia: 0,      perdida: -26.57 },
  { año: 2024, tipo: "STK", isin: "US91324P1021", ganancia: 218.78, perdida: 0      },
  { año: 2024, tipo: "OPT", isin: "WBD 16JAN26 10 C", ganancia: 21.06, perdida: 0  },
  { año: 2024, tipo: "CASH", isin: "EUR.CAD",    ganancia: 0,       perdida: 0      },
  { año: 2024, tipo: "CASH", isin: "EUR.GBP",    ganancia: 0,       perdida: 0      },
  { año: 2024, tipo: "CASH", isin: "EUR.PLN",    ganancia: 0,       perdida: -0.03  },
  { año: 2024, tipo: "CASH", isin: "EUR.SEK",    ganancia: 0,       perdida: 0      },
  { año: 2024, tipo: "CASH", isin: "EUR.USD",    ganancia: 0,       perdida: -9.14  },
  { año: 2024, tipo: "CASH", isin: "GBP.USD",    ganancia: 2.84,    perdida: 0      },
  { año: 2024, tipo: "CASH", isin: "USD.SEK",    ganancia: 0,       perdida: -1.17  },
  // 2025
  { año: 2025, tipo: "STK", isin: "CA22717L1013", ganancia: 0,      perdida: -31.60 },
  { año: 2025, tipo: "STK", isin: "US23786R2013", ganancia: 50.25,  perdida: 0      },
  { año: 2025, tipo: "STK", isin: "US3723032062", ganancia: 14.58,  perdida: 0      },
  { año: 2025, tipo: "STK", isin: "US5533681012", ganancia: 0,      perdida: -77.69 },
  { año: 2025, tipo: "STK", isin: "US8740391003", ganancia: 595.07, perdida: 0      },
  { año: 2025, tipo: "CASH", isin: "EUR.CAD",    ganancia: 0,       perdida: 0      },
  { año: 2025, tipo: "CASH", isin: "EUR.USD",    ganancia: 0,       perdida: -2.31  },
  { año: 2025, tipo: "CASH", isin: "USD.CAD",    ganancia: 15.65,   perdida: 0      },
];

async function main() {
  const zipData = fs.readFileSync('./test_data/inputs/renta_2026.zip');
  const zip = await JSZip.loadAsync(zipData);
  const csvFiles = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    const m = name.match(/^(dividendos|operaciones)_(\d{4})\.csv$/i);
    if (m) {
      const content = await entry.async('string');
      csvFiles.push({ name, year: parseInt(m[2]), type: m[1].toLowerCase(), rawContent: content });
    }
  }

  const actual = calcularPyG(csvFiles);
  const actualByKey = new Map(actual.map(e => [`${e.año}|${e.isin}|${e.tipo}`, e]));

  console.log(`\nActual rows: ${actual.length} | Expected rows: ${EXPECTED.length}\n`);

  let matched = 0, mismatches = 0, missing = 0;

  for (const exp of EXPECTED) {
    const key = `${exp.año}|${exp.isin}|${exp.tipo}`;
    const act = actualByKey.get(key);
    if (!act) {
      console.log(`MISSING  [${exp.año}] ${exp.tipo} ${exp.isin}`);
      missing++;
      continue;
    }
    const dg = Math.abs(act.ganancia - exp.ganancia);
    const dp = Math.abs(act.perdida - exp.perdida);
    if (dg > 0.02 || dp > 0.02) {
      console.log(`MISMATCH [${exp.año}] ${exp.tipo} ${exp.isin}`);
      if (dg > 0.02) console.log(`         ganancia: actual=${act.ganancia.toFixed(2)} expected=${exp.ganancia.toFixed(2)} diff=${dg.toFixed(2)}`);
      if (dp > 0.02) console.log(`         perdida:  actual=${act.perdida.toFixed(2)}  expected=${exp.perdida.toFixed(2)}  diff=${dp.toFixed(2)}`);
      mismatches++;
    } else {
      matched++;
    }
    actualByKey.delete(key);
  }

  // Rows in actual but not in expected
  for (const [key, e] of actualByKey) {
    if (e.ganancia !== 0 || e.perdida !== 0) {
      console.log(`EXTRA    [${e.año}] ${e.tipo} ${e.isin} g=${e.ganancia} p=${e.perdida}`);
    }
  }

  console.log(`\nMatched: ${matched} | Mismatched: ${mismatches} | Missing: ${missing}`);
}

main().catch(console.error);
