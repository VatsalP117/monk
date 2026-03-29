import { useEffect, useRef, useState, useCallback } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { getPdfBlob } from "../utils/storage/idb";

GlobalWorkerOptions.workerSrc = pdfWorker;

interface UsePdfViewerResult {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  zoom: number;
  setZoom: (zoom: number) => void;
}

export function usePdfViewer(
  documentId: string,
  initialPage: number = 1
): UsePdfViewerResult {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pdfDocRef = useRef<Awaited<ReturnType<typeof getDocument>["promise"]> | null>(null);
  const renderTaskRef = useRef<unknown>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.5);
  const [documentLoaded, setDocumentLoaded] = useState(false);

  useEffect(() => {
    const effectiveInitial = initialPage;
    if (effectiveInitial !== currentPage && currentPage === 1) {
      setCurrentPage(effectiveInitial);
    }
  }, [initialPage]);

  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      try {
        setIsLoading(true);
        setError(null);

        const buffer = await getPdfBlob(documentId);
        if (!buffer) {
          throw new Error("PDF not found in storage");
        }

        const pdf = await getDocument({ data: buffer }).promise;

        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfDocRef.current = pdf;
        setTotalPages(pdf.numPages);
        setDocumentLoaded(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load PDF");
          setIsLoading(false);
        }
      }
    }

    loadPdf();

    return () => {
      cancelled = true;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
        pdfDocRef.current = null;
      }
    };
  }, [documentId]);

  const renderPage = useCallback(async () => {
    const pdf = pdfDocRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!pdf || !canvas || !container) {
      return;
    }

    renderTaskRef.current = null;

    try {
      setIsLoading(true);
      const page = await pdf.getPage(currentPage);
      const scale = zoom * devicePixelRatio;
      const viewport = page.getViewport({ scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      canvas.style.width = `${viewport.width / devicePixelRatio}px`;
      canvas.style.height = `${viewport.height / devicePixelRatio}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      const renderTask = page.render({
        canvasContext: ctx,
        viewport
      });
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;

      setIsLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to render page");
      setIsLoading(false);
    }
  }, [currentPage, zoom]);

  useEffect(() => {
    if (documentLoaded) {
      renderPage();
    }
  }, [documentLoaded, renderPage]);

  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  const nextPage = useCallback(() => {
    setCurrentPage((p) => Math.min(p + 1, totalPages));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setCurrentPage((p) => Math.max(p - 1, 1));
  }, []);

  return {
    canvasRef,
    containerRef,
    isLoading,
    error,
    currentPage,
    totalPages,
    goToPage,
    nextPage,
    prevPage,
    zoom,
    setZoom
  };
}