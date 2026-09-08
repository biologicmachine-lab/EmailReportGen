// photos capture, downscale, store, and thumbnails.

import { putPhoto, getPhoto, deletePhoto } from './db.js';
import { state, findEntry, saveNow, scheduleSave } from './state.js';
import { alertBanner, setStatus } from './ui.js';

/* Tuning. A 4032x3024 phone-photo which was around 2.5 MB. 
   At 1800px long edge can still read details,
   and the file lands near 300 KB. Raise MAX_EDGE if  zoom is needed
   further into details; theere is the storage headroom */
const MAX_EDGE = 1800;
const TARGET_BYTES = 500 * 1024;
const START_QUALITY = 0.85;
const MIN_QUALITY = 0.55;

const thumbUrls = new Map();   // photoId -> object URL

function nextPhotoId() {
  return 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

async function decode(file) {
  // imageOrientation respects the EXIF rotation flag, sideways taken photos
  // don't land sideways in the report.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await createImageBitmap(file);
  }
}

function canvasToBlob(canvas, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}

// Downscale to the budget, dropping quality only as far as needed.
async function shrink(file) {
  const bmp = await decode(file);
  let w = bmp.width, h = bmp.height;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  let quality = START_QUALITY;
  let blob = await canvasToBlob(canvas, quality);
  while (blob && blob.size > TARGET_BYTES && quality > MIN_QUALITY) {
    quality = Math.max(MIN_QUALITY, quality - 0.08);
    blob = await canvasToBlob(canvas, quality);
  }
  if (!blob) throw new Error('Could not process that image');
  return { blob, width: w, height: h };
}

export async function attachPhotos(entryId, files) {
  const entry = findEntry(entryId);
  if (!entry || !files.length) return;

  setStatus(`Processing ${files.length} photo${files.length === 1 ? '' : 's'}…`);

  let added = 0;
  for (const file of files) {
    try {
      const { blob, width, height } = await shrink(file);
      const id = nextPhotoId();
      await putPhoto(id, blob);
      entry.photos.push({
        id,
        name: file.name || `photo_${added + 1}.jpg`,
        type: 'image/jpeg',
        bytes: blob.size,
        width,
        height
      });
      added++;
    } catch (err) {
      alertBanner(`Could not add ${file.name || 'a photo'}: ${err.message}`);
    }
  }

  if (added) {
    // Save immediately, not on the debounce timer. iOS can suspend the page
    // the moment the camera hands control back, and a 400ms wait is exactly
    // the window where a photo goes missing.
    saveNow();
    setStatus(`Added ${added} photo${added === 1 ? '' : 's'}.`);
  }
  return added;
}

export async function removePhoto(entryId, photoId) {
  const entry = findEntry(entryId);
  if (!entry) return;
  entry.photos = entry.photos.filter(p => p.id !== photoId);
  releaseThumb(photoId);
  try { await deletePhoto(photoId); } catch { /* blob already gone */ }
  scheduleSave();
}

export async function thumbUrl(photoId) {
  if (thumbUrls.has(photoId)) return thumbUrls.get(photoId);
  const blob = await getPhoto(photoId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  thumbUrls.set(photoId, url);
  return url;
}

export function releaseThumb(photoId) {
  const url = thumbUrls.get(photoId);
  if (url) {
    URL.revokeObjectURL(url);
    thumbUrls.delete(photoId);
  }
}

export function releaseAllThumbs() {
  for (const url of thumbUrls.values()) URL.revokeObjectURL(url);
  thumbUrls.clear();
}

export function photoCount() {
  return state.entries.reduce((n, e) => n + e.photos.length, 0);
}
