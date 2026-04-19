/**
 * Valida calcularInformeDividendos contra las páginas 7-9 de
 * test_data/outputs/InformePyG.pdf  (datos de prueba reales).
 *
 * Uso:  node validate_dividendos.cjs
 */

const JSZip  = require('./node_modules/jszip');
const Papa   = require('./node_modules/papaparse');
const fs     = require('fs');

// ── Helpers ──────────────────────────────────────────────────────────────────
function r2(n) { return Math.round(n * 100) / 100; }
function f(s)  { return parseFloat(s ?? '0') || 0; }
function fmtDate(s) {
  return `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`;
}

// ── Treaty rates (copia de src/lib/treaty-rates.ts) ──────────────────────────
const BASE_RATES = {
  AL:10, DE:15, AD:15, SA:5,  DZ:15, AR:15, AM:10, AU:15, AT:15, AZ:10,
  BB:5,  BE:15, BY:10, BO:15, BA:10, BR:15, BG:15, CV:10, CA:15, QA:5,
  CZ:15, CY:5,  CL:10, CN:10, CO:5,  KR:15, CR:12, HR:15, CU:15, DK:15,
  DO:10, EC:15, EG:12, AE:15, SK:15, SI:15, US:15, EE:15, PH:15, FI:15,
  FR:15, GE:10, GR:10, HK:10, HU:15, IN:15, ID:15, IR:10, IE:15, IS:15,
  IL:10, IT:15, JM:10, JP:10, KZ:15, KW:5,  LV:10, LT:15, LU:15, MK:15,
  MY:5,  MT:5,  MA:15, MX:10, MD:10, NG:10, NO:15, NZ:15, OM:10, NL:15,
  PK:10, PA:10, PY:10, PL:15, PT:15, GB:10, RO:5,  RU:15, SV:12, SN:10,
  RS:10, SG:5,  ZA:15, SE:15, CH:15, TH:10, TT:10, TN:15, TR:15, UY:5,
  UZ:10, VE:10, VN:15, KG:18, TJ:18, TM:18,
};
const YEAR_OVERRIDES = {
  2024: { BR: 0 },
  2025: { BR: 0 },
};
function getTreatyRate(country, year) {
  return YEAR_OVERRIDES[year]?.[country] ?? BASE_RATES[country] ?? 0;
}

// ── collectRawDivRows + calcularInformeDividendos (réplica de csv-parser.ts) ──
function collectRawDivRows(csvFiles) {
  const rows = [];
  for (const file of csvFiles.filter(f => f.type === 'dividendos').sort((a,b) => a.year - b.year)) {
    const parsed = Papa.parse(file.rawContent, { header: false, skipEmptyLines: true });
    for (const row of parsed.data) {
      if (row[0] !== 'DividendDetail' || row[1] !== 'Data' || row[2] !== 'RevenueComponent') continue;
      const revenueComponent = row[10] ?? '';
      rows.push({
        año:            parseInt(row[7]?.slice(0,4) ?? '0'),
        pais:           revenueComponent.includes('Return of Capital') ? 'Return of Capital' : (row[6] ?? ''),
        producto:       `${row[4]}-${revenueComponent}`,
        grossInBase:    f(row[13]),
        withholdInBase: Math.abs(f(row[16])),
      });
    }
  }
  return rows;
}

function calcularInformeDividendos(csvFiles) {
  const rawRows = collectRawDivRows(csvFiles).filter(d => !d.producto.includes('Interest from RIC or REIT'));

  const groups = new Map();
  for (const d of rawRows) {
    const key = `${d.año}|${d.pais}`;
    const g   = groups.get(key) ?? { año: d.año, pais: d.pais, bruto: 0, retenOri: 0 };
    g.bruto    += d.grossInBase;
    g.retenOri += d.withholdInBase;
    groups.set(key, g);
  }

  return [...groups.values()]
    .sort((a, b) => a.año - b.año || a.pais.localeCompare(b.pais))
    .map(({ año, pais, bruto: rawBruto, retenOri: rawRetenOri }) => {
      const bruto    = r2(rawBruto);
      const retenOri = r2(rawRetenOri);
      const treatyRate = getTreatyRate(pais, año);
      const hasTreaty  = treatyRate > 0 && retenOri > 0 && pais !== 'Return of Capital';
      const pctRet     = bruto > 0 ? r2((retenOri / bruto) * 100) : 0;
      const brutoDI    = hasTreaty ? bruto : 0;
      const retenDI    = hasTreaty ? r2(Math.min(retenOri, (bruto * treatyRate) / 100)) : 0;
      return {
        Año:  año,
        País: pais,
        'Importe Bruto (€)':                bruto,
        'Reten. Ori.(€)':                   retenOri,
        'Reten. Des.(€)':                   0,
        '% Retenciones':                    pctRet,
        'Casilla 0029 — Importe Bruto (€)': bruto,
        'Reten. dest. -España- (€)':        0,
        'Casilla 0588 — Bruto Doble Impo. (€)': brutoDI,
        'Reten. ori. Doble Impo. (€)':      retenDI,
        '% según lím. convenio':            hasTreaty ? treatyRate : 0,
      };
    });
}

