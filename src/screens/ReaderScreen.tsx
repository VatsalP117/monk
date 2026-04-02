import { useEffect, useMemo, useRef, useState } from "react";
import { defaultSchema } from "hast-util-sanitize";
import rehypeSanitize from "rehype-sanitize";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageIndicator from "../components/PageIndicator";
import ReaderControls from "../components/ReaderControls";
import { useAmbientAudio } from "../hooks/useAmbientAudio";
import { useIdleVisibility } from "../hooks/useIdleVisibility";
import { useAppStore } from "../state/store";
import type { ReaderTheme } from "../types";
import { paginateContent } from "../utils/pagination";

function normalizeMarkdownPages(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
}

const markdownSanitizeSchema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: Array.from(new Set([...(defaultSchema.protocols?.src ?? ["http", "https"]), "data"]))
  }
};

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
  const documentMarkdownPages = useMemo(
    () => normalizeMarkdownPages(document?.markdownPages),
    [document?.markdownPages]
  );

  const pages = useMemo(() => {
    if (!document) {
      return [];
    }

    if (document.format === "pdf" && documentMarkdownPages.length > 0) {
      return documentMarkdownPages;
    }

    return paginateContent({
      content: documentContent,
      prefs,
      viewportHeight
    });
  }, [document, documentContent, documentMarkdownPages, prefs, viewportHeight]);

  const [currentPage, setCurrentPage] = useState(1);
  const timeAnchorRef = useRef(Date.now());

  useEffect(() => {
    timeAnchorRef.current = Date.now();
  }, [documentId]);

  useEffect(() => {
    const resumedPage =
      lastSession && lastSession.documentId === documentId ? lastSession.currentPage : 1;
    setCurrentPage(Math.min(Math.max(resumedPage, 1), Math.max(1, pages.length)));
  }, [documentId, lastSession, pages.length]);

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

    const totalPages = Math.max(1, pages.length);

    updateReadingSession({
      documentId,
      currentPage,
      totalPages,
      deltaTime: 0
    });
  }, [documentId, pages.length, currentPage, updateReadingSession]);

  useEffect(() => {
    if (!documentId) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const now = Date.now();
      const deltaTime = now - timeAnchorRef.current;
      timeAnchorRef.current = now;

      const totalPages = Math.max(1, pages.length);

      updateReadingSession({
        documentId,
        currentPage,
        totalPages,
        deltaTime
      });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [documentId, pages.length, currentPage, updateReadingSession]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!documentId) {
        return;
      }

      const totalPages = Math.max(1, pages.length);

      if (["ArrowRight", "PageDown", "ArrowDown", " "].includes(event.key)) {
        event.preventDefault();
        setCurrentPage((previous) => Math.min(totalPages, previous + 1));
        ping();
      }

      if (["ArrowLeft", "PageUp", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        setCurrentPage((previous) => Math.max(1, previous - 1));
        ping();
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
  }, [documentId, pages.length, ping]);

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

  const content = pages[Math.max(0, currentPage - 1)] ?? "";
  const hasVisibleContent = content.trim().length > 0;

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
        <div className="prose-monk font-reading text-theme-ink">
          {hasVisibleContent ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeSanitize, markdownSanitizeSchema]]}
            >
              {content}
            </ReactMarkdown>
          ) : (
            <p className="text-sm text-ink-muted">No readable content on this page.</p>
          )}
        </div>
      </article>

      <PageIndicator
        currentPage={currentPage}
        totalPages={Math.max(1, pages.length)}
        visible={true}
      />
    </main>
  );
}
