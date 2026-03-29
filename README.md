# Monk

Monk is a calm reading application built for focused long-form reading on desktop.
It runs as a web app (React + Vite) and as a macOS desktop app (Tauri).

## What It Does

Monk keeps the product surface intentionally small:

- Start from an empty state (`Start Reading`) with direct file import.
- Continue from the last active document (`Continue Reading`).
- Browse a simple library list with progress and recency.
- Read in a typography-first, paginated reader.

Supported import formats (current):

- `.txt`
- `.md`
- `.pdf`
- `.epub`
- pasted text

## Core Features

### Landing
- Two modes:
  - first-use empty state
  - continue-reading state from last session
- Direct file picker CTA
- Drag and drop import
- Paste text import

### Library
- Minimal list layout (not dashboard-style grid)
- Search by title
- Progress indicator per item
- Last-opened metadata
- Confirm-before-delete behavior

### Reader
- Paginated reading (not infinite scroll)
- Keyboard navigation (`ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`, `Space`)
- Auto-hiding chrome based on idle interaction
- Reader controls:
  - back
  - typography panel (`Aa`)
  - theme cycle (`Paper`, `Sepia`, `Dark`)
  - ambient sound (`Rain`, `Cafe`, `White Noise`)
- Session tracking:
  - page progress
  - total pages
  - cumulative time spent

## Technical Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Zustand (with persistence)
- Tauri 2 (desktop shell)
- `pdfjs-dist` for PDF extraction
- `jszip` + `fast-xml-parser` for EPUB extraction

## Architecture Overview

### UI and Routing

- `src/App.tsx`
- `src/screens/LandingScreen.tsx`
- `src/screens/LibraryScreen.tsx`
- `src/screens/ReaderScreen.tsx`

Routes:

- `/` landing
- `/library` library
- `/reader/:documentId` reader

### State Model

Global app state is in `src/state/store.ts`.

Key entities:

- `DocumentRecord`
  - `id`, `title`, `content`, `format`, `progress`, `lastOpenedAt`, `createdAt`, `wordCount`
- `ReadingSession`
  - `documentId`, `currentPage`, `totalPages`, `timeSpent`, `lastReadAt`
- `ReaderPreferences`
  - theme, typography, ambient settings, idle timeout

Persistence:

- Zustand `persist` middleware (`monk-store-v1`) stores documents, last session, and reader prefs.

### Import Pipeline

- Entry point: `src/utils/importers.ts`
- TXT/MD: plain text read
- EPUB: unzip + OPF/spine parsing + HTML to text extraction
- PDF: delegated to dedicated PDF module (`src/utils/pdf`)

## PDF Subsystem (Separated for Iteration)

PDF logic is intentionally isolated to make debugging and feature work easier.

- `src/utils/pdf/importPdf.ts`
  - loads document with `pdfjs-dist`
  - iterates pages
  - calls page extractor
- `src/utils/pdf/extractPageText.ts`
  - tokenization from PDF text items
  - line grouping by vertical proximity
  - in-line spacing reconstruction by x-position deltas
  - code-line detection and indentation preservation
  - footer filtering (page-number/chapter footer noise)
  - paragraph and block merge heuristics
- `src/utils/pdf/types.ts`
  - PDF-specific token/line contracts

This split is the right place to add upcoming PDF work, such as:

- header/footer templates per publisher
- two-column detection
- table-aware extraction
- per-book parsing profiles
- extraction diagnostics and debug traces

## Project Layout

```text
src/
  components/
  hooks/
  screens/
  state/
  styles/
  utils/
    importers.ts
    pagination.ts
    date.ts
    pdf/
      importPdf.ts
      extractPageText.ts
      types.ts
src-tauri/
  src/
  tauri.conf.json
```

## Running Locally

### Prerequisites

Web only:

- Node.js (current project has been tested with Node 24.x)

Desktop (Tauri):

- Rust toolchain (`rustup`, `cargo`, `rustc`)
- macOS build tools (Xcode Command Line Tools)
- for full app signing/distribution workflows, full Xcode install is recommended

### Install

```bash
npm install
```

### Web Debug Mode

```bash
npm run dev
```

Web app URL:

- `http://localhost:1420/`

### Desktop Debug Mode (Tauri)

```bash
npm run tauri:dev
```

This command starts Vite and launches the desktop window.

### Production Build (Web)

```bash
npm run build
```

### Production Build (Desktop Bundles)

```bash
npm run tauri:build
```

Expected macOS output:

- `src-tauri/target/release/bundle/macos/Monk.app`
- `src-tauri/target/release/bundle/dmg/Monk_0.1.0_aarch64.dmg`

## Notes for Testing Import Changes

Imported document content is stored in app state.
If parser behavior changes (especially PDF), re-import the source file to evaluate new parsing output.

## Known Constraints

- PDF extraction uses heuristics; complex layouts (multi-column, dense tables, heavy scans) still need targeted handling.
- Reader pagination is character/viewport heuristic-based and can shift with typography settings.
- Bundle size is currently large due to PDF worker inclusion.

## Suggested Next Work

- Add PDF debug mode with page-level extraction snapshots.
- Add layout-classifier stage before merge heuristics.
- Add per-document parser metadata to avoid full reparse when only reader settings change.
- Move parser constants to a config object and expose safe tuning toggles in development.
