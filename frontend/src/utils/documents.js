export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

export function groupFor(doc) {
  const name = doc.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'pdf';
  if (/\.(doc|docx)$/.test(name)) return 'word';
  if (/\.(xls|xlsx|csv)$/.test(name)) return 'excel';
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(name)) return 'image';
  return 'other';
}

export function iconFor(group) {
  return { pdf: 'PDF', word: 'DOC', excel: 'XLS', image: 'IMG', other: 'FILE' }[group];
}

export function size(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let index = -1;
  do {
    value /= 1024;
    index += 1;
  } while (value >= 1024 && index < units.length - 1);
  return `${value.toFixed(index > 0 && value < 10 ? 1 : 0)} ${units[index]}`;
}

export function date(value) {
  return new Date(value).toLocaleDateString('es-CO');
}