// ── Valores esperados del PDF (páginas 7-9) ───────────────────────────────────
// Columnas: bruto | retenOri | pctRet | c0029 | c0588 | retenDI | pctConv
// Nota: pctConv es el % que muestra el PDF de referencia (puede diferir del AEAT actual)
const EXPECTED = [
  // 2022
  { año:2022, pais:'US',               bruto:127.50, retenOri:19.14, pctRet:15.01, c0029:127.50, c0588:127.50, retenDI:19.12, pctConv:15 },
  // 2023
  { año:2023, pais:'BM',               bruto:  2.99, retenOri: 0.00, pctRet: 0.00, c0029:  2.99, c0588:  0.00, retenDI: 0.00, pctConv: 0 },
  { año:2023, pais:'BR',               bruto:113.95, retenOri: 3.61, pctRet: 3.17, c0029:113.95, c0588:113.95, retenDI: 3.61, pctConv:15 },
  { año:2023, pais:'GB',               bruto: 15.98, retenOri: 0.00, pctRet: 0.00, c0029: 15.98, c0588:  0.00, retenDI: 0.00, pctConv:15 }, // PDF usa tipo antiguo 15%; nosotros 10%
  { año:2023, pais:'NL',               bruto:  1.97, retenOri: 0.22, pctRet:11.17, c0029:  1.97, c0588:  1.97, retenDI: 0.22, pctConv:15 },
  { año:2023, pais:'PL',               bruto: 70.98, retenOri:13.49, pctRet:19.01, c0029: 70.98, c0588: 70.98, retenDI:10.65, pctConv:15 },
  { año:2023, pais:'Return of Capital',bruto:  0.47, retenOri: 0.00, pctRet: 0.00, c0029:  0.47, c0588:  0.00, retenDI: 0.00, pctConv: 0 },
  { año:2023, pais:'TW',               bruto:  4.17, retenOri: 0.88, pctRet:21.10, c0029:  4.17, c0588:  4.17, retenDI: 0.00, pctConv:15 }, // PDF incluye TW en DI; nosotros no (TW no en tabla AEAT)
  { año:2023, pais:'US',               bruto: 94.27, retenOri:14.15, pctRet:15.00, c0029: 94.27, c0588: 94.27, retenDI:14.14, pctConv:15 },
  // 2024
  { año:2024, pais:'BM',               bruto:  9.41, retenOri: 0.00, pctRet: 0.00, c0029:  9.41, c0588:  0.00, retenDI: 0.00, pctConv: 0 },
  { año:2024, pais:'BR',               bruto:117.13, retenOri: 3.53, pctRet: 3.01, c0029:117.13, c0588:  0.00, retenDI: 0.00, pctConv: 0 }, // Convenio terminado en 2024
  { año:2024, pais:'CN',               bruto: 31.76, retenOri: 0.00, pctRet: 0.00, c0029: 31.76, c0588:  0.00, retenDI: 0.00, pctConv: 0 },
  { año:2024, pais:'GB',               bruto:  5.49, retenOri: 0.00, pctRet: 0.00, c0029:  5.49, c0588:  0.00, retenDI: 0.00, pctConv: 0 },
  { año:2024, pais:'KZ',               bruto: 19.35, retenOri: 0.00, pctRet: 0.00, c0029: 19.35, c0588:  0.00, retenDI: 0.00, pctConv: 0 }, // PDF muestra 0%; AEAT dice 15% — sin retención, hasTreaty=false
  { año:2024, pais:'NL',               bruto:  8.47, retenOri: 1.02, pctRet:12.04, c0029:  8.47, c0588:  8.47, retenDI: 1.02, pctConv:15 },
  { año:2024, pais:'PL',               bruto: 41.87, retenOri: 7.96, pctRet:19.01, c0029: 41.87, c0588: 41.87, retenDI: 6.28, pctConv:15 },
  { año:2024, pais:'Return of Capital',bruto: 18.63, retenOri: 0.00, pctRet: 0.00, c0029: 18.63, c0588:  0.00, retenDI: 0.00, pctConv: 0 },
  { año:2024, pais:'SE',               bruto: 53.00, retenOri:15.90, pctRet:30.00, c0029: 53.00, c0588: 53.00, retenDI: 7.95, pctConv:15 },
  { año:2024, pais:'TW',               bruto: 13.27, retenOri: 2.78, pctRet:20.95, c0029: 13.27, c0588:  0.00, retenDI: 0.00, pctConv: 0 },
  { año:2024, pais:'US',               bruto:105.54, retenOri:15.83, pctRet:15.00, c0029:105.54, c0588:105.54, retenDI:15.83, pctConv:15 },
];

