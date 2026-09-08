/* Building report txt and assembling .eml*/

import { getPhoto } from './db.js';
import { escapeHtml, entryHeaderText, entryPartSerialLine } from './render.js';

/* ---- field collection ---- */

export function summaryFields(data) {
  const s = data.summary || {};
  const lines = [];
  if (s.where?.trim()) lines.push(['Where', s.where.trim()]);
  if (s.why?.trim()) lines.push(['Why', s.why.trim()]);
  if (s.issues?.trim()) lines.push(['Issues observed', s.issues.trim()]);
  if (s.actions?.trim()) lines.push(['Corrective actions taken', s.actions.trim()]);
  if (s.contributing) {
    lines.push(['Fab processes or material conditions contributing?', s.contributing]);
    if (s.contributing === 'Yes') {
      if (s.contributingFollowup) {
        lines.push(['Communicated to line leads and NCR/weld report written?', s.contributingFollowup]);
      }
      if (s.ncrNumber?.trim()) lines.push(['NCR / weld report #', s.ncrNumber.trim()]);
    }
  }
  if (s.otherDetails?.trim()) lines.push(['Other details', s.otherDetails.trim()]);
  return lines;
}

export function programmingFields(data) {
  const p = data.programming || {};
  const lines = [];
  if (p.work?.trim()) lines.push(['Work performed', p.work.trim()]);
  if (p.issues?.trim()) lines.push(['Issues encountered', p.issues.trim()]);
  if (p.needs?.trim()) lines.push(['Items and resources needed', p.needs.trim()]);
  if (p.ideas?.trim()) lines.push(['Ideas for improvements', p.ideas.trim()]);
  if (p.etc?.trim()) lines.push(['Other notes', p.etc.trim()]);
  return lines;
}

/* ---- bodies ---- */

export function buildPlainTextBody(data) {
  let body = `${data.title}\n`;
  body += `Date: ${data.date || '(not set)'}\n`;
  body += `Prepared by: ${data.preparedBy || '(none)'}\n\n`;
  if (data.generalNotes) body += `General notes:\n${data.generalNotes}\n\n`;

  data.entries.forEach((e, i) => {
    body += `${i + 1}. ${entryHeaderText(e)}\n`;
    const ps = entryPartSerialLine(e);
    if (ps) body += `${ps}\n`;
    if (e.notes?.trim()) body += `Notes: ${e.notes.trim()}\n`;
    if (e.photos.length) {
      body += `Photos: ${e.photos.map(p => p.name).join(', ')}\n`;
    }
    body += `\n`;
  });

  const summary = summaryFields(data);
  if (summary.length) {
    body += `--- Summary of calls answered ---\n`;
    summary.forEach(([l, v]) => { body += `${l}: ${v}\n`; });
    body += `\n`;
  }

  const prog = programmingFields(data);
  if (prog.length) {
    body += `--- Programming and projects ---\n`;
    prog.forEach(([l, v]) => { body += `${l}: ${v}\n`; });
    body += `\n`;
  }

  return body;
}

export function buildHtmlBody(data, cidFor) {
  let html = `<h2>${escapeHtml(data.title)}</h2>`;
  html += `<p><b>Date:</b> ${escapeHtml(data.date || '(not set)')}<br>`;
  html += `<b>Prepared by:</b> ${escapeHtml(data.preparedBy || '(none)')}</p>`;
  if (data.generalNotes) {
    html += `<p><b>General notes:</b><br>${escapeHtml(data.generalNotes).replace(/\n/g, '<br>')}</p>`;
  }

  data.entries.forEach((e, i) => {
    html += `<hr><p style="margin-bottom:4px;"><b>${i + 1}. ${escapeHtml(entryHeaderText(e))}</b><br>`;
    const ps = entryPartSerialLine(e);
    if (ps) html += `${escapeHtml(ps)}<br>`;
    if (e.notes?.trim()) html += `<br>Notes: ${escapeHtml(e.notes.trim()).replace(/\n/g, '<br>')}<br>`;
    html += `</p>`;
    e.photos.forEach(p => {
      html += `<img src="cid:${cidFor(p)}" alt="${escapeHtml(p.name)}" ` +
              `style="max-width:320px;margin:4px;border:1px solid #ccc;border-radius:4px;"><br>`;
    });
  });

  const summary = summaryFields(data);
  if (summary.length) {
    html += `<hr><h3>Summary of calls answered</h3>`;
    summary.forEach(([l, v]) => {
      html += `<p style="margin:4px 0;"><b>${escapeHtml(l)}:</b><br>${escapeHtml(v).replace(/\n/g, '<br>')}</p>`;
    });
  }

  const prog = programmingFields(data);
  if (prog.length) {
    html += `<hr><h3>Programming and projects</h3>`;
    prog.forEach(([l, v]) => {
      html += `<p style="margin:4px 0;"><b>${escapeHtml(l)}:</b><br>${escapeHtml(v).replace(/\n/g, '<br>')}</p>`;
    });
  }

  return html;
}

