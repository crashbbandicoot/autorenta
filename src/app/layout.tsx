import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { ExtractosProvider } from "@/context/ExtractosContext";

export const metadata: Metadata = {
  title: "AutoRenta — IBKR",
  description: "Ayuda para la declaración de la renta con Interactive Brokers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-gray-50 text-gray-900 antialiased min-h-screen" suppressHydrationWarning>
        <ExtractosProvider>
          <AppShell>{children}</AppShell>
        </ExtractosProvider>
      </body>
    </html>
  );
}
