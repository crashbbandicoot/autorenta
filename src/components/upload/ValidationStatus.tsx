import type { ValidationResult } from "@/types";
import { cn } from "@/lib/utils";

interface ValidationStatusProps {
  validation: ValidationResult;
}

export function ValidationStatus({ validation }: ValidationStatusProps) {
  const warnings = validation.warnings ?? [];

  if (validation.valid) {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-3 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
          <svg className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-green-800">
              ZIP válido — {validation.files.length} archivo{validation.files.length !== 1 ? "s" : ""} encontrado{validation.files.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-green-600 mt-0.5">
              El archivo se ha procesado correctamente. Puedes continuar al informe.
            </p>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <svg className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 mb-1">Avisos</p>
              <ul className={cn("text-xs text-amber-700 space-y-0.5", warnings.length > 1 && "list-disc list-inside")}>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
      <div className="flex items-start gap-3">
        <svg className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <div>
          <p className="text-sm font-medium text-red-800 mb-1">
            El archivo no es válido y no ha sido almacenado
          </p>
          <ul className={cn("text-xs text-red-700 space-y-0.5", validation.errors.length > 1 && "list-disc list-inside")}>
            {validation.errors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
          <p className="text-xs text-red-500 mt-2">
            Corrígelo y vuelve a subir el archivo para continuar.
          </p>
        </div>
      </div>
    </div>
  );
}
