import { initLock, lockApp } from './lock.js';
import {
  state, newEntry, findEntry, getReportData, applyReportData,
  loadDraft, clearDraft, saveNow, scheduleSave,
  allPhotoIds, totalPhotoBytes, backupTakenToday
} from './state.js';
import { clearPhotos, pruneOrphans, requestPersistence, putPhoto } from './db.js';
import {
  attachPhotos, removePhoto, releaseAllThumbs, photoCount
} from './photos.js';
import { renderEntries, renderThumbs, refreshEntryHeader, renderPreview } from './render.js';
import { buildEmlBlob, summaryFields, programmingFields, buildPlainTextBody } from './email.js';
import { downloadBackup, restoreBackupFile, triggerDownload } from './backup.js';
import { setStatus, alertBanner, updateMeter } from './ui.js';

let pendingEntryId = null;

/* ---- entries ---- */

function addEntry() {
  state.entries.push(newEntry());
  renderEntries();
  scheduleSave();
  refreshMeter();
}

function removeEntry(id) {
  const entry = findEntry(id);
  if (!entry) return;
  if (entry.photos.length &&
      !confirm(`Remove this entry and its ${entry.photos.length} photo(s)?`)) return;
  entry.photos.forEach(p => removePhoto(entry.id, p.id));
  state.entries = state.entries.filter(e => e.id !== Number(id));
  if (!state.entries.length) state.entries.push(newEntry());
  renderEntries();
  scheduleSave();
  refreshMeter();
}

/* ---- storage meter ---- */

function refreshMeter() {
  updateMeter(photoCount(), totalPhotoBytes());
}

/* ---- export ---- */

function warnIfNoBackup() {
  if (photoCount() > 0 && !backupTakenToday()) {
    setStatus('Exported. You have not downloaded a backup today — worth doing before you close out.');
  }
}

async function exportEml() {
  const data = getReportData();
  setStatus('Building the email…');
  try {
    const { blob, filename, missing } = await buildEmlBlob(data);
    triggerDownload(blob, filename);
    if (missing.length) {
      alertBanner(`${missing.length} photo(s) could not be found and were left out: ` +
                  missing.join(', '));
    } else {
      setStatus(`Exported ${filename} with ${photoCount()} photo(s). ` +
                `Open it from Files and send.`);
      warnIfNoBackup();
    }
  } catch (err) {
    alertBanner('Export failed: ' + err.message);
  }
}

async function shareReport() {
  const data = getReportData();
  setStatus('Building the email…');
  try {
    const { blob, filename, missing } = await buildEmlBlob(data);
    const file = new File([blob], filename, { type: 'message/rfc822' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: data.title });
      if (missing.length) {
        alertBanner(`${missing.length} photo(s) could not be found and were left out.`);
      } else {
        setStatus('Shared. Pick Mail from the share sheet to finish sending.');
        warnIfNoBackup();
      }
    } else {
      setStatus('This device cannot share files directly. Use Export instead.', true);
    }
  } catch (err) {
    if (err.name !== 'AbortError') alertBanner('Share failed: ' + err.message);
  }
}

function openMailto() {
  const data = getReportData();
  let url = `mailto:${data.toEmail || ''}?subject=${encodeURIComponent(data.title)}` +
            `&body=${encodeURIComponent(buildPlainTextBody(data))}`;
  if (data.ccEmail) url += `&cc=${encodeURIComponent(data.ccEmail)}`;
  window.location.href = url;
  setStatus('Opened your mail app. Photos are not included — mail links cannot carry attachments.');
}

/* ---- clear ---- */

async function clearAll() {
  if (!confirm('Clear this report and start a new shift? Photos will be deleted too.')) return;
  if (photoCount() > 0 && !backupTakenToday() &&
      !confirm('You have not downloaded a backup today. Clear anyway?')) return;

  releaseAllThumbs();
  await clearPhotos();
  clearDraft();

  applyReportData({ entries: [] });
  state.entries = [newEntry()];
  document.getElementById('reportDate').valueAsDate = new Date();
  autoFillTitle();
  renderEntries();
  document.getElementById('previewCard').style.display = 'none';
  saveNow();
  refreshMeter();
  setStatus('New shift started.');
}

/* ---- title ---- */

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

function autoFillTitle() {
  const title = document.getElementById('reportTitle');
  const date = document.getElementById('reportDate');
  const isAuto = !title.value.trim() ||
                 /^Shift Report \d{2}\/\d{2}\/\d{4}$/.test(title.value.trim());
  if (isAuto) title.value = `Shift Report ${formatDate(date.value)}`;
}

