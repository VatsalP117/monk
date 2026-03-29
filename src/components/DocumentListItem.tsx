import { useState } from "react";
import { formatLastOpened } from "../utils/date";
import { estimateRemainingMinutes } from "../utils/pagination";
import type { DocumentRecord } from "../types";

interface DocumentListItemProps {
  document: DocumentRecord;
  onOpen: (documentId: string) => void;
  onDelete: (documentId: string) => void;
}

export default function DocumentListItem({
  document,
  onOpen,
  onDelete
}: DocumentListItemProps): JSX.Element {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const remaining = estimateRemainingMinutes(document.wordCount, document.progress);

  return (
    <article className="fade-smooth rounded-monk bg-paper-soft p-5 hover:bg-paper-strong/75">
      <button
        type="button"
        onClick={() => onOpen(document.id)}
        className="w-full cursor-pointer text-left"
      >
        <h3 className="font-reading text-[1.35rem] text-ink">{document.title}</h3>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.12em] text-ink-muted">
          <span>{Math.round(document.progress * 100)}% complete</span>
          <span>{remaining} min left</span>
          <span>{formatLastOpened(document.lastOpenedAt)}</span>
        </div>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#dfd9c8]">
          <div
            className="h-full rounded-full bg-[#66645d]"
            style={{ width: `${Math.round(document.progress * 100)}%` }}
          />
        </div>
      </button>

      <div className="mt-4 flex justify-end">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="fade-smooth rounded-monk px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-ink-muted hover:bg-[#e7e3cc]"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="fade-smooth rounded-monk px-3 py-1.5 text-ink-muted hover:bg-[#e7e3cc]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onDelete(document.id)}
              className="fade-smooth rounded-monk bg-[#a54731] px-3 py-1.5 text-[#ffffff] hover:bg-[#8e3c29]"
            >
              Confirm Delete
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
