import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppState, DocumentRecord, ReaderPreferences } from "../types";

const DEFAULT_PREFS: ReaderPreferences = {
  theme: "paper",
  fontSize: 20,
  lineHeight: 1.7,
  columnWidth: 640,
  ambientEnabled: false,
  ambientPreset: "rain",
  uiIdleMs: 3000
};

function sortByLastOpened(documents: DocumentRecord[]): DocumentRecord[] {
  return [...documents].sort(
    (left, right) => new Date(right.lastOpenedAt).getTime() - new Date(left.lastOpenedAt).getTime()
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      documents: [],
      lastSession: null,
      prefs: DEFAULT_PREFS,
      importing: false,
      importError: null,
      importStatus: null,
      importWarning: null,
      addDocument: (document) => {
        const now = new Date().toISOString();
        const created: DocumentRecord = {
          id: crypto.randomUUID(),
          title: document.title,
          content: document.content,
          format: document.format,
          markdownPages: document.markdownPages,
          sourceMeta: document.sourceMeta,
          wordCount: document.wordCount,
          progress: 0,
          createdAt: now,
          lastOpenedAt: now
        };

        set((state) => ({
          documents: sortByLastOpened([created, ...state.documents]),
          lastSession: {
            documentId: created.id,
            currentPage: 1,
            totalPages: 1,
            timeSpent: 0,
            lastReadAt: now
          }
        }));

        return created;
      },
      deleteDocument: (documentId) => {
        set((state) => {
          const nextDocuments = state.documents.filter((item) => item.id !== documentId);
          const lastSession = state.lastSession?.documentId === documentId ? null : state.lastSession;

          return {
            documents: sortByLastOpened(nextDocuments),
            lastSession
          };
        });
      },
      setImporting: (value) => {
        set({ importing: value });
      },
      setImportError: (value) => {
        set({ importError: value });
      },
      setImportStatus: (value) => {
        set({ importStatus: value });
      },
      setImportWarning: (value) => {
        set({ importWarning: value });
      },
      setPrefs: (patch) => {
        set((state) => ({ prefs: { ...state.prefs, ...patch } }));
      },
      updateReadingSession: ({ documentId, currentPage, totalPages, deltaTime }) => {
        set((state) => {
          const elapsed = Math.max(0, deltaTime);
          const existingSession = state.lastSession;
          const sameSession =
            existingSession?.documentId === documentId &&
            existingSession.currentPage === currentPage &&
            existingSession.totalPages === totalPages;

          if (sameSession && elapsed === 0) {
            return state;
          }

          const now = new Date().toISOString();
          const nextProgress = totalPages > 0 ? Math.min(1, Math.max(0, currentPage / totalPages)) : 0;

          let touched = false;
          const mapped = state.documents.map((item) => {
            if (item.id !== documentId) {
              return item;
            }

            touched = true;
            return {
              ...item,
              progress: totalPages > 0 ? nextProgress : item.progress,
              lastOpenedAt: now
            };
          });

          return {
            documents: touched ? sortByLastOpened(mapped) : state.documents,
            lastSession: {
              documentId,
              currentPage,
              totalPages,
              timeSpent:
                (existingSession?.documentId === documentId ? existingSession.timeSpent : 0) + elapsed,
              lastReadAt: now
            }
          };
        });
      }
    }),
    {
      name: "monk-store-v1",
      partialize: (state) => ({
        documents: state.documents,
        lastSession: state.lastSession,
        prefs: state.prefs
      })
    }
  )
);
