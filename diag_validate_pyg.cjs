// Validation script: runs full calcularPyG logic against renta_2026.zip
// and compares subtotals with Autodeclaro PDF reference values (pages 1-6).
// Run with: node diag_validate_pyg.cjs

const JSZip = require('./node_modules/jszip');
const Papa = require('./node_modules/papaparse');
const fs = require('fs');

// ─── Reference values from Autodeclaro PDF ───────────────────────────────────
const PDF_REF = {
  '2022|STK':  { ganancia:    0.00, perdida:   -23.83 },
  '2022|CASH': { ganancia:    0.00, perdida:     0.00 },
  '2023|STK':  { ganancia:  734.78, perdida:  -360.36 },
  '2023|CASH': { ganancia:    0.00, perdida:   -27.67 },
  '2024|STK':  { ganancia: 1296.31, perdida: -1727.34 },
  '2024|CASH': { ganancia:    2.84, perdida:   -10.34 },
  '2025|STK':  { ganancia:  659.90, perdida:  -109.29 },
  '2025|CASH': { ganancia:   15.65, perdida:    -2.31 },
};

// ─── Helpers (mirror of csv-parser.ts) ───────────────────────────────────────
function r2(n) { return Math.round(n * 100) / 100; }
function r5(n) { return Math.round(n * 100000) / 100000; }
function f(s)  { return parseFloat(s ?? '0') || 0; }
function hasPartialFlag(notes) { return (notes ?? '').split(';').includes('P'); }

function collectRawOpRows(csvFiles) {
  const allRows = [];
  for (const file of csvFiles.filter(f => f.type === 'operaciones').sort((a, b) => a.year - b.year)) {
    const parsed = Papa.parse(file.rawContent, { header: true, skipEmptyLines: true });
    parsed.data
      .filter(r =>
        r['Model'] !== 'Model' &&
        r['LevelOfDetail'] === 'EXECUTION' &&
        r['TransactionType'] === 'ExchTrade' &&
        (r['Buy/Sell'] === 'BUY' || r['Buy/Sell'] === 'SELL')
      )
      .forEach(r => allRows.push(r));
  }
  return allRows;
}

function aggregatePartialFills(rawRows) {
  const byOrderId = new Map();
  for (const r of rawRows) {
    const id = r['IBOrderID'] ?? '';
    const group = byOrderId.get(id) ?? [];
    group.push(r);
    byOrderId.set(id, group);
  }
  const result = [];
  for (const rows of byOrderId.values()) {
    const hasP = rows.some(r => hasPartialFlag(r['Notes/Codes']));
    if (!hasP || rows.length === 1) {
      result.push(...rows);
    } else {
      const first = rows[0], last = rows[rows.length - 1];
      const sumQty  = rows.reduce((s, r) => s + f(r['Quantity']), 0);
      const sumTM   = rows.reduce((s, r) => s + f(r['TradeMoney']), 0);
      const sumNC   = rows.reduce((s, r) => s + f(r['NetCash']), 0);
      const sumComm = rows.reduce((s, r) => s + f(r['IBCommission']), 0);
      const sumCB   = rows.reduce((s, r) => s + f(r['CostBasis']), 0);
      const avgPrice = sumQty !== 0 ? Math.abs(sumTM) / Math.abs(sumQty) : 0;
      result.push({
        ...last,
        DateTime: first['DateTime'] || last['DateTime'],
        Quantity: String(sumQty),
        TradeMoney: String(sumTM),
        NetCash: String(sumNC),
        IBCommission: String(sumComm),
        CostBasis: String(sumCB),
        TradePrice: String(avgPrice),
      });
    }
  }
  result.sort((a, b) => {
    const dtCmp = (a['DateTime'] ?? a['TradeDate'] ?? '').localeCompare(b['DateTime'] ?? b['TradeDate'] ?? '');
    if (dtCmp !== 0) return dtCmp;
    return (a['ISIN'] || a['Symbol'] || '').localeCompare(b['ISIN'] || b['Symbol'] || '');
  });
  return result;
}

function parseCorporateActions(csvFiles) {
  const oldToNew = new Map();
  for (const file of csvFiles.filter(f => f.type === 'operaciones')) {
    const parsed = Papa.parse(file.rawContent, { header: true, skipEmptyLines: true });
    const caRows = parsed.data.filter(r => r['Model'] !== 'Model' && r['TradeMoney'] === 'IC');
    if (caRows.length === 0) continue;
    const losers  = caRows.filter(r => (r['TransactionType'] ?? '').startsWith('-'));
    const gainers = caRows.filter(r => !(r['TransactionType'] ?? '').startsWith('-') && r['TransactionType'] !== '');
    for (const loser of losers) {
      const fx = loser['FXRateToBase'] ?? '';
      const gainer = gainers.find(r => r['FXRateToBase'] === fx);
      if (!gainer) continue;
      const oldIsin = loser['ISIN'] || loser['Symbol'] || '';
      const newIsin = gainer['ISIN'] || gainer['Symbol'] || '';
      if (oldIsin && newIsin && oldIsin !== newIsin) {
        oldToNew.set(oldIsin, newIsin);
        console.log(`  [CA] Corporate action rename: ${oldIsin} → ${newIsin}`);
      }
    }
  }
  return oldToNew;
}

