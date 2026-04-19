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
   git push origin main
   ```

3. **Cuándo hacer commit:** al completar cualquier tarea funcional — no esperes a acumular cambios. Cada commit debe representar un estado funcional del proyecto.

**Repositorio:** https://github.com/crashbbandicoot/autorenta

## Arquitectura
```
src/
├── app/                    # Rutas Next.js (App Router)
│   ├── obtener-extractos/  # Tutorial descarga IBKR
│   ├── subir-extractos/    # Upload + validación ZIP
│   ├── informe/            # 3 sub-informes + Excel export
│   └── instrucciones-renta/# Tutorial AEAT
├── components/
│   ├── layout/             # AppShell, TopNav, NavLink
│   ├── upload/             # DropZone, ValidationStatus, FileList
│   ├── informe/            # InformeSubNav, ReportTable, ExcelDownloadButton
│   └── tutorial/           # TutorialStep, TutorialSection, InfoCallout
├── context/                # ExtractosContext (estado global)
├── lib/                    # zip-validator, csv-parser, excel-exporter
└── types/                  # Interfaces TypeScript compartidas
```

## Lógica de cálculo PyG (`src/lib/csv-parser.ts`)

- `calcularPyG` calcula solo asset classes **STK** (y OPT/FUT si aparecen). Las filas `AssetClass === "CASH"` se filtran en `parseRawTrades` y no se procesan.
- Algoritmo FIFO por ISIN; soporta partial fills (agrupados por `IBOrderID`) y corporate actions (renombrado de ISIN).
- Validado contra `test_data/outputs/InformePyG.pdf`: 50/53 filas STK exactas. Las 3 diferencias restantes son acciones GB cotizadas en GBP — pequeñas discrepancias de FX GBP/EUR, aceptadas de momento.

## Scripts de diagnóstico / validación

Los archivos `.cjs` en la raíz son scripts de Node para diagnóstico y validación, no son parte del build:

| Archivo | Propósito |
|---|---|
| `validate_pyg_stk.cjs` | Compara resultados STK de `calcularPyG` con el PDF de referencia |
| `diag_pyg.cjs` | Diagnóstico de trades individuales (CASH, parciales, DR. MARTENS…) |
| `validate_all.cjs` | Validación general |
| `test_ops.cjs/mjs` | Pruebas de operaciones |
