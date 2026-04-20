"use client";

import Link from "next/link";
import { useExtractos } from "@/context/ExtractosContext";
import { calcularPyG } from "@/lib/csv-parser";

function KpiCard({ label, value }: { label: string; value?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm flex flex-col gap-2">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-2xl font-semibold text-gray-900">
        {value ?? "—"}
      </span>
    </div>
  );
}

function AlertCard({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={`rounded-xl p-5 shadow-sm flex flex-col gap-2 border ${
        ok
          ? "bg-green-50 border-green-200"
          : "bg-red-50 border-red-200"
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className={`text-sm font-semibold ${ok ? "text-green-700" : "text-red-700"}`}>
        {ok ? "Sin pérdidas bloqueadas" : "Tienes pérdidas bloqueadas"}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {children}
      </div>
    </div>
  );
}

export default function ValoresDeclaracionPage() {
  const { csvFiles } = useExtractos();

  if (csvFiles.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="mb-2">Sube tus extractos para ver los valores de tu declaración.</p>
        <Link href="/subir-extractos" className="text-blue-600 hover:underline text-sm">
          Ir a subir extractos →
        </Link>
      </div>
    );
  }

  const maxYear = Math.max(...csvFiles.map((f) => f.year));
  const allPygRows = calcularPyG(csvFiles).filter((r) => r.Año === maxYear);
  const pygRows = allPygRows.filter((r) => r.Tipo === "STK");
  const otrosPygRows = allPygRows.filter((r) => r.Tipo !== "STK");

  const valorTransmision = pygRows.reduce((s, r) => s + r["Ganancia (€)"], 0);
  const valorAdquisicion = pygRows.reduce((s, r) => s + r["Pérdida si puede imputarse (€)"], 0);
  const perdidaBloqueada = pygRows.some((r) => r["Pérdida que no puede imputarse (regla 2 meses) (€)"] > 0);

  const otrosTransmision = otrosPygRows.reduce((s, r) => s + r["Ganancia (€)"], 0);
  const otrosAdquisicion = otrosPygRows.reduce((s, r) => s + r["Pérdida si puede imputarse (€)"], 0);

  const fmt = (n: number) =>
    n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Valores para Declaración de la Renta {maxYear + 1}
      </h1>

      <Section title="Acciones">
        <KpiCard label="Entidad Emisora" value="INTERACTIVE BROKERS" />
        <KpiCard label="Valor de transmisión" value={fmt(valorTransmision)} />
        <KpiCard label="Valor de adquisición" value={fmt(Math.abs(valorAdquisicion))} />
        <AlertCard label="Regla de los 2 meses" ok={!perdidaBloqueada} />
      </Section>

      <Section title="Opciones, CFDs y Cash (Forex)">
        <KpiCard label="Valor de transmisión" value={fmt(otrosTransmision)} />
        <KpiCard label="Valor de adquisición" value={fmt(Math.abs(otrosAdquisicion))} />
      </Section>

      <Section title="Dividendos">
        <KpiCard label="Importe bruto total (€)" />
        <KpiCard label="Retención en origen total (€)" />
        <KpiCard label="Casilla 0029 — Importe bruto (€)" />
        <KpiCard label="Casilla 0588 — Doble imposición (€)" />
      </Section>
    </div>
  );
}
