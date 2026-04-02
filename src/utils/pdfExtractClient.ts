import type { ImportResult } from "../types";

const DEFAULT_PDF_EXTRACT_URL = "http://localhost:7788";
const HEALTH_TIMEOUT_MS = 6000;
const CONVERT_TIMEOUT_MS = 180000;
const MAX_EMBEDDED_IMAGE_COUNT = 12;
const MAX_EMBEDDED_IMAGE_TOTAL_BYTES = 700_000;
const MAX_EMBEDDED_IMAGE_BYTES_PER_IMAGE = 220_000;
const EMPTY_IMAGE_PLACEHOLDER_RE = /!\[([^\]]*)\]\(\s*\)/g;

interface ServiceErrorBody {
  error?: {
    code?: string;
    message?: string;
    context?: Record<string, unknown>;
  };
  detail?: string;
}

interface ConvertPage {
  page: number;
  markdown: string;
}

interface ConvertImage {
  page: number;
  image_index: number;
  mime_type?: string;
  size_bytes?: number;
  image_b64?: string;
  image_b64_omitted?: string;
}

interface ConvertStats {
  llm_provider?: string;
  llm_cleaned?: number;
  llm_failed?: number;
  bad_pages?: number;
  good_pages?: number;
  locally_refined?: number;
  images_found?: number;
  images_with_b64?: number;
  images_b64_omitted_too_large?: number;
  images_skipped_small?: number;
}

interface ConvertResponse {
  page_count: number;
  processing_time_s?: number;
  pages: ConvertPage[];
  stats?: ConvertStats;
  images?: ConvertImage[];
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "") || "Untitled";
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function getServiceBaseUrl(): string {
  const configured = (import.meta.env.VITE_PDF_EXTRACT_URL as string | undefined)?.trim();
  return normalizeBaseUrl(configured || DEFAULT_PDF_EXTRACT_URL);
}

function toMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function mapServiceError(body: ServiceErrorBody): string {
  const code = body.error?.code;
  const context = body.error?.context;
  if (code === "file_too_large") {
    const maxBytes = Number(context?.max_upload_bytes ?? 0);
    if (maxBytes > 0) {
      return `PDF is too large for the extractor limit (${toMb(maxBytes)}).`;
    }
    return "PDF is too large for the extractor service.";
  }

  if (code === "encrypted_pdf") {
    return "This PDF is password-protected. Please unlock it before importing.";
  }

  if (code === "invalid_pdf") {
    return "This PDF appears corrupted or unreadable.";
  }

  if (code === "empty_pdf" || code === "empty_file") {
    return "This PDF is empty and cannot be imported.";
  }

  if (code === "unsupported_file_type") {
    return "Only PDF files can be sent to the extractor service.";
  }

  return body.error?.message || body.detail || "PDF extraction failed.";
}

async function fetchJsonWithTimeout<T>(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs);

  let linkedAbortHandler: (() => void) | null = null;
  if (init.signal) {
    if (init.signal.aborted) {
      controller.abort(init.signal.reason);
    } else {
      linkedAbortHandler = () => controller.abort(init.signal?.reason);
      init.signal.addEventListener("abort", linkedAbortHandler, { once: true });
    }
  }

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const raw = (await response.json().catch(() => ({}))) as ServiceErrorBody | T;

    if (!response.ok) {
      throw new Error(mapServiceError(raw as ServiceErrorBody));
    }

    return raw as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (init.signal?.aborted) {
        throw new Error("PDF import cancelled.");
      }
      throw new Error("PDF extraction timed out. Try again with a smaller file.");
    }
    if (error instanceof TypeError) {
      throw new Error("Could not reach PDF extraction service. Ensure monk-pdf-extract is running.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
    if (linkedAbortHandler && init.signal) {
      init.signal.removeEventListener("abort", linkedAbortHandler);
    }
  }
}

function ensureValidConvertResponse(payload: ConvertResponse): ConvertPage[] {
  if (!payload || !Array.isArray(payload.pages)) {
    throw new Error("Extractor returned an invalid response.");
  }

  const pages = payload.pages.filter(
    (page): page is ConvertPage =>
      typeof page?.page === "number" && typeof page?.markdown === "string"
  );

  if (pages.length === 0) {
    throw new Error("PDF has no readable text content.");
  }

  return pages.sort((left, right) => left.page - right.page);
}

