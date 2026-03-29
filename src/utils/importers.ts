import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { ImportResult } from "../types";

GlobalWorkerOptions.workerSrc = pdfWorker;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_"
});

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "") || "Untitled";
}

function countWords(content: string): number {
  return content.trim().split(/\s+/).filter(Boolean).length;
}

function ensureArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function normalizePath(path: string): string {
  const parts = path.split("/");
  const stack: string[] = [];

  parts.forEach((part) => {
    if (!part || part === ".") {
      return;
    }
    if (part === "..") {
      stack.pop();
      return;
    }
    stack.push(part);
  });

  return stack.join("/");
}

function resolveRelativePath(basePath: string, relativePath: string): string {
  const baseSegments = basePath.split("/");
  baseSegments.pop();
  return normalizePath(`${baseSegments.join("/")}/${relativePath}`);
}

function htmlToText(html: string): string {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  document.querySelectorAll("script,style,noscript").forEach((entry) => entry.remove());
  const content = document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
  return content;
}

interface PdfToken {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  index: number;
}

interface PdfLine {
  y: number;
  averageHeight: number;
  tokens: PdfToken[];
}

function normalizeTokenText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function groupPdfLines(tokens: PdfToken[]): PdfLine[] {
  const lines: PdfLine[] = [];

  tokens.forEach((token) => {
    const tolerance = Math.max(2, token.height * 0.45);
    const lastLine = lines[lines.length - 1];

    if (lastLine && Math.abs(lastLine.y - token.y) <= tolerance) {
      const count = lastLine.tokens.length;
      lastLine.tokens.push(token);
      lastLine.y = (lastLine.y * count + token.y) / (count + 1);
      lastLine.averageHeight = (lastLine.averageHeight * count + token.height) / (count + 1);
      return;
    }

    lines.push({
      y: token.y,
      averageHeight: token.height,
      tokens: [token]
    });
  });

  return lines;
}

function buildPdfLineText(tokens: PdfToken[]): string {
  let output = "";
  let previous: PdfToken | null = null;

  tokens.forEach((token) => {
    const text = normalizeTokenText(token.text);
    if (!text) {
      return;
    }

    if (!output) {
      output = text;
      previous = token;
      return;
    }

    const joinsHyphen = output.endsWith("-") && /^[a-z]/.test(text);
    if (joinsHyphen) {
      output = `${output.slice(0, -1)}${text}`;
      previous = token;
      return;
    }

    const previousRight = previous ? previous.x + previous.width : token.x;
    const gap = token.x - previousRight;
    const baseHeight = Math.max(token.height, previous?.height ?? token.height);
    const spacingThreshold = Math.max(1.5, Math.min(10, baseHeight * 0.2));
    const avoidLeadingSpace = /^[,.;:!?%)\]}]/.test(text);

    if (gap > spacingThreshold && !avoidLeadingSpace) {
      output += " ";
    }

    output += text;
    previous = token;
  });

  return output.trim();
}

function isCodeLikeLine(text: string, averageHeight: number): boolean {
  if (averageHeight > 9.25) {
    return false;
  }

  return (
    /[{}()[\]=:+]/.test(text) ||
    /^\.\/\S+/.test(text) ||
    /^(func|const|var|package|import|type)\b/.test(text) ||
    /^\w+\s*:=/.test(text) ||
    /^\w+\s+\w+\s*=/.test(text)
  );
}

function isFooterLine(text: string, y: number, pageHeight: number): boolean {
  const footerCutoff = Math.max(40, pageHeight * 0.1);
  if (y > footerCutoff) {
    return false;
  }

  const normalized = text.replace(/\s+/g, " ").trim();
  return (
    /^\d+$/.test(normalized) ||
    /^\d+\s*\|\s*chapter\b/i.test(normalized) ||
    /^chapter\s+\d+/i.test(normalized)
  );
}

function mergePdfLines(lines: PdfLine[], pageHeight: number): string {
  const rendered = lines
    .map((line) => ({
      ...line,
      minX: Math.min(...line.tokens.map((token) => token.x)),
      text: buildPdfLineText(
        [...line.tokens].sort((left, right) => {
          if (Math.abs(left.x - right.x) > 1) {
            return left.x - right.x;
          }
          return left.index - right.index;
        })
      )
    }))
    .filter((line) => line.text.length > 0)
    .filter((line) => !isFooterLine(line.text, line.y, pageHeight));

  if (rendered.length === 0) {
    return "";
  }

  let codeBaseX: number | null = null;
  const formatLineText = (text: string, minX: number, isCode: boolean): string => {
    if (!isCode) {
      codeBaseX = null;
      return text;
    }

    if (codeBaseX === null || minX < codeBaseX) {
      codeBaseX = minX;
    }

    const indentLevel = Math.max(0, Math.min(8, Math.round((minX - codeBaseX) / 14)));
    return `${"  ".repeat(indentLevel)}${text}`;
  };

  const firstIsCode = isCodeLikeLine(rendered[0].text, rendered[0].averageHeight);
  let output = formatLineText(rendered[0].text, rendered[0].minX, firstIsCode);

  for (let index = 1; index < rendered.length; index += 1) {
    const previous = rendered[index - 1];
    const current = rendered[index];
    const previousIsCode = isCodeLikeLine(previous.text, previous.averageHeight);
    const currentIsCode = isCodeLikeLine(current.text, current.averageHeight);
    const currentText = formatLineText(current.text, current.minX, currentIsCode);

    const verticalGap = previous.y - current.y;
    const baseline = Math.max(8, Math.max(previous.averageHeight, current.averageHeight));
    const largeGap = verticalGap > baseline * 1.9;
    const startsList = /^([\-*•]|\d+[.)])\s/.test(current.text);
    const indentationJump = Math.abs(current.minX - previous.minX) >= 26;

    if (previousIsCode && currentIsCode) {
      output += "\n";
    } else if (previousIsCode !== currentIsCode) {
      output += "\n\n";
    } else if (largeGap) {
      output += "\n\n";
    } else if (startsList || indentationJump) {
      output += "\n";
    } else {
      output += " ";
    }

    output += currentText;
  }

  return output.replace(/[ \t]+\n/g, "\n").trim();
}

