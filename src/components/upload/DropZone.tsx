"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import { useExtractos } from "@/context/ExtractosContext";

export function DropZone() {
  const { setZipFile, isValidating, validation, zipFile } = useExtractos();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles[0]) {
        setZipFile(acceptedFiles[0]);
      }
    },
    [setZipFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/zip": [".zip"], "application/x-zip-compressed": [".zip"] },
    maxFiles: 1,
    disabled: isValidating,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-8 py-14 cursor-pointer transition-colors",
        isDragActive
          ? "border-blue-400 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
      )}
    >
      <input {...getInputProps()} />

      {isValidating ? (
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="text-sm text-gray-500">Validando archivo...</p>
        </div>
      ) : (
        <>
          <svg
            className="h-10 w-10 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
          <div className="text-center">
            <p className="text-sm font-medium text-gray-700">
              {isDragActive ? "Suelta el archivo aquí" : "Arrastra tu .zip o haz clic para seleccionar"}
            </p>
            {zipFile && (
              <p className="mt-1 text-xs text-gray-400">
                {zipFile.name} ({(zipFile.size / 1024).toFixed(0)} KB)
              </p>
            )}
            {!zipFile && (
              <p className="mt-1 text-xs text-gray-400">Solo archivos .zip</p>
            )}
          </div>
          {validation && (
            <div
              className={cn(
                "absolute top-3 right-3 h-2 w-2 rounded-full",
                validation.valid ? "bg-green-500" : "bg-red-400"
              )}
            />
          )}
        </>
      )}
    </div>
  );
}
