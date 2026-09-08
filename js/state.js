import { alertBanner, hideBanner } from './ui.js';

const DRAFT_KEY = 'shiftReportDraft';

export const state = {
  entries: [],
  idCounter: 0
};

// Every text field, in one place. Adding a field to the report means
// adding one line here and one input in index.html — nothing else.
export const FIELDS = {
  title: 'reportTitle',
  date: 'reportDate',
  preparedBy: 'preparedBy',
  toEmail: 'toEmail',
  ccEmail: 'ccEmail',
  generalNotes: 'generalNotes'
};

export const SUMMARY_FIELDS = {
  where: 'sumWhere',
  why: 'sumWhy',
  issues: 'sumIssues',
  actions: 'sumActions',
  contributing: 'sumContributing',
  contributingFollowup: 'sumContributingFollowup',
  ncrNumber: 'sumNcrNumber',
  otherDetails: 'sumOtherDetails'
};

export const PROGRAMMING_FIELDS = {
  work: 'progWork',
  issues: 'progIssues',
  needs: 'progNeeds',
  ideas: 'progIdeas',
  etc: 'progEtc'
};

const val = id => (document.getElementById(id)?.value ?? '');
const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };

function readGroup(map) {
  const out = {};
  for (const [key, id] of Object.entries(map)) out[key] = val(id);
  return out;
}

function writeGroup(map, data) {
  for (const [key, id] of Object.entries(map)) setVal(id, (data || {})[key]);
}

export function newEntry() {
  return {
    id: ++state.idCounter,
    system: '', description: '', partNumbers: '', serialNumbers: '', notes: '',
    photos: []   // { id, name, type, bytes, width, height }
  };
}

export function findEntry(id) {
  return state.entries.find(e => e.id === Number(id));
}

export function getReportData() {
  return {
    ...readGroup(FIELDS),
    title: val(FIELDS.title) || 'Report',
    entries: state.entries,
    summary: readGroup(SUMMARY_FIELDS),
    programming: readGroup(PROGRAMMING_FIELDS)
  };
}

export function applyReportData(data) {
  writeGroup(FIELDS, data);
  writeGroup(SUMMARY_FIELDS, data.summary);
  writeGroup(PROGRAMMING_FIELDS, data.programming);

  state.entries = (data.entries || []).map(e => ({
    system: '', description: '', partNumbers: '', serialNumbers: '', notes: '',
    ...e,
    photos: (e.photos || []).map(p => ({ ...p })),
    id: ++state.idCounter
  }));
}

export function allPhotoIds() {
  return state.entries.flatMap(e => e.photos.map(p => p.id));
}

export function totalPhotoBytes() {
  return state.entries.reduce(
    (sum, e) => sum + e.photos.reduce((s, p) => s + (p.bytes || 0), 0), 0);
}

/* ---- draft persistence ---- */

let timer = null;

export function scheduleSave() {
  clearTimeout(timer);
  timer = setTimeout(saveNow, 400);
}

export function saveNow() {
  clearTimeout(timer);
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(getReportData()));
    hideBanner();
    const ind = document.getElementById('autosaveIndicator');
    if (ind) {
      ind.textContent = `Saved ${new Date().toLocaleTimeString()}. ` +
                        `Close the app whenever — this comes back when you reopen it.`;
    }
    return true;
  } catch (err) {
    alertBanner('Could not save your report: ' + err.message +
                '. Download a backup now before adding anything else.');
    return false;
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

export function markBackupTaken() {
  localStorage.setItem('shiftReportLastBackup', new Date().toISOString().slice(0, 10));
}

export function backupTakenToday() {
  return localStorage.getItem('shiftReportLastBackup') === new Date().toISOString().slice(0, 10);
}
