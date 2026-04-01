export type DocumentFormat = "txt" | "md" | "epub" | "paste" | "pdf";

export type ReaderTheme = "paper" | "sepia" | "dark";

export type AmbientPreset = "rain" | "cafe" | "white";

export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  format: DocumentFormat;
  markdownPages?: string[];
  sourceMeta?: DocumentSourceMeta;
  progress: number;
  lastOpenedAt: string;
  createdAt: string;
  wordCount: number;
}

export interface PdfImportStats {
  pageCount: number;
  processingTimeS?: number;
  llmProvider?: string;
  llmCleaned?: number;
  llmFailed?: number;
  badPages?: number;
  goodPages?: number;
  locallyRefined?: number;
}

export interface DocumentSourceMeta {
  originalFileName?: string;
  fileSizeBytes?: number;
  importedAt?: string;
  warnings?: string[];
  pdf?: PdfImportStats;
}

export interface ReadingSession {
  documentId: string;
  currentPage: number;
  totalPages: number;
  timeSpent: number;
  lastReadAt: string;
}

export interface ReaderPreferences {
  theme: ReaderTheme;
  fontSize: number;
  lineHeight: number;
  columnWidth: number;
  ambientEnabled: boolean;
  ambientPreset: AmbientPreset;
  uiIdleMs: number;
}

export interface AppState {
  documents: DocumentRecord[];
  lastSession: ReadingSession | null;
  prefs: ReaderPreferences;
  importing: boolean;
  importError: string | null;
  importStatus: string | null;
  importWarning: string | null;
  addDocument: (document: Omit<DocumentRecord, "id" | "createdAt" | "lastOpenedAt" | "progress">) => DocumentRecord;
  deleteDocument: (documentId: string) => void;
  setImporting: (value: boolean) => void;
  setImportError: (value: string | null) => void;
  setImportStatus: (value: string | null) => void;
  setImportWarning: (value: string | null) => void;
  setPrefs: (patch: Partial<ReaderPreferences>) => void;
  updateReadingSession: (payload: {
    documentId: string;
    currentPage: number;
    totalPages: number;
    deltaTime: number;
  }) => void;
}

export interface ImportResult {
  title: string;
  content: string;
  format: DocumentFormat;
  wordCount?: number;
  markdownPages?: string[];
  sourceMeta?: DocumentSourceMeta;
  warning?: string | null;
}
