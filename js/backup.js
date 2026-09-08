import { getPhoto, putPhoto, pruneOrphans } from './db.js';
import { getReportData, applyReportData, allPhotoIds, markBackupTaken } from './state.js';
import { setStatus, alertBanner, formatBytes } from './ui.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return await res.blob();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadBackup() {
  setStatus('Building backup…');
  const data = getReportData();

  const entries = [];
  for (const e of data.entries) {
    const photos = [];
    for (const p of e.photos) {
      const blob = await getPhoto(p.id);
      photos.push({ ...p, dataUrl: blob ? await blobToDataUrl(blob) : null });
    }
    entries.push({ ...e, photos });
  }

  const payload = { version: 2, savedAt: new Date().toISOString(), ...data, entries };
  const json = JSON.stringify(payload);
  const blob = new Blob([json], { type: 'application/json' });

  const safeTitle = (data.title || 'shift_report').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  triggerDownload(blob, `${safeTitle || 'shift_report'}_backup.json`);
  markBackupTaken();
  setStatus(`Backup saved (${formatBytes(blob.size)}). Keep it in Files or mail it to yourself.`);
}

export async function restoreBackupFile(file, onDone) {
  if (!file) return;
  setStatus('Reading backup…');
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // v2 carries dataUrl per photo; v1 was the old flat format. Both load.
    for (const e of (data.entries || [])) {
      for (const p of (e.photos || [])) {
        if (p.dataUrl) {
          if (!p.id) p.id = 'p_' + Math.random().toString(36).slice(2, 10);
          const blob = await dataUrlToBlob(p.dataUrl);
          await putPhoto(p.id, blob);
          p.bytes = blob.size;
          delete p.dataUrl;
        }
      }
    }

    applyReportData(data);
    await pruneOrphans(allPhotoIds());
    onDone?.();
    setStatus('Backup restored.');
  } catch (err) {
    alertBanner('That file could not be read as a backup: ' + err.message);
  }
}

export { triggerDownload };
