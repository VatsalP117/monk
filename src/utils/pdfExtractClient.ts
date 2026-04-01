import type { ImportResult } from "../types";

const DEFAULT_PDF_EXTRACT_URL = "http://localhost:7788";
const HEALTH_TIMEOUT_MS = 6000;
const CONVERT_TIMEOUT_MS = 180000;

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

interface ConvertStats {
  llm_provider?: string;
  llm_cleaned?: number;
  llm_failed?: number;
  bad_pages?: number;
  good_pages?: number;
  locally_refined?: number;
}

interface ConvertResponse {
  page_count: number;
  processing_time_s?: number;
  pages: ConvertPage[];
  stats?: ConvertStats;
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
  formData.append("include_images", "false");
  formData.append("include_image_b64", "false");

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
  const markdownPages = orderedPages.map((page) => page.markdown.trim()).filter(Boolean);
  const content = markdownPages.join("\n\n");

  if (!content.trim()) {
    throw new Error("The PDF was processed but no readable text was found.");
  }

  const warnings: string[] = [];
  if ((converted.stats?.llm_failed ?? 0) > 0) {
    warnings.push("Some pages may have extraction artifacts.");
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