function toggleContributingFollowup() {
  const val = document.getElementById('sumContributing').value;
  document.getElementById('contributingFollowupField').style.display =
    val === 'Yes' ? 'block' : 'none';
}

/* ---- delegated events ---- */

function wireEvents() {
  const container = document.getElementById('entriesContainer');

  container.addEventListener('click', evt => {
    const btn = evt.target.closest('[data-action]');
    if (!btn) return;
    const { action, entry, photo } = btn.dataset;
    if (action === 'add-photo') {
      pendingEntryId = Number(entry);
      document.getElementById('fileInput').click();
    } else if (action === 'remove-entry') {
      removeEntry(entry);
    } else if (action === 'remove-photo') {
      removePhoto(Number(entry), photo).then(() => {
        renderThumbs(Number(entry));
        refreshMeter();
      });
    }
  });

  container.addEventListener('input', evt => {
    const el = evt.target;
    if (!el.dataset.field) return;
    const e = findEntry(el.dataset.entry);
    if (!e) return;
    e[el.dataset.field] = el.value;
    if (el.dataset.field === 'system') refreshEntryHeader(el.dataset.entry);
    scheduleSave();
  });

  document.getElementById('fileInput').addEventListener('change', async evt => {
    const files = Array.from(evt.target.files || []);
    evt.target.value = '';
    if (!files.length || pendingEntryId == null) return;
    await attachPhotos(pendingEntryId, files);
    renderThumbs(pendingEntryId);
    refreshMeter();
  });

  document.getElementById('addEntryBtn').addEventListener('click', addEntry);
  document.getElementById('exportBtn').addEventListener('click', exportEml);
  document.getElementById('shareBtn').addEventListener('click', shareReport);
  document.getElementById('mailtoBtn').addEventListener('click', openMailto);
  document.getElementById('previewBtn').addEventListener('click',
    () => renderPreview(summaryFields, programmingFields));
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('lockBtn').addEventListener('click', lockApp);

  document.getElementById('backupBtn').addEventListener('click', downloadBackup);
  document.getElementById('restoreBtn').addEventListener('click',
    () => document.getElementById('restoreFile').click());
  document.getElementById('restoreFile').addEventListener('change', async evt => {
    const file = evt.target.files[0];
    evt.target.value = '';
    releaseAllThumbs();
    await restoreBackupFile(file, () => { renderEntries(); saveNow(); refreshMeter(); });
  });

  document.getElementById('sumContributing').addEventListener('change', toggleContributingFollowup);
  document.getElementById('reportDate').addEventListener('change', autoFillTitle);

  // Report-level fields autosave; entry fields are handled above.
  document.querySelectorAll('.card input, .card textarea, .card select').forEach(el => {
    if (el.closest('#entriesContainer')) return;
    el.addEventListener('input', scheduleSave);
    el.addEventListener('change', scheduleSave);
  });

  // iOS can suspend a backgrounded page without warning. Save on the way out.
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  window.addEventListener('pagehide', saveNow);
}

/* ---- migration ---- */

// The old version kept everything, photos included, in one localStorage key.
// Move it across on first run, then delete it — that key alone was holding
// several megabytes and was the reason the quota kept filling up.
const LEGACY_KEY = 'shiftReportAutosave';

async function migrateLegacyDraft() {
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    for (const e of (data.entries || [])) {
      for (const p of (e.photos || [])) {
        if (!p.dataUrl) continue;
        p.id = 'p_' + Math.random().toString(36).slice(2, 10);
        const blob = await (await fetch(p.dataUrl)).blob();
        await putPhoto(p.id, blob);
        p.bytes = blob.size;
        p.type = blob.type || 'image/jpeg';
        delete p.dataUrl;
      }
    }
    applyReportData(data);
    saveNow();
    localStorage.removeItem(LEGACY_KEY);
    setStatus('Moved your last shift over to the new storage. Photos came with it.');
    return true;
  } catch {
    // Leave the old key alone so nothing is destroyed if this fails.
    return false;
  }
}

/* ---- boot ---- */

async function boot() {
  initLock();

  if (navigator.share) document.getElementById('shareBtn').style.display = '';

  const draft = loadDraft();
  if (draft) {
    applyReportData(draft);
    await pruneOrphans(allPhotoIds());
  } else {
    await migrateLegacyDraft();
  }
  if (!state.entries.length) state.entries.push(newEntry());
  if (!document.getElementById('reportDate').value) {
    document.getElementById('reportDate').valueAsDate = new Date();
  }
  autoFillTitle();
  toggleContributingFollowup();
  renderEntries();
  wireEvents();
  refreshMeter();

  requestPersistence();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline  */ });
  }
}

boot();
