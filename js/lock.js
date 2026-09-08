/*Screen lock, hash in the source -devTools can bypass*/
/*Not for private info*/
const UNLOCK_KEY = 'shiftReportUnlocked';
const PASSWORD_HASH = '6ca13d52ca70c883e0f0bb101e425a89e8624de51db2d2392593af6a84118090';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function showApp() {
  document.getElementById('lockScreen').style.display = 'none';
  document.getElementById('appRoot').style.display = 'block';
}

export function lockApp() {
  localStorage.removeItem(UNLOCK_KEY);
  sessionStorage.removeItem(UNLOCK_KEY);
  document.getElementById('lockPassword').value = '';
  document.getElementById('appRoot').style.display = 'none';
  document.getElementById('lockScreen').style.display = 'flex';
}

async function tryUnlock() {
  const input = document.getElementById('lockPassword').value;
  if (await sha256(input) === PASSWORD_HASH) {
    const remember = document.getElementById('rememberDevice').checked;
    (remember ? localStorage : sessionStorage).setItem(UNLOCK_KEY, '1');
    document.getElementById('lockError').textContent = '';
    showApp();
  } else {
    document.getElementById('lockError').textContent = 'That password does not match. Try again.';
  }
}

export function initLock() {
  document.getElementById('lockForm').addEventListener('submit', evt => {
    evt.preventDefault();
    tryUnlock();
  });
  if (localStorage.getItem(UNLOCK_KEY) === '1' || sessionStorage.getItem(UNLOCK_KEY) === '1') {
    showApp();
  }
}
