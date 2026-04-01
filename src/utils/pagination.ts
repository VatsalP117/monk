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

function splitIntoReadableBlocks(content: string): string[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const blocks: string[] = [];
  let current: string[] = [];
  let inCodeFence = false;

  const flushCurrent = () => {
    const block = current.join("\n").trim();
    if (block) {
      blocks.push(block);
    }
    current = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      current.push(line);
      return;
    }

    if (!inCodeFence && trimmed.length === 0) {
      flushCurrent();
      return;
    }

    current.push(line);
  });

  flushCurrent();
  return blocks.length > 0 ? blocks : [normalized.trim()];
}

export function paginateContent(input: PaginationInput): string[] {
  const trimmed = input.content.trim();
  if (!trimmed) {
    return [""];
  }

  const maxChars = estimateCharactersPerPage(input);
  const blocks = splitIntoReadableBlocks(trimmed);
  const pages: string[] = [];
  let currentBlocks: string[] = [];
  let currentLength = 0;

  blocks.forEach((block) => {
    const nextLength = currentLength > 0 ? currentLength + 2 + block.length : block.length;
    if (nextLength <= maxChars) {
      currentBlocks.push(block);
      currentLength = nextLength;
      return;
    }

    if (currentBlocks.length > 0) {
      pages.push(currentBlocks.join("\n\n"));
      currentBlocks = [];
      currentLength = 0;
    }

    if (block.length > maxChars) {
      pages.push(block);
      return;
    }

    currentBlocks = [block];
    currentLength = block.length;
  });

  if (currentBlocks.length > 0) {
    pages.push(currentBlocks.join("\n\n"));
  }

  return pages.length > 0 ? pages : [trimmed];
}

export function estimateRemainingMinutes(wordCount: number, progress: number): number {
  const clampedProgress = Math.min(1, Math.max(0, progress));
  const remainingWords = Math.max(0, Math.round(wordCount * (1 - clampedProgress)));
  const wordsPerMinute = 220;
  return Math.max(1, Math.ceil(remainingWords / wordsPerMinute));
}
