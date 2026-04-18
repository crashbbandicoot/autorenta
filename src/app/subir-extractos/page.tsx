"use client";

import Link from "next/link";
import { DropZone } from "@/components/upload/DropZone";
import { ValidationStatus } from "@/components/upload/ValidationStatus";
import { FileList } from "@/components/upload/FileList";
import { useExtractos } from "@/context/ExtractosContext";

export default function SubirExtractosPage() {
  const { validation, csvFiles, clearFiles } = useExtractos();

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          Sube tu archivo ZIP
        </h1>
        <p className="mt-2 text-gray-500 text-sm">
          El archivo debe contener tus CSVs de IBKR con el nombre correcto.
        </p>
      </div>

      <div className="space-y-4">
        <DropZone />

        {validation && <ValidationStatus validation={validation} />}

        {validation?.valid && csvFiles.length > 0 && (
          <>
            <div>
              <h2 className="text-sm font-medium text-gray-700 mb-2">
                Archivos detectados
              </h2>
              <FileList files={csvFiles} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={clearFiles}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Eliminar y subir otro archivo
              </button>
              <Link
                href="/informe"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
              >
                Ver informe →
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="mt-10 pt-6 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          ¿No sabes cómo obtener el ZIP?{" "}
          <Link href="/obtener-extractos" className="underline hover:text-gray-600">
            Consulta el tutorial
          </Link>
        </p>
      </div>
    </div>
  );
}
