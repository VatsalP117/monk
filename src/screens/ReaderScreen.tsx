import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageIndicator from "../components/PageIndicator";
import PdfViewer from "../components/PdfViewer";
import ReaderControls from "../components/ReaderControls";
import { useAmbientAudio } from "../hooks/useAmbientAudio";
import { useIdleVisibility } from "../hooks/useIdleVisibility";
import { useAppStore } from "../state/store";
import type { ReaderTheme } from "../types";
import { paginateContent } from "../utils/pagination";

function cycleTheme(current: ReaderTheme): ReaderTheme {
  if (current === "paper") {
    return "sepia";
  }
  if (current === "sepia") {
    return "dark";
  }
  return "paper";
}

export default function ReaderScreen(): JSX.Element {
  const navigate = useNavigate();
  const params = useParams<{ documentId: string }>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(() => window.innerHeight);

  const documents = useAppStore((state) => state.documents);
  const prefs = useAppStore((state) => state.prefs);
  const setPrefs = useAppStore((state) => state.setPrefs);
  const lastSession = useAppStore((state) => state.lastSession);
  const updateReadingSession = useAppStore((state) => state.updateReadingSession);

  const document = useMemo(
    () => documents.find((entry) => entry.id === params.documentId) ?? null,
    [documents, params]
  );
  const documentId = document?.id ?? null;
  const documentContent = document?.content ?? "";
  const documentFormat = document?.format;
  const pageCount = document?.pageCount;

  const pages = useMemo(() => {
    if (!documentContent || documentFormat === "pdf") {
      return [];
    }

    return paginateContent({
      content: documentContent,
      prefs,
      viewportHeight
    });
  }, [documentContent, documentFormat, prefs, viewportHeight]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pdfPage, setPdfPage] = useState(1);
  const timeAnchorRef = useRef(Date.now());

  useEffect(() => {
    timeAnchorRef.current = Date.now();
  }, [documentId]);

  useEffect(() => {
    if (documentFormat === "pdf" && pageCount) {
      const resumedPage = lastSession?.documentId === documentId ? lastSession.currentPage : 1;
      setPdfPage(Math.min(Math.max(resumedPage, 1), pageCount));
    } else {
      const resumedPage =
        lastSession && lastSession.documentId === documentId ? lastSession.currentPage : 1;
      setCurrentPage(Math.min(Math.max(resumedPage, 1), Math.max(1, pages.length)));
    }
  }, [documentId, lastSession, pages.length, documentFormat, pageCount]);

  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const { visible, ping } = useIdleVisibility(prefs.uiIdleMs, settingsOpen);

  useAmbientAudio(prefs.ambientEnabled, prefs.ambientPreset);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    const totalPages = documentFormat === "pdf" ? (pageCount ?? 1) : pages.length;
    const page = documentFormat === "pdf" ? pdfPage : currentPage;

    updateReadingSession({
      documentId,
      currentPage: page,
      totalPages,
      deltaTime: 0
    });
  }, [documentId, documentFormat, pageCount, pages.length, currentPage, pdfPage, updateReadingSession]);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const deltaTime = now - timeAnchorRef.current;
      timeAnchorRef.current = now;

      const totalPages = documentFormat === "pdf" ? (pageCount ?? 1) : pages.length;
      const page = documentFormat === "pdf" ? pdfPage : currentPage;

      updateReadingSession({
        documentId,
        currentPage: page,
        totalPages,
        deltaTime
      });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [documentId, documentFormat, pageCount, pages.length, currentPage, pdfPage, updateReadingSession]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!documentId) {
        return;
      }

      if (documentFormat === "pdf") {
        if (["ArrowRight", "PageDown", "ArrowDown", " "].includes(event.key)) {
          event.preventDefault();
          setPdfPage((p) => Math.min(pageCount ?? 1, p + 1));
          ping();
        }

        if (["ArrowLeft", "PageUp", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          setPdfPage((p) => Math.max(1, p - 1));
          ping();
        }
      } else {
        if (["ArrowRight", "PageDown", "ArrowDown", " "].includes(event.key)) {
          event.preventDefault();
          setCurrentPage((previous) => Math.min(pages.length, previous + 1));
          ping();
        }

        if (["ArrowLeft", "PageUp", "ArrowUp"].includes(event.key)) {
          event.preventDefault();
          setCurrentPage((previous) => Math.max(1, previous - 1));
          ping();
        }
      }

      if (event.key.toLowerCase() === "a") {
        setSettingsOpen((previous) => !previous);
        ping();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [documentId, documentFormat, pageCount, pages.length, ping]);

  if (!document) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <section className="w-full max-w-2xl rounded-monk bg-paper-soft p-8 text-center shadow-monk">
          <h1 className="font-reading text-3xl text-ink">Document not found</h1>
          <p className="mt-3 text-sm text-ink-muted">
            The selected document might have been deleted from your library.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link to="/" className="fade-smooth rounded-monk px-4 py-2 text-sm text-ink-muted hover:bg-paper-strong">
              Home
            </Link>
            <Link
              to="/library"
              className="fade-smooth rounded-monk bg-[#5f5e5e] px-4 py-2 text-sm text-[#faf7f6] hover:bg-[#535252]"
            >
              Open Library
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (documentFormat === "pdf") {
    return (
      <>
        <div onMouseMove={ping}>
          <ReaderControls
            visible={visible}
            settingsOpen={settingsOpen}
            prefs={prefs}
            onBack={() => navigate("/library")}
            onToggleSettings={() => setSettingsOpen((previous) => !previous)}
            onThemeCycle={() => setPrefs({ theme: cycleTheme(prefs.theme) })}
            onAmbientToggle={() => setPrefs({ ambientEnabled: !prefs.ambientEnabled })}
            onPresetChange={(value) => setPrefs({ ambientPreset: value })}
            onFontSizeChange={(value) => setPrefs({ fontSize: value })}
            onLineHeightChange={(value) => setPrefs({ lineHeight: value })}
            onColumnWidthChange={(value) => setPrefs({ columnWidth: value })}
          />
          <PdfViewer
            documentId={document.id}
            currentPage={pdfPage}
            onPageChange={setPdfPage}
            theme={prefs.theme}
          />
        </div>
        <PageIndicator currentPage={pdfPage} totalPages={pageCount ?? 1} visible={visible || settingsOpen} />
      </>
    );
  }

  const content = pages[Math.max(0, currentPage - 1)] ?? "";

  return (
    <main className="min-h-screen px-6 py-16" onMouseMove={ping}>
      <ReaderControls
        visible={visible}
        settingsOpen={settingsOpen}
        prefs={prefs}
        onBack={() => navigate("/library")}
        onToggleSettings={() => setSettingsOpen((previous) => !previous)}
        onThemeCycle={() => setPrefs({ theme: cycleTheme(prefs.theme) })}
        onAmbientToggle={() => setPrefs({ ambientEnabled: !prefs.ambientEnabled })}
        onPresetChange={(value) => setPrefs({ ambientPreset: value })}
        onFontSizeChange={(value) => setPrefs({ fontSize: value })}
        onLineHeightChange={(value) => setPrefs({ lineHeight: value })}
        onColumnWidthChange={(value) => setPrefs({ columnWidth: value })}
      />

      <article
        className="mx-auto rounded-monk px-5 py-9 fade-smooth"
        style={{
          maxWidth: `${prefs.columnWidth}px`,
          fontSize: `${prefs.fontSize}px`,
          lineHeight: prefs.lineHeight
        }}
      >
        <div className="space-y-7 font-reading text-theme-ink">
          {content
            .split(/\n{2,}/)
            .filter(Boolean)
            .map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 40)}`}>{paragraph}</p>
            ))}
        </div>
      </article>

      <PageIndicator currentPage={currentPage} totalPages={pages.length} visible={visible || settingsOpen} />
    </main>
  );
}