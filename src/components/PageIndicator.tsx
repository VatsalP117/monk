interface PageIndicatorProps {
  currentPage: number;
  totalPages: number;
  visible: boolean;
}

export default function PageIndicator({
  currentPage,
  totalPages,
  visible
}: PageIndicatorProps): JSX.Element {
  return (
    <div
      className={`pointer-events-none fixed bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-paper-soft/90 px-4 py-2 text-xs uppercase tracking-[0.18em] text-ink-muted shadow-glass fade-smooth ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      — {currentPage} / {totalPages} —
    </div>
  );
}
