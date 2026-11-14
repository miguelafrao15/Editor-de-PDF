/* PDF Editor - visualização com PDF.js e operações com pdf-lib */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const $ = id => document.getElementById(id);
const fileInput = $("fileInput");
const canvas = $("pdfCanvas");
const ctx = canvas.getContext("2d");
let originalBytes = null;
let pdfDoc = null;
let fileName = "documento.pdf";
let currentPage = 1;
let zoom = 1;
let rotations = {};
let deletedPages = new Set();

$("openBtn").addEventListener("click", () => fileInput.click());
$("welcomeOpen").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async e => {
  const file = e.target.files && e.target.files[0];
  if (file) await openPdf(file);
});

async function openPdf(file) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return setStatus("Escolha um arquivo PDF.");
  }
  try {
    setStatus("Abrindo documento…");
    fileName = file.name;
    originalBytes = new Uint8Array(await file.arrayBuffer());
    pdfDoc = await pdfjsLib.getDocument({data: originalBytes.slice()}).promise;
    currentPage = 1; zoom = 1; rotations = {}; deletedPages = new Set();
    $("fileName").textContent = fileName;
    $("welcome").hidden = true;
    $("editor").hidden = false;
    $("pageCount").textContent = pdfDoc.numPages;
    await renderPage();
    setStatus("PDF aberto. As alterações são aplicadas ao salvar.");
  } catch (err) {
    setStatus("Não foi possível abrir este PDF: " + err.message);
  }
}

async function renderPage() {
  if (!pdfDoc) return;
  currentPage = Math.max(1, Math.min(currentPage, pdfDoc.numPages));
  const page = await pdfDoc.getPage(currentPage);
  const rotation = (page.rotate + (rotations[currentPage] || 0)) % 360;
  const viewport = page.getViewport({scale: zoom, rotation});
  const maxWidth = Math.max(260, $("canvasAreaWidth") || $("editor").clientWidth - 240);
  const scale = Math.min(1.8, maxWidth / viewport.width);
  const finalViewport = page.getViewport({scale: zoom * scale, rotation});
  canvas.width = Math.floor(finalViewport.width);
  canvas.height = Math.floor(finalViewport.height);
  await page.render({canvasContext: ctx, viewport: finalViewport}).promise;
  $("pageNum").textContent = currentPage;
  $("zoomLabel").textContent = Math.round(zoom * 100) + "%";
  $("prevBtn").disabled = currentPage <= 1;
  $("nextBtn").disabled = currentPage >= pdfDoc.numPages;
  await renderThumbnails();
}

async function renderThumbnails() {
  const list = $("pageList");
  list.innerHTML = "";
  for (let n = 1; n <= pdfDoc.numPages; n++) {
    const page = await pdfDoc.getPage(n);
    const vp = page.getViewport({scale: 0.22});
    const c = document.createElement("canvas");
    c.width = vp.width; c.height = vp.height;
    await page.render({canvasContext:c.getContext("2d"), viewport:vp}).promise;
    const item = document.createElement("button");
    item.className = "thumb" + (n === currentPage ? " active" : "");
    item.append(c);
    const label = document.createElement("span");
    label.textContent = "Página " + n + (deletedPages.has(n) ? " · marcada" : "");
    item.append(label);
    item.addEventListener("click", () => { currentPage = n; renderPage(); });
    list.append(item);
  }
}

$("prevBtn").addEventListener("click", () => { currentPage--; renderPage(); });
$("nextBtn").addEventListener("click", () => { currentPage++; renderPage(); });
$("zoomIn").addEventListener("click", () => { zoom = Math.min(2.5, zoom + .15); renderPage(); });
$("zoomOut").addEventListener("click", () => { zoom = Math.max(.5, zoom - .15); renderPage(); });
$("rotateBtn").addEventListener("click", () => {
  rotations[currentPage] = ((rotations[currentPage] || 0) + 90) % 360;
  renderPage();
});
$("deletePageBtn").addEventListener("click", () => {
  if (pdfDoc.numPages - deletedPages.size <= 1) return setStatus("O PDF precisa ter pelo menos uma página.");
  deletedPages.add(currentPage);
  setStatus("Página " + currentPage + " marcada para exclusão. Toque em Salvar PDF para aplicar.");
  renderThumbnails();
});
$("downloadBtn").addEventListener("click", savePdf);

async function savePdf() {
  try {
    setStatus("Preparando PDF…");
    const {PDFDocument, degrees} = PDFLib;
    const out = await PDFDocument.load(originalBytes);
    const pages = out.getPages();
    const remove = [...deletedPages].sort((a,b)=>b-a);
    for (const n of remove) out.removePage(n - 1);
    const surviving = pages.map((p,i)=>({p,i:i+1})).filter(x=>!deletedPages.has(x.i));
    for (const item of surviving) {
      const turn = rotations[item.i] || 0;
      if (turn) {
        const target = out.getPages()[surviving.findIndex(x=>x.i===item.i)];
        target.setRotation(degrees((target.getRotation().angle + turn) % 360));
      }
    }
    const bytes = await out.save();
    const blob = new Blob([bytes], {type:"application/pdf"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName.replace(/\.pdf$/i,"") + "-editado.pdf";
    document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
    setStatus("PDF editado e baixado.");
  } catch (err) { setStatus("Erro ao salvar: " + err.message); }
}

function setStatus(message) { $("status").textContent = message; }

/* Recebe um PDF encaminhado pelo compartilhamento do Android, armazenado pelo Service Worker. */
async function loadSharedPdf() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const worker = reg.active;
    if (!worker) return;
    const channel = new MessageChannel();
    const result = await new Promise(resolve => {
      channel.port1.onmessage = e => resolve(e.data);
      worker.postMessage({type:"GET_SHARED_PDF"}, [channel.port2]);
      setTimeout(()=>resolve(null), 2500);
    });
    if (result && result.blob) {
      const file = new File([result.blob], result.name || "compartilhado.pdf", {type:"application/pdf"});
      await openPdf(file);
    }
  } catch (_) {}
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      loadSharedPdf();
    } catch (e) { setStatus("Não foi possível ativar o modo instalável."); }
  });
}
