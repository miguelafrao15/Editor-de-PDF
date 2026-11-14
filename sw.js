const CACHE = "pdf-editor-v1";
const DB_NAME = "pdf-editor-share";
const STORE = "files";
self.addEventListener("install", event => {
  event.waitUntil((async()=>{await self.skipWaiting();})());
});
self.addEventListener("activate", event => {
  event.waitUntil((async()=>{await self.clients.claim();})());
});
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname.endsWith("/share/")) {
    event.respondWith(handleShare(event.request));
  }
});
async function handleShare(request) {
  const form = await request.formData();
  const file = form.get("pdf");
  if (file && typeof file.arrayBuffer === "function") {
    await saveFile(file, file.name || "compartilhado.pdf");
  }
  return Response.redirect(new URL("./", self.registration.scope), 303);
}
function openDb() {
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function saveFile(file,name) {
  const db=await openDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    tx.objectStore(STORE).put({blob:file,name}, "latest");
    tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error);
  });
  db.close();
}
async function takeFile() {
  const db=await openDb();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readwrite");
    const store=tx.objectStore(STORE);
    const req=store.get("latest");
    let result=null;
    req.onsuccess=()=>{result=req.result || null;store.delete("latest");};
    tx.oncomplete=()=>{db.close();resolve(result);};
    tx.onerror=()=>reject(tx.error);
  });
}
self.addEventListener("message", event=>{
  if (event.data && event.data.type==="GET_SHARED_PDF" && event.ports[0]) {
    event.waitUntil(takeFile().then(data=>event.ports[0].postMessage(data)).catch(()=>event.ports[0].postMessage(null)));
  }
});
