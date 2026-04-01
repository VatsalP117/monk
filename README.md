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
- `.epub`
- `.pdf` (via `monk-pdf-extract` service)
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

If you want PDF import in development, also run the extraction service:

```bash
cd ../monk-pdf-extract
uvicorn server:app --reload --host 0.0.0.0 --port 7788
```

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
If parser behavior changes, re-import the source file to evaluate new parsing output.

## Known Constraints

- Reader pagination is character/viewport heuristic-based and can shift with typography settings.
- PDF import requires the extraction service to be reachable at `VITE_PDF_EXTRACT_URL` (defaults to `http://localhost:7788`).

## Suggested Next Work

- Integrate external PDF-to-markdown service in the import pipeline.
- Add parser failure handling and retry UX for external PDF jobs.
- Persist source metadata for imported markdown to support re-sync/update workflows.
