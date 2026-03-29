import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DocumentListItem from "../components/DocumentListItem";
import ImportDropzone from "../components/ImportDropzone";
import PasteSheet from "../components/PasteSheet";
import { useImportDocument } from "../hooks/useImportDocument";
import { useAppStore } from "../state/store";

export default function LibraryScreen(): JSX.Element {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const documents = useAppStore((state) => state.documents);
  const deleteDocument = useAppStore((state) => state.deleteDocument);
  const importing = useAppStore((state) => state.importing);
  const importError = useAppStore((state) => state.importError);
  const { importFile, importPasted } = useImportDocument();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return documents;
    }

    return documents.filter((entry) => entry.title.toLowerCase().includes(normalized));
  }, [documents, query]);

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-ink-muted">Monk</p>
            <h1 className="mt-3 font-reading text-5xl text-ink">Library</h1>
          </div>
          <Link
            to="/"
            className="fade-smooth rounded-monk px-4 py-2 text-sm text-ink-muted hover:bg-paper-soft"
          >
            Back Home
          </Link>
        </header>

        <div className="mt-8 rounded-monk bg-paper-soft p-5">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title"
            className="w-full rounded-monk bg-[#ffffffb8] px-4 py-3 text-sm text-ink outline-none ring-1 ring-[#d9d4c2] focus:ring-[#8a8a8a]"
          />
        </div>

        <div className="mt-6">
          <ImportDropzone
            importing={importing}
            title="Add to Library"
            subtitle="Import documents directly into your shelf."
            onFileSelected={importFile}
          />
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setPasteOpen(true)}
            className="fade-smooth rounded-monk px-4 py-2 text-sm text-ink-muted hover:bg-paper-soft"
          >
            Paste Content
          </button>
        </div>

        {importError ? <p className="mt-4 text-sm text-[#742410]">{importError}</p> : null}

        {filtered.length === 0 ? (
          <div className="mt-10 rounded-monk bg-paper-soft p-8 text-center text-sm text-ink-muted">
            No documents yet. Import one to start reading.
          </div>
        ) : (
          <section className="mt-8 space-y-4">
            {filtered.map((document) => (
              <DocumentListItem
                key={document.id}
                document={document}
                onOpen={(documentId) => navigate(`/reader/${documentId}`)}
                onDelete={deleteDocument}
              />
            ))}
          </section>
        )}
      </div>

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
