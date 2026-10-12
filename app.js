const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

async function copyText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
    else {
      const field = document.createElement('textarea');
      field.value = value; field.style.position = 'fixed'; field.style.opacity = '0';
      document.body.append(field); field.select();
      const copied = document.execCommand('copy'); field.remove();
      if (!copied) throw new Error('Clipboard unavailable');
    }
    toast('Copied to clipboard');
  } catch { toast('Could not access clipboard'); }
}

$$('[data-toggle]').forEach(button => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.toggle);
  input.type = input.type === 'password' ? 'text' : 'password';
  button.setAttribute('aria-label', input.type === 'password' ? 'Show password' : 'Hide password');
}));

// A local estimate based on length, character variety, and common weak patterns.
const commonPasswords = new Set(['password','password1','123456','12345678','qwerty','letmein','admin','welcome','iloveyou','abc123','monkey','dragon','football']);
function scorePassword(value) {
  if (!value) return { score: 0, tips: [] };
  const tips = [];
  if (value.length < 12) tips.push('Use at least 12 characters.');
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) tips.push('Mix uppercase and lowercase letters.');
  if (!/\d/.test(value)) tips.push('Add a number.');
  if (!/[^A-Za-z0-9]/.test(value)) tips.push('Add a symbol.');
  const lower = value.toLowerCase();
  if (commonPasswords.has(lower)) tips.unshift('This is a commonly used password.');
  if (/(.)\1{2,}/.test(value) || /1234|abcd|qwerty/i.test(value)) tips.push('Avoid repeated or predictable sequences.');
  const classes = [/[a-z]/.test(value),/[A-Z]/.test(value),/\d/.test(value),/[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
  let score = Math.min(4, Math.floor(value.length / 6)) + Math.max(0, classes - 1);
  if (tips[0] === 'This is a commonly used password.') score = 0;
  if (/(.)\1{2,}|1234|abcd|qwerty/i.test(value)) score -= 2;
  score = Math.max(0, Math.min(4, score));
  return { score, tips };
}
$('#check-password').addEventListener('input', event => {
  const { score, tips } = scorePassword(event.target.value);
  const labels = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  const colors = ['#e16c72', '#e18a67', '#dfbc65', '#8dcf79', '#58d6a1'];
  const bar = $('#strength-bar');
  bar.style.width = event.target.value ? `${Math.max(8, (score + 1) * 20)}%` : '0%';
  bar.style.background = colors[score];
  $('#strength-label').textContent = event.target.value ? labels[score] : 'Enter a password to begin';
  $('#strength-score').textContent = event.target.value ? `${score}/4` : '—';
  $('#strength-tips').textContent = tips.slice(0, 2).join(' ');
});

function secureRandomIndex(max) {
  const ceiling = Math.floor(0x100000000 / max) * max;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= ceiling);
  return value[0] % max;
}
function generatePassword() {
  const sets = [];
  if ($('#opt-upper').checked) sets.push('ABCDEFGHJKLMNPQRSTUVWXYZ');
  if ($('#opt-lower').checked) sets.push('abcdefghijkmnopqrstuvwxyz');
  if ($('#opt-numbers').checked) sets.push('23456789');
  if ($('#opt-symbols').checked) sets.push('!@#$%^&*()-_=+[]{}:,.?');
  if (!sets.length) { toast('Select at least one character set'); return; }
  const pool = [...new Set(sets.join(''))];
  const output = sets.map(set => set[secureRandomIndex(set.length)]);
  while (output.length < Number($('#password-length').value)) output.push(pool[secureRandomIndex(pool.length)]);
  for (let i = output.length - 1; i > 0; i--) {
    const j = secureRandomIndex(i + 1);
    [output[i], output[j]] = [output[j], output[i]];
  }
  $('#generated-password').value = output.join('');
}
$('#password-length').addEventListener('input', event => { $('#length-value').textContent = event.target.value; generatePassword(); });
$$('.options-row input').forEach(input => input.addEventListener('change', generatePassword));
$('#generate-password').addEventListener('click', generatePassword);
$('#copy-generated').addEventListener('click', () => $('#generated-password').value && copyText($('#generated-password').value));
generatePassword();