function extractPdfPageText(textContent: { items: unknown[] }, pageHeight: number): string {
  const tokens: PdfToken[] = textContent.items
    .map((item, index) => {
      if (!item || typeof item !== "object" || !("str" in item) || typeof item.str !== "string") {
        return null;
      }

      const source = item as {
        str: string;
        transform?: number[];
        width?: number;
        height?: number;
      };

      const x = Array.isArray(source.transform) ? Number(source.transform[4] ?? 0) : 0;
      const y = Array.isArray(source.transform) ? Number(source.transform[5] ?? 0) : 0;
      const width = typeof source.width === "number" ? source.width : 0;
      const height = typeof source.height === "number" ? Math.abs(source.height) : 0;

      return {
        text: source.str,
        x,
        y,
        width,
        height,
        index
      } satisfies PdfToken;
    })
    .filter((item): item is PdfToken => item !== null)
    .sort((left, right) => {
      const yDelta = right.y - left.y;
      if (Math.abs(yDelta) > 2) {
        return yDelta;
      }

      const xDelta = left.x - right.x;
      if (Math.abs(xDelta) > 1) {
        return xDelta;
      }

      return left.index - right.index;
    });

  return mergePdfLines(groupPdfLines(tokens), pageHeight);
}

async function importTxtOrMd(file: File): Promise<ImportResult> {
  const content = (await file.text()).trim();
  return {
    title: stripExtension(file.name),
    content,
    format: file.name.toLowerCase().endsWith(".md") ? "md" : "txt"
  };
}

async function importPdf(file: File): Promise<ImportResult> {
  const source = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data: source }).promise;
  const pages: string[] = [];

  for (let index = 1; index <= pdf.numPages; index += 1) {
    const page = await pdf.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    const text = await page.getTextContent();
    const entries = extractPdfPageText(text, viewport.height);

    if (entries) {
      pages.push(entries);
    }
  }

  return {
    title: stripExtension(file.name),
    content: pages.join("\n\n"),
    format: "pdf"
  };
}

async function importEpub(file: File): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");

  if (!containerXml) {
    throw new Error("Invalid EPUB: missing container.xml");
  }

  const containerData = xmlParser.parse(containerXml);
  const rootFiles = ensureArray(containerData?.container?.rootfiles?.rootfile);
  const packagePath = rootFiles[0]?.["@_full-path"] as string | undefined;

  if (!packagePath) {
    throw new Error("Invalid EPUB: missing package path");
  }

  const packageXml = await zip.file(packagePath)?.async("string");
  if (!packageXml) {
    throw new Error("Invalid EPUB: missing OPF package");
  }

  const packageData = xmlParser.parse(packageXml)?.package;
  const metadataTitle = packageData?.metadata?.["dc:title"];
  const title = typeof metadataTitle === "string" ? metadataTitle : stripExtension(file.name);

  const manifestItems = ensureArray(packageData?.manifest?.item) as Array<Record<string, string>>;
  const manifest = new Map(
    manifestItems.map((item) => [item["@_id"], { href: item["@_href"], type: item["@_media-type"] }])
  );

  const orderedSpine = ensureArray(packageData?.spine?.itemref) as Array<Record<string, string>>;
  const extractedSections: string[] = [];

  for (const itemRef of orderedSpine) {
    const entry = manifest.get(itemRef["@_idref"]);
    if (!entry || !(entry.type.includes("xhtml") || entry.type.includes("html"))) {
      continue;
    }

    const sectionPath = resolveRelativePath(packagePath, entry.href);
    const sectionHtml = await zip.file(sectionPath)?.async("string");

    if (!sectionHtml) {
      continue;
    }

    const text = htmlToText(sectionHtml);
    if (text) {
      extractedSections.push(text);
    }
  }

  return {
    title,
    content: extractedSections.join("\n\n"),
    format: "epub"
  };
}

export async function importFromFile(file: File): Promise<ImportResult> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return importTxtOrMd(file);
  }

  if (lowerName.endsWith(".pdf")) {
    return importPdf(file);
  }

  if (lowerName.endsWith(".epub")) {
    return importEpub(file);
  }

  throw new Error("Unsupported file type. Use TXT, MD, PDF, or EPUB.");
}

export function importFromPastedText(payload: { title: string; content: string }): ImportResult {
  return {
    title: payload.title.trim() || "Pasted Document",
    content: payload.content.trim(),
    format: "paste"
  };
}

export function getWordCount(content: string): number {
  return countWords(content);
}