/* ---- encoding ---- */

function bytesToBase64(bytes) {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

function textToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

function wrap76(b64) {
  return b64.length ? (b64.match(/.{1,76}/g) || []).join('\r\n') : '';
}

// -To base 64- .em dash or degree symbol in a 7bit-declared body is malformed mail
function encodeHeader(str) {
  const s = str || '';
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${textToBase64(s)}?=`;
}

/* ---- .eml assembly ---- */

export async function buildEmlBlob(data) {
  const mixed = 'mixed_' + Math.random().toString(36).slice(2);
  const alt = 'alt_' + Math.random().toString(36).slice(2);

  // 1st. Collect the image data. A photo with missing blob -must
  // be dropped from the body text as well as the attachments- or email
  // arrives promising a picture is not there.
  const blobs = new Map();
  const missing = [];
  for (const e of data.entries) {
    for (const p of e.photos) {
      const blob = await getPhoto(p.id);
      if (blob) blobs.set(p.id, blob); else missing.push(p.name);
    }
  }

  const present = {
    ...data,
    entries: data.entries.map(e => ({ ...e, photos: e.photos.filter(p => blobs.has(p.id)) }))
  };

  const cids = new Map();
  let n = 0;
  present.entries.forEach(e => e.photos.forEach(p => {
    cids.set(p.id, `photo${++n}@shiftreport`);
  }));
  const cidFor = p => cids.get(p.id);

  const plain = buildPlainTextBody(present);
  const html = buildHtmlBody(present, cidFor);

  const parts = [];
  parts.push(`To: ${data.toEmail || ''}\r\n`);
  if (data.ccEmail) parts.push(`Cc: ${data.ccEmail}\r\n`);
  parts.push(`Subject: ${encodeHeader(data.title)}\r\n`);
  parts.push(`Date: ${new Date().toUTCString().replace('GMT', '+0000')}\r\n`);
  // Outlook opens message with this header as an editable draft
  // better than received item - 
  parts.push(`X-Unsent: 1\r\n`);
  parts.push(`MIME-Version: 1.0\r\n`);
  parts.push(`Content-Type: multipart/mixed; boundary="${mixed}"\r\n\r\n`);

  parts.push(`--${mixed}\r\n`);
  parts.push(`Content-Type: multipart/alternative; boundary="${alt}"\r\n\r\n`);

  parts.push(`--${alt}\r\n`);
  parts.push(`Content-Type: text/plain; charset="UTF-8"\r\n`);
  parts.push(`Content-Transfer-Encoding: base64\r\n\r\n`);
  parts.push(wrap76(textToBase64(plain)) + `\r\n\r\n`);

  parts.push(`--${alt}\r\n`);
  parts.push(`Content-Type: text/html; charset="UTF-8"\r\n`);
  parts.push(`Content-Transfer-Encoding: base64\r\n\r\n`);
  parts.push(wrap76(textToBase64(`<html><body>${html}</body></html>`)) + `\r\n\r\n`);
  parts.push(`--${alt}--\r\n\r\n`);

  for (const e of present.entries) {
    for (const p of e.photos) {
      const blob = blobs.get(p.id);
      const b64 = bytesToBase64(new Uint8Array(await blob.arrayBuffer()));
      parts.push(`--${mixed}\r\n`);
      parts.push(`Content-Type: ${p.type || 'image/jpeg'}; name="${p.name}"\r\n`);
      parts.push(`Content-Transfer-Encoding: base64\r\n`);
      parts.push(`Content-ID: <${cidFor(p)}>\r\n`);
      parts.push(`Content-Disposition: inline; filename="${p.name}"\r\n\r\n`);
      parts.push(wrap76(b64) + `\r\n\r\n`);
    }
  }

  parts.push(`--${mixed}--\r\n`);

  const safeTitle = (data.title || 'shift_report').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const blob = new Blob(parts, { type: 'message/rfc822' });
  return { blob, filename: `${safeTitle || 'shift_report'}.eml`, missing };
}