// Campos conocidos como DISTINTOS entre el PDF y nuestra implementación:
// (se muestran siempre en sección aparte, no como fallos graves)
const KNOWN_DIFFS = new Set([
  '2023|GB|% según lím. convenio',   // PDF=15 (convenio antiguo), AEAT actual=10
  '2023|TW|Casilla 0588 — Bruto Doble Impo. (€)',  // PDF incluye TW; nosotros no (sin convenio AEAT)
  '2023|TW|Reten. ori. Doble Impo. (€)',
  '2023|TW|% según lím. convenio',
  '2024|KZ|% según lím. convenio',   // PDF=0 (sin convenio en ref), AEAT=15 — pero hasTreaty=false, DI=0 en ambos
  '2024|CN|% según lím. convenio',   // PDF=0 (sin retención → irrelevante); AEAT=10 pero hasTreaty=false, DI=0 en ambos
  '2024|GB|% según lím. convenio',   // ídem CN — sin retención, hasTreaty=false, DI=0 en ambos
]);

// ── Comparación ───────────────────────────────────────────────────────────────
const TOLERANCE = 0.02; // ±0.02 € o ±0.02 %

function near(a, b) { return Math.abs(a - b) <= TOLERANCE; }

function compareRow(exp, got) {
  const checks = [
    ['Importe Bruto (€)',                   exp.bruto,    got['Importe Bruto (€)']],
    ['Reten. Ori.(€)',                      exp.retenOri, got['Reten. Ori.(€)']],
    ['% Retenciones',                       exp.pctRet,   got['% Retenciones']],
    ['Casilla 0029 — Importe Bruto (€)',    exp.c0029,    got['Casilla 0029 — Importe Bruto (€)']],
    ['Casilla 0588 — Bruto Doble Impo. (€)',exp.c0588,    got['Casilla 0588 — Bruto Doble Impo. (€)']],
    ['Reten. ori. Doble Impo. (€)',         exp.retenDI,  got['Reten. ori. Doble Impo. (€)']],
    ['% según lím. convenio',               exp.pctConv,  got['% según lím. convenio']],
  ];
  return checks.map(([field, expVal, gotVal]) => ({
    field, expVal, gotVal,
    ok:    near(expVal, gotVal),
    known: KNOWN_DIFFS.has(`${exp.año}|${exp.pais}|${field}`),
  }));
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  const zipData  = fs.readFileSync('./test_data/inputs/renta_2026.zip');
  const zip      = await JSZip.loadAsync(zipData);
  const csvFiles = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    const m = name.match(/^(dividendos|operaciones)_(\d{4})\.csv$/i);
    if (m) {
      const content = await entry.async('string');
      csvFiles.push({ name, year: parseInt(m[2]), type: m[1].toLowerCase(), rawContent: content });
    }
  }

  const results = calcularInformeDividendos(csvFiles);

  // Indexar por año|país
  const computed = new Map();
  for (const r of results) computed.set(`${r.Año}|${r.País}`, r);

  const expectedMap = new Map();
  for (const e of EXPECTED) expectedMap.set(`${e.año}|${e.pais}`, e);

  let pass = 0, failHard = 0, failKnown = 0;
  const failures = [], knownDiffs = [];

  console.log('\n=== Validación Informe de Dividendos ===\n');
  console.log(`${'Año'.padEnd(5)} ${'País'.padEnd(20)} ${'Campo'.padEnd(47)} ${'Esperado'.padStart(9)} ${'Obtenido'.padStart(9)}  Estado`);
  console.log('─'.repeat(100));

  for (const [key, exp] of expectedMap) {
    const got = computed.get(key);
    if (!got) {
      failHard++;
      failures.push(`  MISSING  ${key}`);
      console.log(`${String(exp.año).padEnd(5)} ${exp.pais.padEnd(20)} ${'— FILA NO ENCONTRADA —'.padEnd(47)}`);
      continue;
    }

    const checks = compareRow(exp, got);
    let rowLabel = true;
    for (const { field, expVal, gotVal, ok, known } of checks) {
      if (ok) { pass++; continue; }

      const tag  = known ? '⚠ conocida' : '✗ ERROR';
      const line = `${String(exp.año).padEnd(5)} ${exp.pais.padEnd(20)} ${field.padEnd(47)} ${String(expVal).padStart(9)} ${String(gotVal).padStart(9)}  ${tag}`;

      if (rowLabel) { console.log(); rowLabel = false; }
      console.log(line);

      if (known) {
        failKnown++;
        knownDiffs.push(`  ${exp.año} ${exp.pais} — ${field}: PDF=${expVal} AEAT=${gotVal}`);
      } else {
        failHard++;
        failures.push(`  ${exp.año} ${exp.pais} — ${field}: esperado=${expVal} obtenido=${gotVal}`);
      }
    }
  }

  // Filas no cubiertas por el PDF (2025 u otras)
  const extras = [];
  for (const [key, r] of computed) {
    if (!expectedMap.has(key)) {
      extras.push(`  ${r.Año} ${r.País} — Bruto=${r['Importe Bruto (€)']} RetenOri=${r['Reten. Ori.(€)']} (sin referencia en PDF)`);
    }
  }

  // ── Resumen ──
  console.log('\n' + '═'.repeat(60));
  console.log(`CAMPOS OK:     ${pass}`);
  console.log(`ERRORES:       ${failHard}${failHard === 0 ? '  ✓' : '  ✗'}`);
  console.log(`DIFS CONOCIDAS: ${failKnown}  (no son errores — ver notas)`);
  console.log(`FILAS EXTRA:   ${extras.length}  (años sin referencia en PDF)`);

  if (failures.length) {
    console.log('\n── Errores ──────────────────────────────────────────────────');
    failures.forEach(l => console.log(l));
  }

  if (knownDiffs.length) {
    console.log('\n── Diferencias conocidas (explicación) ─────────────────────');
    console.log('  2023 GB % según lím. convenio: PDF usaba tipo antiguo 15%; tabla AEAT actual = 10%.');
    console.log('  2023 TW DI: el PDF de referencia incluía TW con 15% de convenio,');
    console.log('              pero Taiwan no aparece en la tabla AEAT oficial.');
    console.log('              Con TW no hay retención deducible por doble imposición.');
    console.log('  2024 KZ/CN/GB % según lím. convenio: el PDF mostraba 0% para estos países.');
    console.log('              Como no hubo retención en origen, hasTreaty=false → DI=0 en ambas versiones.');
    console.log('              La diferencia es solo informativa; no afecta a las casillas de la declaración.');
  }

  if (extras.length) {
    console.log('\n── Filas extra (sin referencia en el PDF de test) ───────────');
    extras.forEach(l => console.log(l));
  }

  // ── Totales por año ──
  console.log('\n── Totales por año ──────────────────────────────────────────');
  // Totales calculados sumando las filas individuales del PDF (más fiables que la fila Total del PDF)
  // 2023 c0588: BR(113.95)+NL(1.97)+PL(70.98)+TW(4.17)+US(94.27)=285.34; sin TW(nuestro)=281.17
  // 2024 c0588: NL(8.47)+PL(41.87)+SE(53.00)+US(105.54)=208.88
  const pdfTotals = {
    2022: { bruto: 127.50, retenOri: 19.14, c0588: 127.50, retenDI: 19.12 },
    2023: { bruto: 304.78, retenOri: 32.35, c0588: 285.34, retenDI: 28.62 }, // c0588 incluye TW (4.17); sin TW=281.17
    2024: { bruto: 423.92, retenOri: 47.02, c0588: 208.88, retenDI: 31.08 }, // solo países con hasTreaty
  };
  for (const [yr, ref] of Object.entries(pdfTotals)) {
    const rows = results.filter(r => r.Año === parseInt(yr));
    const tBruto   = r2(rows.reduce((s,r) => s + r['Importe Bruto (€)'],                0));
    const tReten   = r2(rows.reduce((s,r) => s + r['Reten. Ori.(€)'],                   0));
    const tC0588   = r2(rows.reduce((s,r) => s + r['Casilla 0588 — Bruto Doble Impo. (€)'], 0));
    const tRetenDI = r2(rows.reduce((s,r) => s + r['Reten. ori. Doble Impo. (€)'],      0));

    const bOk  = near(tBruto,   ref.bruto);
    const rOk  = near(tReten,   ref.retenOri);
    const cOk  = near(tC0588,   ref.c0588);
    const dOk  = near(tRetenDI, ref.retenDI);
    console.log(`  ${yr}  Bruto=${tBruto} (exp ${ref.bruto}) ${bOk?'✓':'✗'}  RetenOri=${tReten} (exp ${ref.retenOri}) ${rOk?'✓':'✗'}  C0588=${tC0588} (exp ${ref.c0588}) ${cOk?'✓':'✗'}  RetenDI=${tRetenDI} (exp ${ref.retenDI}) ${dOk?'✓':'✗'}`);
  }
}

main().catch(console.error);
