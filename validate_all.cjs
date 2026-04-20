const JSZip = require('./node_modules/jszip');
const Papa = require('./node_modules/papaparse');
const XLSX = require('./node_modules/xlsx');
const fs = require('fs');

function fmtDate(s) { return s ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : ''; }
function r2(n) { return Math.round(n * 100) / 100; }
function r5(n) { return Math.round(n * 100000) / 100000; }
function f(s) { return parseFloat(s ?? '0') || 0; }
function hasPartialFlag(notes) { return (notes ?? '').split(';').includes('P'); }

function collectRawOpRows(csvFiles) {
  const allRows = [];
  csvFiles.filter(f => f.type === 'operaciones').sort((a,b)=>a.year-b.year).forEach(file => {
    Papa.parse(file.rawContent, { header: true, skipEmptyLines: true }).data
      .filter(r => r['Model']!=='Model' && r['LevelOfDetail']==='EXECUTION' && r['TransactionType']==='ExchTrade' && (r['Buy/Sell']==='BUY'||r['Buy/Sell']==='SELL'))
      .forEach(r => allRows.push(r));
  });
  return allRows;
}

function aggregatePartialFills(rawRows) {
  const byOrderId = new Map();
  rawRows.forEach(r => { const id = r['IBOrderID']||''; const g = byOrderId.get(id)||[]; g.push(r); byOrderId.set(id,g); });
  const result = [];
  for (const rows of byOrderId.values()) {
    const hasP = rows.some(r => hasPartialFlag(r['Notes/Codes']));
    if (!hasP || rows.length===1) { result.push(...rows); continue; }
    const first=rows[0], last=rows[rows.length-1];
    const sumQty=rows.reduce((s,r)=>s+f(r['Quantity']),0), sumTM=rows.reduce((s,r)=>s+f(r['TradeMoney']),0);
    const sumNC=rows.reduce((s,r)=>s+f(r['NetCash']),0), sumComm=rows.reduce((s,r)=>s+f(r['IBCommission']),0), sumCB=rows.reduce((s,r)=>s+f(r['CostBasis']),0);
    result.push({...last, DateTime:first['DateTime']||last['DateTime'], Quantity:String(sumQty), TradeMoney:String(sumTM), NetCash:String(sumNC), IBCommission:String(sumComm), CostBasis:String(sumCB), TradePrice:String(sumQty ? Math.abs(sumTM)/Math.abs(sumQty) : 0)});
  }
  result.sort((a,b) => {
    const d = (a['DateTime']||a['TradeDate']||'').localeCompare(b['DateTime']||b['TradeDate']||'');
    return d || ((a['ISIN']||a['Symbol']||'').localeCompare(b['ISIN']||b['Symbol']||''));
  });
  return result;
}

