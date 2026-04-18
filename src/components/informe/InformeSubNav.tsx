"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Histórico de Dividendos", href: "/informe/dividendos" },
  { label: "Histórico de Transacciones", href: "/informe/transacciones" },
  { label: "Informe de PyG", href: "/informe/pyg" },
];

export function InformeSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 mb-8 border-b border-gray-100">
      {tabs.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
              isActive
                ? "text-blue-600 border-blue-600"
                : "text-gray-500 border-transparent hover:text-gray-700"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
