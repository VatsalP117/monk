import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../state/store";
import { getWordCount, importFromFile, importFromPastedText } from "../utils/importers";
import type { ImportResult } from "../types";

const MAX_STORED_CONTENT_CHARS = 2_000_000;

export function useImportDocument(): {
  importFile: (file: File) => Promise<void>;
  importPasted: (payload: { title: string; content: string }) => Promise<void>;
} {
  const navigate = useNavigate();
  const addDocument = useAppStore((state) => state.addDocument);
  const setImporting = useAppStore((state) => state.setImporting);
  const setImportError = useAppStore((state) => state.setImportError);
  const setImportStatus = useAppStore((state) => state.setImportStatus);
  const setImportWarning = useAppStore((state) => state.setImportWarning);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    []
  );

  const commitImport = useCallback(
    (payload: ImportResult) => {
      if (payload.content.length > MAX_STORED_CONTENT_CHARS) {
        throw new Error("Imported document is too large to store locally. Try a smaller file.");
      }
      const wordCount = getWordCount(payload.content);
      const created = addDocument({
        title: payload.title,
        content: payload.content,
        format: payload.format,
        markdownPages: payload.markdownPages,
        sourceMeta: payload.sourceMeta,
        wordCount
      });
      setImportWarning(payload.warning ?? null);
      navigate(`/reader/${created.id}`);
    },
    [addDocument, navigate, setImportWarning]
  );

  const beginImport = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setImportError(null);
    setImportWarning(null);
    setImportStatus("Preparing import...");
    setImporting(true);
    return controller;
  }, [setImportError, setImportWarning, setImportStatus, setImporting]);

  const finishImport = useCallback(
    (controller: AbortController) => {
      if (abortRef.current !== controller) {
        return;
      }
      abortRef.current = null;
      setImporting(false);
      setImportStatus(null);
    },
    [setImportStatus, setImporting]
  );

  const importFile = useCallback(
    async (file: File) => {
      const controller = beginImport();

      try {
        setImportStatus("Reading document...");
        const imported = await importFromFile(file, {
          signal: controller.signal,
          onStatus: (status) => {
            setImportStatus(status);
          }
        });

        if (!imported.content.trim()) {
          throw new Error("The file has no readable text content.");
        }

        commitImport(imported);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import failed. Please try another file.";
        if (controller.signal.aborted) {
          return;
        }
        setImportError(message || "Import failed. Please try another file.");
      } finally {
        finishImport(controller);
      }
    },
    [beginImport, commitImport, finishImport, setImportError, setImportStatus]
  );

  const importPasted = useCallback(
    async (payload: { title: string; content: string }) => {
      const controller = beginImport();
      setImportStatus("Saving pasted text...");

      try {
        const imported = importFromPastedText(payload);
        if (!imported.content.trim()) {
          throw new Error("Paste content before importing.");
        }
        commitImport(imported);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not import pasted content.";
        setImportError(message);
      } finally {
        finishImport(controller);
      }
    },
    [beginImport, commitImport, finishImport, setImportError, setImportStatus]
  );

  return {
    importFile,
    importPasted
  };
}
