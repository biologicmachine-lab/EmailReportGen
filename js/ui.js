import { estimate } from './db.js';

export function setStatus(msg, isErr) {
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = msg;
  el.className = isErr ? 'err' : 'ok';
}

// A failed save used to vanish into a hint line nobody reads. This does not.
export function alertBanner(msg) {
  let el = document.getElementById('alertBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'alertBanner';
    el.className = 'alert-banner';
    el.addEventListener('click', () => { el.style.display = 'none'; });
    document.body.appendChild(el);
  }
  el.textContent = msg + '  (tap to dismiss)';
  el.style.display = 'block';
  if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
}

export function hideBanner() {
  const el = document.getElementById('alertBanner');
  if (el) el.style.display = 'none';
}

export function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

export async function updateMeter(photoCount, photoBytes) {
  const txt = document.getElementById('meterText');
  const bar = document.getElementById('meterBar');
  if (!txt || !bar) return;

  const est = await estimate();
  const label = `${photoCount} photo${photoCount === 1 ? '' : 's'}, ${formatBytes(photoBytes)}`;

  if (est && est.quota) {
    const pct = Math.min(100, (est.usage / est.quota) * 100);
    bar.style.width = Math.max(pct, 0.5) + '%';
    bar.style.background = pct >= 90 ? 'var(--danger)'
                         : pct >= 75 ? 'var(--warn)'
                         : 'var(--success)';
    txt.textContent = `${label} — using ${formatBytes(est.usage)} of ` +
                      `${formatBytes(est.quota)} available on this device`;
  } else {
    bar.style.width = '100%';
    bar.style.background = 'var(--border)';
    txt.textContent = label;
  }
}