function mergeImagesIntoPages(
  pages: ConvertPage[],
  images: ConvertImage[] | undefined
): { merged: string[]; embeddedCount: number; skippedCount: number; placeholderFallbackCount: number } {
  const imageLinesByPage = new Map<number, string[]>();
  let embeddedCount = 0;
  let totalEmbeddedBytes = 0;
  let skippedCount = 0;
  let placeholderFallbackCount = 0;

  if (images && images.length > 0) {
    const sortedImages = [...images].sort((left, right) => {
      if (left.page !== right.page) {
        return left.page - right.page;
      }
      return left.image_index - right.image_index;
    });

    sortedImages.forEach((image) => {
      if (!image.image_b64) {
        skippedCount += 1;
        return;
      }

      const sizeBytes = image.size_bytes ?? Math.floor(image.image_b64.length * 0.75);
      if (sizeBytes > MAX_EMBEDDED_IMAGE_BYTES_PER_IMAGE) {
        skippedCount += 1;
        return;
      }

      if (embeddedCount >= MAX_EMBEDDED_IMAGE_COUNT) {
        skippedCount += 1;
        return;
      }

      if (totalEmbeddedBytes + sizeBytes > MAX_EMBEDDED_IMAGE_TOTAL_BYTES) {
        skippedCount += 1;
        return;
      }

      const mimeType = image.mime_type || "image/png";
      const line = `![PDF image — page ${image.page + 1}](data:${mimeType};base64,${image.image_b64})`;
      const lines = imageLinesByPage.get(image.page) ?? [];
      lines.push(line);
      imageLinesByPage.set(image.page, lines);

      embeddedCount += 1;
      totalEmbeddedBytes += sizeBytes;
    });
  }

  const merged = pages.map((page) => {
    const pageImageLines = imageLinesByPage.get(page.page) ?? [];
    let consumedImages = 0;

    const withReplacedPlaceholders = page.markdown.replace(
      EMPTY_IMAGE_PLACEHOLDER_RE,
      (_match: string, altText: string) => {
        const replacement = pageImageLines[consumedImages];
        if (replacement) {
          consumedImages += 1;
          return replacement;
        }

        const normalizedAlt = altText.trim();
        placeholderFallbackCount += 1;
        return normalizedAlt ? `_${normalizedAlt}_` : "";
      }
    );

    const remainingImages = pageImageLines.slice(consumedImages);
    const parts = [withReplacedPlaceholders.trim(), ...remainingImages].filter(Boolean);

    return parts.join("\n\n");
  });

  return { merged, embeddedCount, skippedCount, placeholderFallbackCount };
}

export async function importPdfWithService(
  file: File,
  options?: { signal?: AbortSignal; onStatus?: (status: string) => void }
): Promise<ImportResult> {
  const baseUrl = getServiceBaseUrl();
  options?.onStatus?.("Checking PDF extraction service...");

  await fetchJsonWithTimeout<Record<string, unknown>>(
    `${baseUrl}/health`,
    {
      method: "GET",
      signal: options?.signal
    },
    HEALTH_TIMEOUT_MS
  );

  options?.onStatus?.("Uploading PDF...");
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("include_images", "true");
  formData.append("include_image_b64", "true");

  options?.onStatus?.("Extracting and refining pages...");
  const converted = await fetchJsonWithTimeout<ConvertResponse>(
    `${baseUrl}/convert`,
    {
      method: "POST",
      body: formData,
      signal: options?.signal
    },
    CONVERT_TIMEOUT_MS
  );

  const orderedPages = ensureValidConvertResponse(converted);
  const mergedImages = mergeImagesIntoPages(orderedPages, converted.images);
  const markdownPages = mergedImages.merged.filter(Boolean);
  const content = markdownPages.join("\n\n");

  if (!content.trim()) {
    throw new Error("The PDF was processed but no readable text was found.");
  }

  const warnings: string[] = [];
  if ((converted.stats?.llm_failed ?? 0) > 0) {
    warnings.push("Some pages may have extraction artifacts.");
  }

  const imagesFound = converted.stats?.images_found ?? 0;
  if (imagesFound > 0 && mergedImages.embeddedCount === 0) {
    warnings.push("This PDF has images, but they were too large to embed.");
  } else if (mergedImages.skippedCount > 0) {
    warnings.push("Some large images were skipped to keep imports lightweight.");
  }
  if (mergedImages.placeholderFallbackCount > 0) {
    warnings.push("Some figure placeholders could not be rendered as inline images.");
  }

  options?.onStatus?.("Finalizing import...");
  return {
    title: stripExtension(file.name),
    content,
    format: "pdf",
    markdownPages,
    warning: warnings.join(" ") || null,
    sourceMeta: {
      originalFileName: file.name,
      fileSizeBytes: file.size,
      importedAt: new Date().toISOString(),
      warnings,
      pdf: {
        pageCount: converted.page_count,
        processingTimeS: converted.processing_time_s,
        llmProvider: converted.stats?.llm_provider,
        llmCleaned: converted.stats?.llm_cleaned,
        llmFailed: converted.stats?.llm_failed,
        badPages: converted.stats?.bad_pages,
        goodPages: converted.stats?.good_pages,
        locallyRefined: converted.stats?.locally_refined
      }
    }
  };
}
