import { useRef, useState } from "react";

interface ImportDropzoneProps {
  importing: boolean;
  title: string;
  subtitle: string;
  onFileSelected: (file: File) => Promise<void>;
}

export default function ImportDropzone({
  importing,
  title,
  subtitle,
  onFileSelected
}: ImportDropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragOver(false);
        const file = event.dataTransfer.files[0];
        if (file) {
          void onFileSelected(file);
        }
      }}
      className={`fade-smooth w-full rounded-monk px-6 py-8 text-center ${
        isDragOver ? "bg-paper-strong" : "bg-paper-soft"
      }`}
    >
      <h3 className="font-reading text-[1.45rem] tracking-tight text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-[40ch] text-sm leading-6 text-ink-muted">{subtitle}</p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled={importing}
          onClick={() => inputRef.current?.click()}
          className="fade-smooth rounded-monk bg-[#5f5e5e] px-5 py-2.5 text-sm text-[#faf7f6] hover:bg-[#535252] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {importing ? "Processing..." : "Choose File"}
        </button>
        <span className="text-xs uppercase tracking-[0.16em] text-ink-muted">TXT · MD · EPUB · PDF</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".txt,.md,.epub,.pdf,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void onFileSelected(file);
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
