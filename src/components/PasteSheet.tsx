import { useState } from "react";

interface PasteSheetProps {
  open: boolean;
  importing: boolean;
  onClose: () => void;
  onImport: (payload: { title: string; content: string }) => Promise<void>;
}

export default function PasteSheet({ open, importing, onClose, onImport }: PasteSheetProps): JSX.Element | null {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2c2c2c33] p-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-monk bg-paper-soft p-6 shadow-glass">
        <h2 className="font-reading text-2xl">Paste Content</h2>
        <p className="mt-2 text-sm text-ink-muted">Drop notes, articles, or drafts directly into Monk.</p>

        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title (optional)"
          className="surface-input mt-5 w-full rounded-monk px-4 py-3 text-sm outline-none"
        />

        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Paste readable text..."
          className="surface-input mt-4 h-64 w-full resize-none rounded-monk px-4 py-4 text-sm leading-6 outline-none"
        />

        <div className="mt-5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="fade-smooth rounded-monk px-4 py-2 text-sm text-ink-muted hover:bg-paper-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onImport({ title, content })}
            disabled={importing}
            className="fade-smooth rounded-monk bg-[#5f5e5e] px-5 py-2 text-sm text-[#faf7f6] hover:bg-[#535252] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {importing ? "Processing..." : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
