import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ImportDropzone from "../components/ImportDropzone";
import PasteSheet from "../components/PasteSheet";
import { useImportDocument } from "../hooks/useImportDocument";
import { useAppStore } from "../state/store";
import { estimateRemainingMinutes } from "../utils/pagination";

export default function LandingScreen(): JSX.Element {
  const navigate = useNavigate();
  const [pasteOpen, setPasteOpen] = useState(false);
  const documents = useAppStore((state) => state.documents);
  const lastSession = useAppStore((state) => state.lastSession);
  const importing = useAppStore((state) => state.importing);
  const importError = useAppStore((state) => state.importError);
  const importStatus = useAppStore((state) => state.importStatus);
  const importWarning = useAppStore((state) => state.importWarning);
  const { importFile, importPasted } = useImportDocument();

  const lastDocument = useMemo(
    () => documents.find((entry) => entry.id === lastSession?.documentId) ?? null,
    [documents, lastSession?.documentId]
  );

  if (lastDocument) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="w-full max-w-3xl rounded-monk bg-paper-soft p-10 shadow-monk">
          <p className="text-xs uppercase tracking-[0.22em] text-ink-muted">Monk</p>
          <h1 className="mt-4 font-reading text-5xl leading-tight text-ink">Continue Reading</h1>
          <h2 className="mt-6 font-reading text-3xl text-ink">{lastDocument.title}</h2>

          <div className="mt-4 flex flex-wrap gap-3 text-xs uppercase tracking-[0.14em] text-ink-muted">
            <span>{Math.round(lastDocument.progress * 100)}% complete</span>
            <span>{estimateRemainingMinutes(lastDocument.wordCount, lastDocument.progress)} min left</span>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(`/reader/${lastDocument.id}`)}
              className="fade-smooth rounded-monk bg-[#5f5e5e] px-6 py-3 text-sm text-[#faf7f6] hover:bg-[#535252]"
            >
              Resume →
            </button>
            <Link
              to="/library"
              className="fade-smooth rounded-monk px-5 py-3 text-sm text-ink-muted hover:bg-paper-strong"
            >
              Library
            </Link>
            <button
              type="button"
              onClick={() => setPasteOpen(true)}
              className="fade-smooth rounded-monk px-5 py-3 text-sm text-ink-muted hover:bg-paper-strong"
            >
              Paste Content
            </button>
          </div>

          <div className="mt-10">
            <ImportDropzone
              importing={importing}
              title="Import Another Document"
              subtitle="Drag and drop files here, or choose one manually."
              onFileSelected={importFile}
            />
          </div>

          {importError ? <p className="mt-4 text-sm text-[#742410]">{importError}</p> : null}
          {importWarning ? <p className="mt-3 text-sm text-ink-muted">{importWarning}</p> : null}
          {importing && importStatus ? <p className="mt-3 text-sm text-ink-muted">{importStatus}</p> : null}
        </section>

        <PasteSheet
          open={pasteOpen}
          importing={importing}
          onClose={() => setPasteOpen(false)}
          onImport={async (payload) => {
            await importPasted(payload);
            setPasteOpen(false);
          }}
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-3xl text-center">
        <p className="text-xs uppercase tracking-[0.22em] text-ink-muted">Monk</p>
        <h1 className="mt-5 font-reading text-7xl leading-none text-ink">Monk</h1>
        <p className="mt-4 text-sm uppercase tracking-[0.18em] text-ink-muted">calm reading space</p>

        <div className="mt-12">
          <ImportDropzone
            importing={importing}
            title="Start Reading"
            subtitle="Drop a file into Monk or choose one to begin a focused reading session."
            onFileSelected={importFile}
          />
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Link
            to="/library"
            className="fade-smooth rounded-monk px-5 py-2.5 text-sm text-ink-muted hover:bg-paper-soft"
          >
            Open Library
          </Link>
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="fade-smooth rounded-monk px-5 py-2.5 text-sm text-ink-muted hover:bg-paper-soft"
          >
            Paste Content
          </button>
        </div>

        {importError ? <p className="mt-4 text-sm text-[#742410]">{importError}</p> : null}
        {importWarning ? <p className="mt-3 text-sm text-ink-muted">{importWarning}</p> : null}
        {importing && importStatus ? <p className="mt-3 text-sm text-ink-muted">{importStatus}</p> : null}
      </section>

      <PasteSheet
        open={pasteOpen}
        importing={importing}
        onClose={() => setPasteOpen(false)}
        onImport={async (payload) => {
          await importPasted(payload);
          setPasteOpen(false);
        }}
      />
    </main>
  );
}