async function main() {
  const zip = await JSZip.loadAsync(fs.readFileSync('./test_data/inputs/renta_2025.zip'));
  const csvFiles = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    const m = name.match(/^(dividendos|operaciones)_(\d{4})\.csv$/i);
    if (m) csvFiles.push({ name, year: parseInt(m[2]), type: m[1].toLowerCase(), rawContent: await entry.async('string') });
  }
  console.log(`Loaded ${csvFiles.length} CSV files (${csvFiles.filter(f=>f.type==='dividendos').length} dividendos, ${csvFiles.filter(f=>f.type==='operaciones').length} operaciones)\n`);

  // ── DIVIDENDOS ──
  const divRows = [];
  csvFiles.filter(f=>f.type==='dividendos').sort((a,b)=>a.year-b.year).forEach(file => {
    Papa.parse(file.rawContent, { header: false, skipEmptyLines: true }).data.forEach(row => {
      if (row[0]!=='DividendDetail'||row[1]!=='Data'||row[2]!=='RevenueComponent') return;
      const rc=row[10]||'', gross=f(row[13]), whold=f(row[16]), vb=r2(gross), vn=r2(gross+whold);
      divRows.push({ Broker:'IBKR', Fecha:fmtDate(row[7]), Pais:rc.includes('Return of Capital')?'Return of Capital':(row[6]||''), ISIN:row[5]||'', Producto:`${row[4]}-${rc}`, 'Valor Bruto (€)':vb, 'Valor Neto(€)':vn, 'Retencion origen(€)':r2(Math.abs(whold)), 'Retencion destino(€)':0 });
    });
  });
  const expDiv = XLSX.utils.sheet_to_json(XLSX.readFile('./test_data/outputs/Historico_Dividendos.xlsx').Sheets['Sheet1']);
  let divOk=0, divFail=0;
  for (let i=0; i<Math.min(divRows.length, expDiv.length); i++) {
    const ok = ['Valor Bruto (€)','Valor Neto(€)','Retencion origen(€)'].every(c => Math.abs(parseFloat(divRows[i][c]) - parseFloat(expDiv[i][c])) <= 0.011);
    ok ? divOk++ : divFail++;
  }
  console.log(`DIVIDENDOS : ${divRows.length}/${expDiv.length} rows | OK: ${divOk} | FAIL: ${divFail}`);

  // ── OPERACIONES ──
  const ops = aggregatePartialFills(collectRawOpRows(csvFiles)).map(r => {
    const isCash=r['AssetClass']==='CASH', fx=f(r['FXRateToBase']), qty=Math.abs(f(r['Quantity'])), tm=Math.abs(f(r['TradeMoney'])), comm=f(r['IBCommission']), bs=r['Buy/Sell'];
    const cv=isCash?(bs==='SELL'?'C':'V'):(bs==='BUY'?'C':'V'), isBuy=cv==='C', commEur=isCash?comm:comm*fx, ptm=tm*fx;
    return { ISIN:isCash?(r['Symbol']||''):(r['ISIN']||''), Fecha:fmtDate(r['TradeDate']), 'Precio transaccion en moneda accion':r5(ptm), 'Precio transaccion':r5(tm), 'Comision(€)-Incluye AutoFX (DeGiro)':commEur, 'Valor Total Transaccion en (€)':isBuy?r5(ptm-commEur):r5(ptm+commEur) };
  });
  const expOps = XLSX.utils.sheet_to_json(XLSX.readFile('./test_data/outputs/Historico_Transacciones.xlsx').Sheets['Sheet1']);
  let opsOk=0, opsFail=0;
  for (let i=0; i<Math.min(ops.length, expOps.length); i++) {
    const ok = ['Precio transaccion en moneda accion','Precio transaccion','Comision(€)-Incluye AutoFX (DeGiro)','Valor Total Transaccion en (€)'].every(c => Math.abs(parseFloat(ops[i][c]) - parseFloat(expOps[i][c])) <= 0.001);
    ok ? opsOk++ : opsFail++;
  }
  console.log(`OPERACIONES: ${ops.length}/${expOps.length} rows | OK: ${opsOk} | FAIL: ${opsFail}`);

  // ── PyG ──
  const rawTrades = aggregatePartialFills(collectRawOpRows(csvFiles)).map(r => ({
    date:r['TradeDate']||'', isin:r['AssetClass']==='CASH'?(r['Symbol']||''):(r['ISIN']||''),
    assetClass:r['AssetClass']||'', buySell:r['Buy/Sell']||'',
    qty:Math.abs(f(r['Quantity'])), tradeMoney:Math.abs(f(r['TradeMoney'])),
    netCash:Math.abs(f(r['NetCash'])), costBasis:Math.abs(f(r['CostBasis'])), fx:f(r['FXRateToBase'])
  }));
  const lots = new Map(), pyg = [];
  for (const { date,isin,assetClass,buySell,qty,tradeMoney,netCash,costBasis,fx } of rawTrades) {
    const isCash = assetClass==='CASH';
    if (buySell==='BUY') {
      const l=lots.get(isin)||[]; l.push({qty, costPerUnit:isCash?(qty?tradeMoney/qty:0):(qty?costBasis/qty:0), fxAtBuy:fx, buyDate:date}); lots.set(isin,l);
    } else {
      const l=lots.get(isin)||[]; let rem=qty, cost=0, bd=date;
      for (let i=0; i<l.length&&rem>0; i++) { const m=Math.min(rem,l[i].qty); cost+=m*l[i].costPerUnit*l[i].fxAtBuy; if(i===0)bd=l[i].buyDate; l[i].qty-=m; rem-=m; }
      lots.set(isin, l.filter(x=>x.qty>1e-10));
      if (isCash && rem>1e-10) cost+=rem;
      const proc=isCash?tradeMoney*fx:netCash*fx;
      pyg.push({ Ano:parseInt(date.slice(0,4)), Ticker:isin, Tipo:assetClass, FCompra:fmtDate(bd), FVenta:fmtDate(date), Compra:r2(cost), Venta:r2(proc), PnL:r2(proc-cost) });
    }
  }
  const byYear = {};
  pyg.forEach(r => { byYear[r.Ano] = byYear[r.Ano]||{rows:0,total:0}; byYear[r.Ano].rows++; byYear[r.Ano].total+=r.PnL; });
  console.log(`PYG       : ${pyg.length} rows total`);
  Object.entries(byYear).sort().forEach(([y,d]) => console.log(`  ${y}: ${d.rows} rows | P&L = ${r2(d.total)} EUR`));

  const atal = pyg.filter(r=>r.Ticker==='PLATAL000046');
  const cashRows = pyg.filter(r=>r.Tipo==='CASH');
  const maxCash = Math.max(...cashRows.map(r=>Math.abs(r.PnL)));

  console.log(`\nChecks clave:`);
  console.log(`  ATAL 2023: ${atal.find(r=>r.Ano===2023)?.PnL} EUR (expected ~198.78)`);
  console.log(`  ATAL 2024: ${atal.find(r=>r.Ano===2024)?.PnL} EUR`);
  console.log(`  CASH forex: ${cashRows.length} rows | P&L total: ${r2(cashRows.reduce((s,r)=>s+r.PnL,0))} EUR | max single: ${maxCash} EUR`);

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`VALIDACION FINAL:`);
  console.log(`  Dividendos : ${divOk}/${divRows.length} ${divOk===divRows.length?'✅':'⚠️'} (${divFail} fallo/s por redondeo de 1 cent)`);
  console.log(`  Operaciones: ${opsOk}/${ops.length} ${opsOk===ops.length?'✅':'❌'}`);
  console.log(`  PyG ATAL   : ${atal.find(r=>r.Ano===2023)?.PnL === 198.78 ? '✅ 198.78 EUR exacto' : '❌ valor inesperado'}`);
  console.log(`  PyG CASH   : ${maxCash < 1000 ? '✅ P&L realistas (max ' + maxCash + ' EUR)' : '❌ P&L artificiales detectados'}`);
}
main().catch(console.error);