$('#hash-button').addEventListener('click', async () => {
  const output = $('#hash-result');
  if (!window.crypto?.subtle) { output.textContent = 'Web Crypto requires a secure context (HTTPS or localhost).'; return; }
  try {
    const data = new TextEncoder().encode($('#hash-input').value);
    const digest = await crypto.subtle.digest($('#hash-algorithm').value, data);
    output.textContent = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  } catch (error) { output.textContent = `Unable to calculate hash: ${error.message}`; }
});

let base64Mode = 'encode';
$$('[data-b64-mode]').forEach(button => button.addEventListener('click', () => {
  base64Mode = button.dataset.b64Mode;
  $$('[data-b64-mode]').forEach(item => item.classList.toggle('selected', item === button));
}));
function encodeBase64(text) { return btoa(Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join('')); }
function decodeBase64(text) {
  const binary = atob(text.replace(/\s/g, ''));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}
$('#base64-button').addEventListener('click', () => {
  try { $('#base64-result').textContent = base64Mode === 'encode' ? encodeBase64($('#base64-input').value) : decodeBase64($('#base64-input').value); }
  catch { $('#base64-result').textContent = 'Invalid Base64 or text is not valid UTF-8.'; }
});

let urlMode = 'decode';
$$('[data-url-mode]').forEach(button => button.addEventListener('click', () => {
  urlMode = button.dataset.urlMode;
  $$('[data-url-mode]').forEach(item => item.classList.toggle('selected', item === button));
}));
$('#url-button').addEventListener('click', () => {
  try { $('#url-result').textContent = urlMode === 'encode' ? encodeURIComponent($('#url-input').value) : decodeURIComponent($('#url-input').value.replace(/\+/g, '%20')); }
  catch { $('#url-result').textContent = 'Could not decode this URL component. Check for malformed percent escapes.'; }
});

function decodeJwtPart(part) {
  const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}
function escapeHtml(text) { return text.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
$('#jwt-button').addEventListener('click', () => {
  const result = $('#jwt-result');
  const parts = $('#jwt-input').value.trim().split('.');
  if (parts.length !== 3 || parts.some(part => !part)) { result.innerHTML = '<span class="empty-state">Enter a compact JWT with three dot-separated parts.</span>'; return; }
  try {
    const header = decodeJwtPart(parts[0]);
    const payload = decodeJwtPart(parts[1]);
    const pretty = value => escapeHtml(JSON.stringify(value, null, 2));
    let expiry = '';
    if (typeof payload.exp === 'number') {
      const expired = payload.exp * 1000 < Date.now();
      expiry = `<div class="jwt-status ${expired ? '' : 'ok'}">${expired ? 'Expired' : 'Expiration is in the future'} · ${escapeHtml(new Date(payload.exp * 1000).toLocaleString())}</div>`;
    } else expiry = '<div class="jwt-status">No exp claim found</div>';
    result.innerHTML = `<div class="jwt-block"><h4>HEADER</h4><pre>${pretty(header)}</pre></div><div class="jwt-block"><h4>PAYLOAD</h4><pre>${pretty(payload)}</pre></div>${expiry}<div class="jwt-status">Decoded only. Signature is not verified.</div>`;
  } catch { result.innerHTML = '<span class="empty-state">Could not decode this token. Check that its header and payload are valid Base64URL JSON.</span>'; }
});

// Cards expose copy for generated/calculated output with keyboard-friendly double click.
['#hash-result','#base64-result','#url-result'].forEach(selector => $(selector).addEventListener('dblclick', event => {
  if (!event.currentTarget.textContent.includes('will appear') && !event.currentTarget.textContent.startsWith('Invalid') && !event.currentTarget.textContent.startsWith('Could not')) copyText(event.currentTarget.textContent);
}));

// Keep the active overview marker in sync with in-page navigation.
$$('.nav-link').forEach(link => link.addEventListener('click', () => {
  $$('.nav-link').forEach(item => item.classList.remove('active'));
  link.classList.add('active');
}));
