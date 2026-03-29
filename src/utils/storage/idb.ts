const DB_NAME = "monk-pdf-store";
const DB_VERSION = 1;

const STORES = {
  BLOBS: "pdf-blobs",
  PAGES: "pdf-pages"
} as const;

interface PdfBlobRecord {
  id: string;
  blob: ArrayBuffer;
  pageCount: number;
  createdAt: string;
}

interface PdfPageRecord {
  id: string;
  documentId: string;
  pageNumber: number;
  data: unknown;
  extractedAt: string;
}

let dbInstance: IDBDatabase | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`IndexedDB error: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.BLOBS)) {
        db.createObjectStore(STORES.BLOBS, { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains(STORES.PAGES)) {
        const pageStore = db.createObjectStore(STORES.PAGES, { keyPath: "id" });
        pageStore.createIndex("documentId", "documentId", { unique: false });
        pageStore.createIndex("pageNumber", "pageNumber", { unique: false });
      }
    };
  });
}

export async function putPdfBlob(
  documentId: string,
  blob: ArrayBuffer,
  pageCount: number
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.BLOBS, "readwrite");
    const store = transaction.objectStore(STORES.BLOBS);

    const record: PdfBlobRecord = {
      id: documentId,
      blob,
      pageCount,
      createdAt: new Date().toISOString()
    };

    const request = store.put(record);

    request.onerror = () => {
      reject(new Error(`Failed to store PDF blob: ${request.error?.message}`));
    };

    transaction.oncomplete = () => {
      resolve();
    };
  });
}

export async function getPdfBlob(documentId: string): Promise<ArrayBuffer | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.BLOBS, "readonly");
    const store = transaction.objectStore(STORES.BLOBS);
    const request = store.get(documentId);

    request.onerror = () => {
      reject(new Error(`Failed to get PDF blob: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const record = request.result as PdfBlobRecord | undefined;
      resolve(record?.blob ?? null);
    };
  });
}

export async function getPdfPageCount(documentId: string): Promise<number | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.BLOBS, "readonly");
    const store = transaction.objectStore(STORES.BLOBS);
    const request = store.get(documentId);

    request.onerror = () => {
      reject(new Error(`Failed to get PDF metadata: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const record = request.result as PdfBlobRecord | undefined;
      resolve(record?.pageCount ?? null);
    };
  });
}

export async function putPdfPage(
  documentId: string,
  pageNumber: number,
  data: unknown
): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PAGES, "readwrite");
    const store = transaction.objectStore(STORES.PAGES);

    const record: PdfPageRecord = {
      id: `${documentId}_${pageNumber}`,
      documentId,
      pageNumber,
      data,
      extractedAt: new Date().toISOString()
    };

    const request = store.put(record);

    request.onerror = () => {
      reject(new Error(`Failed to store PDF page: ${request.error?.message}`));
    };

    transaction.oncomplete = () => {
      resolve();
    };
  });
}

export async function getPdfPage(
  documentId: string,
  pageNumber: number
): Promise<unknown | null> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.PAGES, "readonly");
    const store = transaction.objectStore(STORES.PAGES);
    const request = store.get(`${documentId}_${pageNumber}`);

    request.onerror = () => {
      reject(new Error(`Failed to get PDF page: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      const record = request.result as PdfPageRecord | undefined;
      resolve(record?.data ?? null);
    };
  });
}

export async function deletePdfDocument(documentId: string): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.BLOBS, STORES.PAGES], "readwrite");

    const blobStore = transaction.objectStore(STORES.BLOBS);
    blobStore.delete(documentId);

    const pageStore = transaction.objectStore(STORES.PAGES);
    const index = pageStore.index("documentId");
    const pagesRequest = index.openCursor(IDBKeyRange.only(documentId));

    pagesRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    pagesRequest.onerror = () => {
      reject(new Error(`Failed to delete PDF pages: ${pagesRequest.error?.message}`));
    };

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(new Error(`Failed to delete PDF document: ${transaction.error?.message}`));
    };
  });
}

export async function clearAllPdfData(): Promise<void> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.BLOBS, STORES.PAGES], "readwrite");

    transaction.objectStore(STORES.BLOBS).clear();
    transaction.objectStore(STORES.PAGES).clear();

    transaction.oncomplete = () => {
      resolve();
    };

    transaction.onerror = () => {
      reject(new Error(`Failed to clear PDF data: ${transaction.error?.message}`));
    };
  });
}