function parseRawTrades(csvFiles) {
  const rawRows = collectRawOpRows(csvFiles);
  const aggregated = aggregatePartialFills(rawRows);
  return aggregated.map(r => ({
    date:        r['TradeDate'] ?? '',
    isin:        r['AssetClass'] === 'CASH' ? (r['Symbol'] ?? '') : (r['ISIN'] || r['Symbol'] || ''),
    description: r['AssetClass'] === 'CASH' ? (r['Symbol'] ?? '') : (r['Description'] ?? ''),
    assetClass:  r['AssetClass'] ?? '',
    buySell:     r['Buy/Sell'] ?? '',
    qty:         Math.abs(f(r['Quantity'])),
    tradeMoney:  Math.abs(f(r['TradeMoney'])),
    netCash:     Math.abs(f(r['NetCash'])),
    costBasis:   Math.abs(f(r['CostBasis'])),
    fx:          f(r['FXRateToBase']),
  }));
}

function calcularPyG(csvFiles) {
  const isinRemap = parseCorporateActions(csvFiles);
  const rawTrades = parseRawTrades(csvFiles).map(t => ({
    ...t,
    isin: isinRemap.get(t.isin) ?? t.isin,
  }));
  const lots = new Map();
  const acc  = new Map(); // key: "year|isin|assetClass"

  for (const trade of rawTrades) {
    const { isin, description, assetClass, buySell, qty, tradeMoney, netCash, costBasis, fx, date } = trade;

    if (assetClass === 'CASH') {
      const [baseCcy = '', quoteCcy = ''] = isin.split('.');
      const isReceiveBase = buySell === 'BUY';
      const receivedCcy = isReceiveBase ? baseCcy : quoteCcy;
      const receivedQty = isReceiveBase ? qty : tradeMoney;
      const givenCcy    = isReceiveBase ? quoteCcy : baseCcy;
      const givenQty    = isReceiveBase ? tradeMoney : qty;
      const tradeEur    = tradeMoney * fx;

      if (receivedCcy !== 'EUR' && receivedQty > 1e-10) {
        const lotList = lots.get(receivedCcy) ?? [];
        lotList.push({ qty: receivedQty, costPerUnit: tradeEur / receivedQty, fxAtBuy: 1, buyDate: date });
        lots.set(receivedCcy, lotList);
      }

      if (givenCcy !== 'EUR' && givenQty > 1e-10) {
        const lotList = lots.get(givenCcy) ?? [];
        let remainingQty = givenQty;
        let costBasisEur = 0;
        for (let i = 0; i < lotList.length && remainingQty > 0; i++) {
          const lot = lotList[i];
          const matched = Math.min(remainingQty, lot.qty);
          costBasisEur += matched * lot.costPerUnit;
          lot.qty -= matched;
          remainingQty -= matched;
        }
        lots.set(givenCcy, lotList.filter(l => l.qty > 1e-10));
        const matchedQty = givenQty - remainingQty;
        if (matchedQty > 1e-10) {
          const proceedsEur = tradeEur * (matchedQty / givenQty);
          const pnl = proceedsEur - costBasisEur;
          const year = parseInt(date.slice(0, 4), 10);
          const key = `${year}|${isin}|CASH`;
          if (!acc.has(key)) acc.set(key, { año: year, tipo: 'CASH', isin, producto: isin, ganancia: 0, perdida: 0 });
          const entry = acc.get(key);
          if (pnl >= 0) entry.ganancia = r2(entry.ganancia + pnl);
          else entry.perdida = r2(entry.perdida + pnl);
        }
      }
      continue;
    }

    if (buySell === 'BUY') {
      const lotList = lots.get(isin) ?? [];
      const costPerUnit = qty > 0 ? costBasis / qty : 0;
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

      const proceedsEur = netCash * fx;
      const pnl  = proceedsEur - costBasisEur;
      const year = parseInt(date.slice(0, 4), 10);
      const key  = `${year}|${isin}|${assetClass}`;

      if (!acc.has(key)) {
        acc.set(key, { año: year, tipo: assetClass, isin, producto: description, ganancia: 0, perdida: 0 });
      }
      const entry = acc.get(key);
      if (pnl >= 0) {
        entry.ganancia = r2(entry.ganancia + pnl);
      } else {
        entry.perdida = r2(entry.perdida + pnl);
      }
    }
  }
  return [...acc.values()];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const zipData = fs.readFileSync('./test_data/inputs/renta_2026.zip');
  const zip = await JSZip.loadAsync(zipData);
  const csvFiles = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    const m = name.match(/^(?:.*\/)?((dividendos|operaciones)_(\d{4})\.csv)$/i);
    if (m) {
      const content = await entry.async('string');
      csvFiles.push({ name: m[1], year: parseInt(m[3]), type: m[2].toLowerCase(), rawContent: content });
    }
  }
  console.log(`Loaded ${csvFiles.length} CSV files from ZIP\n`);

  const rows = calcularPyG(csvFiles);

  // ─── Aggregate subtotals by year+tipo ───────────────────────────────────────
  const subtotals = new Map();
  for (const row of rows) {
    const key = `${row.año}|${row.tipo}`;
    const st = subtotals.get(key) ?? { ganancia: 0, perdida: 0, rows: [] };
    st.ganancia = r2(st.ganancia + row.ganancia);
    st.perdida  = r2(st.perdida  + row.perdida);
    st.rows.push(row);
    subtotals.set(key, st);
  }

  // ─── Summary table ───────────────────────────────────────────────────────────
  const YEARS = [2022, 2023, 2024, 2025];
  const TYPES = ['STK', 'CASH'];

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log('  VALIDATION SUMMARY — STK and CASH subtotals vs Autodeclaro PDF reference');
  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(pad('Key', 12) + pad('Ganancia OUR', 14) + pad('Ganancia PDF', 14) + pad('ΔGanancia', 11) + pad('Pérdida OUR', 13) + pad('Pérdida PDF', 13) + pad('ΔPérdida', 10) + 'Status');
  console.log('─'.repeat(97));

  let allOk = true;
  for (const year of YEARS) {
    for (const tipo of TYPES) {
      const key = `${year}|${tipo}`;
      const ref = PDF_REF[key];
      const our = subtotals.get(key) ?? { ganancia: 0, perdida: 0 };
      const dG = r2(our.ganancia - ref.ganancia);
      const dP = r2(our.perdida  - ref.perdida);
      const ok = Math.abs(dG) <= 0.02 && Math.abs(dP) <= 0.02;
      if (!ok) allOk = false;
      const status = ok ? '[OK]' : '[DIFF] <<<';
      console.log(
        pad(key, 12) +
        pad(fmt(our.ganancia), 14) + pad(fmt(ref.ganancia), 14) + pad(fmt(dG), 11) +
        pad(fmt(our.perdida),  13) + pad(fmt(ref.perdida),  13) + pad(fmt(dP), 10) +
        status
      );
    }
    console.log('─'.repeat(97));
  }

  if (allOk) {
    console.log('\n✓  All subtotals match the PDF reference (within ±0.02 €)\n');
  } else {
    console.log('\n✗  DISCREPANCIES FOUND — see [DIFF] rows above\n');
  }

  // ─── Detail per tipo+year ────────────────────────────────────────────────────
  for (const tipo of TYPES) {
    console.log(`\n${'═'.repeat(97)}`);
    console.log(`  DETAIL — ${tipo}`);
    console.log('═'.repeat(97));
    for (const year of YEARS) {
      const key = `${year}|${tipo}`;
      const st = subtotals.get(key);
      if (!st) { console.log(`  ${year}: (no trades)\n`); continue; }
      console.log(`\n  ${year}:`);
      console.log('  ' + pad('ISIN', 14) + pad('Producto', 42) + pad('Ganancia', 12) + 'Pérdida');
      console.log('  ' + '─'.repeat(84));
      for (const r of st.rows) {
        console.log('  ' + pad(r.isin, 14) + pad(r.producto.slice(0, 40), 42) + pad(fmt(r.ganancia), 12) + fmt(r.perdida));
      }
      const ref = PDF_REF[key];
      const dG = r2(st.ganancia - ref.ganancia);
      const dP = r2(st.perdida  - ref.perdida);
      const ok = Math.abs(dG) <= 0.02 && Math.abs(dP) <= 0.02;
      console.log('  ' + '─'.repeat(84));
      console.log('  ' + pad('SUBTOTAL', 56) + pad(fmt(st.ganancia), 12) + fmt(st.perdida));
      console.log('  ' + pad('PDF REF',  56) + pad(fmt(ref.ganancia),12) + fmt(ref.perdida));
      console.log('  ' + pad('DELTA',    56) + pad(fmt(dG), 12) + fmt(dP) + (ok ? '  [OK]' : '  [DIFF] <<<'));
    }
  }
}

function pad(s, n) { return String(s).padEnd(n); }
function fmt(n) { return (n >= 0 ? ' ' : '') + n.toFixed(2); }

main().catch(console.error);
