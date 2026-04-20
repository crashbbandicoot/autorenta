# AutoRenta — Instrucciones para Claude

## Descripción del proyecto
Aplicación web para ayudar a clientes de Interactive Brokers a preparar su declaración de la renta en España. Next.js 16 + TypeScript + Tailwind CSS, procesamiento 100% en cliente (sin backend).

## Stack técnico
- **Framework:** Next.js 16 (App Router), TypeScript
- **Estilos:** Tailwind CSS, diseño minimalista estilo Apple
- **Librerías clave:** jszip, xlsx, papaparse, react-dropzone
- **Estado global:** `src/context/ExtractosContext.tsx` + localStorage

## Flujo de Git y GitHub — OBLIGATORIO

**Siempre que hagas cambios de código debes:**

1. **Commit local** con mensaje claro y descriptivo en inglés:
   - Formato: `<tipo>: <descripción breve en imperativo>`
   - Tipos: `feat`, `fix`, `refactor`, `style`, `chore`
   - Ejemplos: `feat: add FIFO P&L calculation`, `fix: zip validation ignores nested folders`

2. **Push a GitHub** inmediatamente después de cada commit:
   ```
   git push origin master
   ```

3. **Cuándo hacer commit:** al completar cualquier tarea funcional — no esperes a acumular cambios. Cada commit debe representar un estado funcional del proyecto.

**Repositorio:** https://github.com/crashbbandicoot/autorenta

## Arquitectura
```
src/
├── app/                    # Rutas Next.js (App Router)
│   ├── obtener-extractos/  # Tutorial descarga IBKR
│   ├── subir-extractos/    # Upload + validación ZIP
│   ├── informe/            # 4 sub-informes + Excel export
│   └── instrucciones-renta/# Tutorial AEAT
├── components/
│   ├── layout/             # AppShell, TopNav, NavLink
│   ├── upload/             # DropZone, ValidationStatus, FileList
│   ├── informe/            # InformeSubNav, ReportTable, ExcelDownloadButton
│   └── tutorial/           # TutorialStep, TutorialSection, InfoCallout
├── context/                # ExtractosContext (estado global)
├── lib/                    # zip-validator, csv-parser, excel-exporter, treaty-rates
└── types/                  # Interfaces TypeScript compartidas
```

## Tipos de fichero aceptados en el ZIP

| Nombre | Fuente IBKR | Obligatorio |
|---|---|---|
| `operaciones_YYYY.csv` | Trades (Activity Statement, sección Trades, formato CSV) | Sí |
| `dividendos_YYYY.csv` | Dividends (Activity Statement, sección Dividends, formato CSV) | Sí |
| `actividad_YYYY.csv` | Activity Statement completo (formato CSV, renombrado por el usuario) | Sí (por cada año con operaciones) |

El validador (`src/lib/zip-validator.ts`) exige un `actividad_YYYY.csv` por cada año con `operaciones_YYYY.csv`. Sin él el ZIP se rechaza con mensaje descriptivo.

## Lógica de cálculo PyG (`src/lib/csv-parser.ts`)

`calcularPyG` devuelve filas STK + FOREX combinadas, ordenadas por año:

### STK / OPT / FUT
- Las filas `AssetClass === "CASH"` se filtran en `parseRawTrades` y no entran en el cálculo STK.
- Algoritmo FIFO por ISIN; soporta partial fills (agrupados por `IBOrderID`) y corporate actions (renombrado de ISIN).
- Validado contra `test_data/outputs/InformePyG.pdf`: 50/53 filas STK exactas. Las 3 diferencias restantes son acciones GB cotizadas en GBP — pequeñas discrepancias de FX GBP/EUR, aceptadas de momento.

### FOREX (`calcularCashPyG`)
- Lee `actividad_YYYY.csv` (Activity Statement completo de IBKR).
- Extrae filas de la sección `Realized & Unrealized Performance Summary` con categoría `Forex` (excluye la fila `Total`).
- IBKR ya aplica FIFO internamente; los importes están en EUR (divisa base de la cuenta).
- Agrupa por año + divisa (CAD, GBP, PLN, SEK, USD…).
- `Ganancia (€)` = S/T Profit + L/T Profit (cols 5 + 7); `Pérdida (€)` = S/T Loss + L/T Loss (cols 6 + 8).
- `Tipo = "FOREX"`, `ISIN = ""`, `Producto = código de divisa`.

## Lógica de cálculo Informe de Dividendos (`src/lib/csv-parser.ts` + `src/lib/treaty-rates.ts`)

- `calcularInformeDividendos` agrupa por Año+País usando `collectRawDivRows` (valores sin redondeo por fila para evitar drift de acumulación).
- Excluye filas con `"Interest from RIC or REIT"` (van a casilla 0027, no a este informe).
- Filas con `"Return of Capital"` se agrupan como país especial y nunca entran en el cálculo de doble imposición.
- Doble imposición (`Casilla 0588`, `Reten. ori. Doble Impo.`): solo aplica si `treaty_rate > 0 AND retenOri > 0 AND país ≠ "Return of Capital"`.
- Fórmula: `Reten. ori. Doble Impo. = min(retenOri, bruto × treaty_rate / 100)`.
- `treaty-rates.ts`: tabla estática de límites por convenio según AEAT, con overrides por año (ej. Brasil 2024+ = 0% — tratado terminado). Fuente: https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/manual-tributacion-no-residentes/anexos/limites-imposicion-convenios.html
- Validado contra `test_data/outputs/InformePyG.pdf` páginas 7-9: 137/140 campos exactos. Las 3 diferencias son informativas y no afectan a las casillas de la declaración (ver `validate_dividendos.cjs`).

## Scripts de diagnóstico / validación

Los archivos `.cjs` en la raíz son scripts de Node para diagnóstico y validación, no son parte del build:

| Archivo | Propósito |
|---|---|
| `validate_pyg_stk.cjs` | Compara resultados STK de `calcularPyG` con el PDF de referencia |
| `validate_dividendos.cjs` | Compara resultados de `calcularInformeDividendos` con el PDF (págs. 7-9) |
| `diag_pyg.cjs` | Diagnóstico de trades individuales (CASH, parciales, DR. MARTENS…) |
| `validate_all.cjs` | Validación general |
| `test_ops.cjs/mjs` | Pruebas de operaciones |
