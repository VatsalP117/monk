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
  const safeTotal = Math.max(1, totalPages);
  const progress = Math.min(1, Math.max(0, currentPage / safeTotal));

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-30 h-[2px]">
      <div
        className={`h-full bg-gradient-to-r from-[#5f5e5e] to-[#e4e2e1] fade-smooth ${
          visible ? "opacity-100" : "opacity-0"
        }`}
        style={{ width: `${progress * 100}%` }}
      />
    </div>
  );
}
