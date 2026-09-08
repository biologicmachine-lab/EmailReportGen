import { state, getReportData } from './state.js';
import { thumbUrl } from './photos.js';

export function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function entryHeaderText(e) {
  const sys = (e.system || '').trim();
  const desc = (e.description || '').trim();
  if (sys && desc) return `${sys} - ${desc}`;
  return sys || desc || '(no description)';
}

export function entryPartSerialLine(e) {
  const parts = [];
  if (e.partNumbers?.trim()) parts.push(`Part #: ${e.partNumbers.trim()}`);
  if (e.serialNumbers?.trim()) parts.push(`Serial #: ${e.serialNumbers.trim()}`);
  return parts.length ? parts.join('   ') : null;
}

const TEXT_FIELDS = [
  ['system', 'System', 'System ID'],
  ['description', 'Description', 'Describe…'],
  ['partNumbers', 'Part number(s)', 'e.g. 123456'],
  ['serialNumbers', 'Serial number(s)', 'e.g. 123456']
];

export function renderEntries() {
  const container = document.getElementById('entriesContainer');
  container.innerHTML = '';

  state.entries.forEach((e, idx) => {
    const div = document.createElement('div');
    div.className = 'entry';
    div.dataset.entry = e.id;

    const fields = TEXT_FIELDS.map(([key, label, placeholder]) => `
      <div class="field">
        <label for="f-${e.id}-${key}">${label}</label>
        <input type="text" id="f-${e.id}-${key}" value="${escapeHtml(e[key])}"
               placeholder="${placeholder}" data-entry="${e.id}" data-field="${key}">
      </div>`).join('');

    div.innerHTML = `
      <div class="entry-header">
        <strong data-role="header">Entry ${idx + 1}${e.system ? ' — ' + escapeHtml(e.system) : ''}</strong>
        ${state.entries.length > 1
          ? `<button class="btn danger" data-action="remove-entry" data-entry="${e.id}">Remove</button>`
          : ''}
      </div>
      <div class="grid">${fields}</div>
      <div class="field">
        <label for="f-${e.id}-notes">Notes</label>
        <textarea id="f-${e.id}-notes" placeholder="Additional details, if any…"
                  data-entry="${e.id}" data-field="notes">${escapeHtml(e.notes)}</textarea>
      </div>
      <div class="field">
        <label>Photos</label>
        <button class="photo-drop" type="button" data-action="add-photo" data-entry="${e.id}">
          Add photos
        </button>
        <div class="thumbs" data-role="thumbs"></div>
      </div>`;

    container.appendChild(div);
    renderThumbs(e.id);
  });
}

export async function renderThumbs(entryId) {
  const card = document.querySelector(`.entry[data-entry="${entryId}"]`);
  if (!card) return;
  const wrap = card.querySelector('[data-role="thumbs"]');
  const entry = state.entries.find(e => e.id === Number(entryId));
  if (!wrap || !entry) return;

  wrap.innerHTML = '';
  for (const p of entry.photos) {
    const t = document.createElement('div');
    t.className = 'thumb';
    t.innerHTML =
      `<img alt="${escapeHtml(p.name)}">` +
      `<button class="rm" title="Remove photo" data-action="remove-photo" ` +
      `data-entry="${entryId}" data-photo="${p.id}">✕</button>`;
    wrap.appendChild(t);

    const url = await thumbUrl(p.id);
    if (url) t.querySelector('img').src = url;
  }
}

export function refreshEntryHeader(entryId) {
  const card = document.querySelector(`.entry[data-entry="${entryId}"]`);
  const entry = state.entries.find(e => e.id === Number(entryId));
  if (!card || !entry) return;
  const idx = state.entries.indexOf(entry);
  card.querySelector('[data-role="header"]').textContent =
    `Entry ${idx + 1}${entry.system ? ' — ' + entry.system : ''}`;
}

/* ---- preview ---- */

function fieldBlock(label, value) {
  return `<p style="margin:4px 0;"><b>${escapeHtml(label)}:</b><br>` +
         `${escapeHtml(value).replace(/\n/g, '<br>')}</p>`;
}

export async function renderPreview(summaryFields, programmingFields) {
  const data = getReportData();
  let html = `<h3>${escapeHtml(data.title)}</h3>`;
  html += `<p><b>Date:</b> ${escapeHtml(data.date || '(not set)')}`;
  html += ` &nbsp; <b>By:</b> ${escapeHtml(data.preparedBy || '(none)')}</p>`;
  if (data.generalNotes) html += fieldBlock('General notes', data.generalNotes);

  for (const e of data.entries) {
    html += `<div class="entry-block"><b>${escapeHtml(entryHeaderText(e))}</b><br>`;
    const ps = entryPartSerialLine(e);
    if (ps) html += `${escapeHtml(ps)}<br>`;
    if (e.notes?.trim()) html += `<br>Notes: ${escapeHtml(e.notes.trim()).replace(/\n/g, '<br>')}<br>`;
    for (const p of e.photos) {
      const url = await thumbUrl(p.id);
      if (url) html += `<img src="${url}" alt="${escapeHtml(p.name)}">`;
    }
    html += `</div>`;
  }

  const summary = summaryFields(data);
  if (summary.length) {
    html += `<div class="entry-block"><b>Summary of calls answered</b>`;
    summary.forEach(([l, v]) => { html += fieldBlock(l, v); });
    html += `</div>`;
  }

  const prog = programmingFields(data);
  if (prog.length) {
    html += `<div class="entry-block"><b>Programming and projects</b>`;
    prog.forEach(([l, v]) => { html += fieldBlock(l, v); });
    html += `</div>`;
  }

  document.getElementById('previewContent').innerHTML = html;
  const card = document.getElementById('previewCard');
  card.style.display = 'block';
  card.scrollIntoView({ behavior: 'smooth' });
}
