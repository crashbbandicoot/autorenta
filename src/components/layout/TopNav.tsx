"use client";

import { NavLink } from "./NavLink";
import { useExtractos } from "@/context/ExtractosContext";

export function TopNav() {
  const { validation } = useExtractos();
  const hasValidZip = validation?.valid === true;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900 tracking-tight">
          AutoRenta
        </span>
        <nav className="flex items-center gap-6">
          <NavLink href="/obtener-extractos" label="Obtener extractos" />
          <NavLink
            href="/subir-extractos"
            label="Subir extractos"
            badge={hasValidZip}
          />
          <NavLink href="/informe" label="Informe" />
          <NavLink href="/instrucciones-renta" label="Instrucciones Renta" />
        </nav>
      </div>
    </header>
  );
}
