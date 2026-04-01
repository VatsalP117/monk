import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import type { ImportResult } from "../types";
import { importPdfWithService } from "./pdfExtractClient";

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

async function importTxtOrMd(file: File): Promise<ImportResult> {
  const content = (await file.text()).trim();
  return {
    title: stripExtension(file.name),
    content,
    format: file.name.toLowerCase().endsWith(".md") ? "md" : "txt"
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

export interface FileImportOptions {
  signal?: AbortSignal;
  onStatus?: (status: string) => void;
}

export async function importFromFile(file: File, options?: FileImportOptions): Promise<ImportResult> {
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith(".txt") || lowerName.endsWith(".md")) {
    return importTxtOrMd(file);
  }

  if (lowerName.endsWith(".epub")) {
    return importEpub(file);
  }

  if (lowerName.endsWith(".pdf")) {
    return importPdfWithService(file, options);
  }

  throw new Error("Unsupported file type. Use TXT, MD, EPUB, or PDF.");
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
