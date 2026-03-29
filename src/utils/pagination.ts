import type { ReaderPreferences } from "../types";

interface PaginationInput {
  content: string;
  prefs: Pick<ReaderPreferences, "fontSize" | "lineHeight" | "columnWidth">;
  viewportHeight: number;
}

function estimateCharactersPerPage(input: PaginationInput): number {
  const charsPerLine = Math.max(35, Math.floor(input.prefs.columnWidth / (input.prefs.fontSize * 0.56)));
  const usableHeight = Math.max(380, input.viewportHeight - 190);
  const linesPerPage = Math.max(14, Math.floor(usableHeight / (input.prefs.fontSize * input.prefs.lineHeight)));
  return Math.max(900, Math.floor(charsPerLine * linesPerPage * 0.92));
}

export function paginateContent(input: PaginationInput): string[] {
  const trimmed = input.content.trim();
  if (!trimmed) {
    return [""];
  }

  const maxChars = estimateCharactersPerPage(input);
  const paragraphs = trimmed
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const pages: string[] = [];
  let current = "";

  paragraphs.forEach((paragraph) => {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars) {
      current = candidate;
      return;
    }

    if (current) {
      pages.push(current);
      current = "";
    }

    if (paragraph.length <= maxChars) {
      current = paragraph;
      return;
    }

    const words = paragraph.split(/\s+/);
    let chunk = "";
    words.forEach((word) => {
      const nextChunk = chunk ? `${chunk} ${word}` : word;
      if (nextChunk.length > maxChars) {
        pages.push(chunk);
        chunk = word;
      } else {
        chunk = nextChunk;
      }
    });

    current = chunk;
  });

  if (current) {
    pages.push(current);
  }

  return pages.length > 0 ? pages : [trimmed];
}

export function estimateRemainingMinutes(wordCount: number, progress: number): number {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const remainingWords = Math.max(0, Math.round(wordCount * (1 - clampedProgress)));
  const wordsPerMinute = 220;
  return Math.max(1, Math.ceil(remainingWords / wordsPerMinute));
}
