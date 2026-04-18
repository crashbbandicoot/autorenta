"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ExtractosState, ValidationResult, CsvFile } from "@/types";
import { validateZip } from "@/lib/zip-validator";

const ExtractosContext = createContext<ExtractosState | null>(null);

const STORAGE_KEY = "autorenta_validation";

function serializeValidation(v: ValidationResult): string {
  // Don't store rawContent in localStorage (can be large)
  const slim = {
    ...v,
    files: v.files.map(({ rawContent: _, ...rest }) => rest),
  };
  return JSON.stringify(slim);
}

export function ExtractosProvider({ children }: { children: React.ReactNode }) {
  const [zipFile, setZipFileState] = useState<File | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Rehydrate slim validation from localStorage on mount (no rawContent)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ValidationResult;
        setValidation(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  const setZipFile = useCallback(async (file: File) => {
    setZipFileState(file);
    setIsValidating(true);
    try {
      const result = await validateZip(file);
      setValidation(result);
      try {
        localStorage.setItem(STORAGE_KEY, serializeValidation(result));
      } catch {
        // ignore storage errors
      }
    } finally {
      setIsValidating(false);
    }
  }, []);

  const clearFiles = useCallback(() => {
    setZipFileState(null);
    setValidation(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const csvFiles: CsvFile[] = validation?.files ?? [];

  return (
    <ExtractosContext.Provider
      value={{ zipFile, validation, csvFiles, isValidating, setZipFile, clearFiles }}
    >
      {children}
    </ExtractosContext.Provider>
  );
}

export function useExtractos(): ExtractosState {
  const ctx = useContext(ExtractosContext);
  if (!ctx) throw new Error("useExtractos must be used within ExtractosProvider");
  return ctx;
}
