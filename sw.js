const CACHE_NAME = "pdf-editor-v1";
const DB_NAME = "PDFEditorDB";
const STORE_NAME = "sharedFiles";

self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

function saveFile(file) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, "readwrite");

      transaction.objectStore(STORE_NAME).put({
        blob: file,
        name: file.name || "documento.pdf",
        type: file.type || "application/pdf"
      }, "incoming");

      transaction.oncomplete = () => {
        db.close();
        resolve();
      };

      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };

    request.onerror = () => reject(request.error);
  });
}

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const sharePath = new URL(
    "./share-target",
    self.registration.scope
  ).pathname;

  if (
    event.request.method === "POST" &&
    url.pathname === sharePath
  ) {
    event.respondWith((async () => {
      try {
        const formData = await event.request.formData();
        const files = formData.getAll("files");

        const pdf = files.find(file =>
          file instanceof File &&
          file.type === "application/pdf"
        );

        if (!pdf) {
          return Response.redirect(
            self.registration.scope + "?shareError=1",
            303
          );
        }

        await saveFile(pdf);

        return Response.redirect(
          self.registration.scope + "?shared=1",
          303
        );
      } catch (error) {
        return Response.redirect(
          self.registration.scope + "?shareError=1",
          303
        );
      }
    })());
  }
});
