"use client";

import Link from "next/link";
import { InformeSubNav } from "@/components/informe/InformeSubNav";
import { useExtractos } from "@/context/ExtractosContext";

export default function InformeLayout({ children }: { children: React.ReactNode }) {
  const { validation } = useExtractos();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Informe</h1>
        <p className="mt-2 text-gray-500 text-sm">
          Resultados procesados a partir de tus extractos de IBKR.
        </p>
      </div>

      {!validation?.valid && (
        <div className="mb-6 flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
          <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-amber-800">
            No has subido ningún extracto válido todavía.{" "}
            <Link href="/subir-extractos" className="font-medium underline hover:text-amber-900">
              Sube tu ZIP
            </Link>{" "}
            para ver los datos.
          </p>
        </div>
      )}

      <InformeSubNav />
      {children}
    </div>
  );
}
