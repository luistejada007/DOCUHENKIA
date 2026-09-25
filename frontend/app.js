const API = "/api/documents";
let documents = [];
let selectedId = null;
let currentFilter = "all";

const $ = s => document.querySelector(s);
const table = $("#documentsTable");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2500);
}

function groupFor(doc) {
  const name = doc.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (/\.(doc|docx)$/.test(name)) return "word";
  if (/\.(xls|xlsx|csv)$/.test(name)) return "excel";
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(name)) return "image";
  return "other";
}

function iconFor(group) {
  return ({pdf:"PDF",word:"DOC",excel:"XLS",image:"IMG",other:"FILE"})[group];
}

function size(bytes) {
  if (bytes < 1024) return bytes + " B";
  const units = ["KB","MB","GB"];
  let i = -1;
  do { bytes /= 1024; i++; } while (bytes >= 1024 && i < units.length - 1);
  return bytes.toFixed(i > 0 && bytes < 10 ? 1 : 0) + " " + units[i];
}

function date(value) {
  return new Date(value).toLocaleDateString("es-CO");
}

async function loadDocuments() {
  table.innerHTML = '<tr><td colspan="5" class="loading">Cargando documentos...</td></tr>';
  try {
    const res = await fetch(API);
    if (!res.ok) throw new Error("No se pudieron cargar los documentos");
    documents = await res.json();
    render();
  } catch (error) {
    table.innerHTML = `<tr><td colspan="5" class="empty-row">${escapeHTML(error.message)}</td></tr>`;
  }
}

function visibleDocuments() {
  const query = $("#search").value.trim().toLowerCase();
  return documents.filter(doc => {
    const group = groupFor(doc);
    return (currentFilter === "all" || group === currentFilter) &&
      doc.name.toLowerCase().includes(query);
  });
}

function render() {
  const list = visibleDocuments();
  $("#counter").textContent = `${list.length} documento${list.length !== 1 ? "s" : ""}`;

  if (!list.length) {
    table.innerHTML = '<tr><td colspan="5" class="empty-row">No hay documentos para mostrar.</td></tr>';
    return;
  }

  table.innerHTML = list.map(doc => {
    const group = groupFor(doc);
    return `<tr>
      <td><div class="file-cell"><span class="file-icon ${group}">${iconFor(group)}</span><strong>${escapeHTML(doc.name)}</strong></div></td>
      <td><span class="badge">${group.toUpperCase()}</span></td>
      <td>${size(doc.size)}</td>
      <td>${date(doc.createdAt)}</td>
      <td>
        <button class="action preview" data-id="${doc.id}" title="Visualizar">◉</button>
        <button class="action download" data-id="${doc.id}" title="Descargar">⇩</button>
        <button class="action delete" data-id="${doc.id}" title="Eliminar">×</button>
      </td>
    </tr>`;
  }).join("");
}

async function uploadFiles(fileList) {
  if (!fileList.length) return;
  const form = new FormData();
  [...fileList].forEach(file => form.append("documents", file));

  try {
    toast("Subiendo documentos...");
    const res = await fetch(`${API}/upload`, { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al subir");
    await loadDocuments();
    toast(`${data.length} documento(s) subido(s) correctamente`);
  } catch (error) {
    toast(error.message);
  }
}

function findDoc(id) {
  return documents.find(doc => doc.id === id);
}

function download(id) {
  window.open(`${API}/${id}/download`, "_blank");
}

async function preview(id) {
  const doc = findDoc(id);
  if (!doc) return;

  selectedId = id;
  $("#previewTitle").textContent = doc.name;
  $("#previewInfo").textContent = `${size(doc.size)} · ${date(doc.createdAt)}`;
  const content = $("#previewContent");
  content.innerHTML = '<div class="empty-preview"><span>⏳</span><h3>Cargando vista previa...</h3></div>';

  const url = doc.previewUrl;
  const group = groupFor(doc);

  try {
    if (group === "pdf") {
      content.innerHTML = `<iframe class="preview-frame" src="${url}"></iframe>`;
    } else if (group === "image") {
      content.innerHTML = `<img class="preview-image" src="${url}" alt="Vista previa">`;
    } else if (doc.name.toLowerCase().endsWith(".txt")) {
      const text = await fetch(url).then(r => r.text());
      content.innerHTML = `<pre class="document-preview">${escapeHTML(text)}</pre>`;
    } else if (doc.name.toLowerCase().endsWith(".docx")) {
      const buffer = await fetch(url).then(r => r.arrayBuffer());
      const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
      content.innerHTML = `<article class="document-preview">${result.value}</article>`;
    } else if (/\.(xlsx|xls|csv)$/.test(doc.name.toLowerCase())) {
      const buffer = await fetch(url).then(r => r.arrayBuffer());
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      content.innerHTML = `<div class="document-preview">${XLSX.utils.sheet_to_html(sheet)}</div>`;
    } else {
      content.innerHTML = `<div class="empty-preview"><span>📄</span><h3>Vista previa no disponible</h3><p>Descarga el archivo para abrirlo.</p></div>`;
    }
  } catch (error) {
    content.innerHTML = `<div class="empty-preview"><span>⚠️</span><h3>No se pudo visualizar</h3><p>${escapeHTML(error.message)}</p></div>`;
  }
}

async function removeDocument(id) {
  const doc = findDoc(id);
  if (!doc || !confirm(`¿Eliminar "${doc.name}"?`)) return;

  const res = await fetch(`${API}/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (!res.ok) return toast(data.error || "No se pudo eliminar");
  if (selectedId === id) closePreview();
  await loadDocuments();
  toast("Documento eliminado");
}

function closePreview() {
  selectedId = null;
  $("#previewTitle").textContent = "Vista previa";
  $("#previewInfo").textContent = "Selecciona un documento";
  $("#previewContent").innerHTML = '<div class="empty-preview"><span>📄</span><h3>Selecciona un documento</h3><p>Visualiza PDFs, imágenes, archivos de texto, Word y Excel.</p></div>';
}

$("#uploadButton").onclick = () => $("#fileInput").click();
$("#openUpload").onclick = e => { e.preventDefault(); $("#fileInput").click(); };
$("#fileInput").onchange = e => uploadFiles(e.target.files);
$("#dropzone").onclick = () => $("#fileInput").click();
$("#search").oninput = render;
$("#refreshButton").onclick = loadDocuments;
$("#closePreview").onclick = closePreview;
$("#previewDownload").onclick = () => selectedId ? download(selectedId) : toast("Selecciona un documento");

document.querySelectorAll(".filter").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    render();
  };
});

table.onclick = event => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  if (button.classList.contains("preview")) preview(id);
  if (button.classList.contains("download")) download(id);
  if (button.classList.contains("delete")) removeDocument(id);
};

const dz = $("#dropzone");
["dragenter","dragover"].forEach(name => dz.addEventListener(name, e => {
  e.preventDefault();
  dz.classList.add("drag");
}));
["dragleave","drop"].forEach(name => dz.addEventListener(name, e => {
  e.preventDefault();
  dz.classList.remove("drag");
}));
dz.addEventListener("drop", e => uploadFiles(e.dataTransfer.files));

loadDocuments();
