import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../state/store";
import { getWordCount, importFromFile, importFromPastedText } from "../utils/importers";

export function useImportDocument(): {
  importFile: (file: File) => Promise<void>;
  importPasted: (payload: { title: string; content: string }) => Promise<void>;
} {
  const navigate = useNavigate();
  const addDocument = useAppStore((state) => state.addDocument);
  const setImporting = useAppStore((state) => state.setImporting);
  const setImportError = useAppStore((state) => state.setImportError);

  const commitImport = useCallback(
    (payload: { title: string; content: string; format: "txt" | "md" | "pdf" | "epub" | "paste" }) => {
      const wordCount = getWordCount(payload.content);
      const created = addDocument({
        title: payload.title,
        content: payload.content,
        format: payload.format,
        wordCount
      });
      navigate(`/reader/${created.id}`);
    },
    [addDocument, navigate]
  );

  const importFile = useCallback(
    async (file: File) => {
      setImportError(null);
      setImporting(true);

      try {
        const imported = await importFromFile(file);
        if (!imported.content.trim()) {
          throw new Error("The file has no readable text content.");
        }
        commitImport(imported);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import failed. Please try another file.";
        setImportError(message);
      } finally {
        setImporting(false);
      }
    },
    [commitImport, setImportError, setImporting]
  );

  const importPasted = useCallback(
    async (payload: { title: string; content: string }) => {
      setImportError(null);
      setImporting(true);

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
        setImporting(false);
      }
    },
    [commitImport, setImportError, setImporting]
  );

  return {
    importFile,
    importPasted
  };
}
