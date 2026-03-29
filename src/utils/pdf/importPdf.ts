import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import type { ImportResult } from "../../types";
import { extractPdfPageText } from "./extractPageText";

GlobalWorkerOptions.workerSrc = pdfWorker;

export async function importPdfFile(file: File, title: string): Promise<ImportResult> {
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
    title,
    content: pages.join("\n\n"),
    format: "pdf"
  };
}
