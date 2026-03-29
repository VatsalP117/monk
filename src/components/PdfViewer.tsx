import { usePdfViewer } from "../hooks/usePdfViewer";

interface PdfViewerProps {
  documentId: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  theme: "paper" | "sepia" | "dark";
}

export default function PdfViewer({
  documentId,
  currentPage,
  onPageChange,
  theme
}: PdfViewerProps) {
  const {
    canvasRef,
    containerRef,
    isLoading,
    error,
    currentPage: viewerPage,
    totalPages,
    prevPage,
    nextPage,
    zoom,
    setZoom
  } = usePdfViewer(documentId, currentPage);

  const bgClass =
    theme === "dark"
      ? "bg-[#1a1a1a]"
      : theme === "sepia"
        ? "bg-[#f4ecd8]"
        : "bg-white";

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="max-w-md rounded-monk bg-paper-soft p-8 text-center shadow-monk">
          <p className="text-ink-muted">Error loading PDF: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-h-screen flex-col items-center ${bgClass}`}>
      <div className="sticky top-0 z-10 w-full bg-paper-soft/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
prevPage();
onPageChange(viewerPage - 1);
}}
              disabled={viewerPage <= 1}
              className="rounded-monk px-3 py-1 text-sm text-ink-muted hover:bg-paper-strong disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-ink-muted">
              {viewerPage} / {totalPages}
            </span>
            <button
              onClick={() => {
nextPage();
onPageChange(viewerPage + 1);
}}
              disabled={viewerPage >= totalPages}
              className="rounded-monk px-3 py-1 text-sm text-ink-muted hover:bg-paper-strong disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-ink-muted">Zoom:</label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.25"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24"
            />
            <span className="text-sm text-ink-muted">{Math.round(zoom * 100)}%</span>
          </div>
        </div>
      </div>

      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className="relative flex-1 overflow-auto"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-ink-muted">Loading page...</div>
          </div>
        )}
        <canvas
          ref={canvasRef as React.RefObject<HTMLCanvasElement>}
          className="mx-auto shadow-lg"
        />
      </div>
    </div>
  );
}