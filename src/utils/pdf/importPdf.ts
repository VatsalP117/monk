import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { ImportResult, PdfOutlineItem } from "../../types";

GlobalWorkerOptions.workerSrc = pdfWorker;

function mapOutlineItems(items: unknown[]): PdfOutlineItem[] {
  return items.map((item) => {
    const outlineItem = item as { title: string; dest?: unknown; items?: unknown[] };
    return {
      title: outlineItem.title,
      dest: outlineItem.dest,
      items: outlineItem.items ? mapOutlineItems(outlineItem.items) : []
    };
  });
}

async function extractOutline(
  pdf: Awaited<ReturnType<typeof getDocument>["promise"]>
): Promise<PdfOutlineItem[] | undefined> {
  try {
    const outline = await pdf.getOutline();
    if (!outline || outline.length === 0) {
      return undefined;
    }
    return mapOutlineItems(outline);
  } catch {
    return undefined;
  }
}

async function extractTitle(
  pdf: Awaited<ReturnType<typeof getDocument>["promise"]>,
  fallback: string
): Promise<string> {
  try {
    const { metadata, info } = (await pdf.getMetadata()) ?? {};
    const dcTitle = metadata?.get?.("dc:title");
    const infoTitle = (info as { Title?: string } | undefined)?.Title;
    return dcTitle || infoTitle || fallback;
  } catch {
    return fallback;
  }
}

export async function importPdfFile(
  file: File,
  fallbackTitle: string
): Promise<ImportResult> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer.slice(0) }).promise;

  const title = await extractTitle(pdf, fallbackTitle);
  const outline = await extractOutline(pdf);
  const pageCount = pdf.numPages;

  return {
    title,
    content: "",
    format: "pdf",
    wordCount: 0,
    pageCount,
    pdfOutline: outline,
    pdfBuffer: buffer
  };
}