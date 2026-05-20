const API_URL = 'http://localhost:8000';

// ── DOM refs ──────────────────────────────────────────────────────────────
const authSection   = document.getElementById('authSection');
const mainSection   = document.getElementById('mainSection');
const userEmail     = document.getElementById('userEmail');
const authError     = document.getElementById('authError');

const tabLogin      = document.getElementById('tabLogin');
const tabSignup     = document.getElementById('tabSignup');
const loginForm     = document.getElementById('loginForm');
const signupForm    = document.getElementById('signupForm');

const loginEmail    = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn      = document.getElementById('loginBtn');

const signupName    = document.getElementById('signupName');
const signupEmail   = document.getElementById('signupEmail');
const signupPassword= document.getElementById('signupPassword');
const signupBtn     = document.getElementById('signupBtn');

const captureBtn    = document.getElementById('captureBtn');
const logoutBtn     = document.getElementById('logoutBtn');

const uploadArea    = document.getElementById('uploadArea');
const fileInput     = document.getElementById('fileInput');
const previewContainer = document.getElementById('previewContainer');
const imagePreview  = document.getElementById('imagePreview');
const placeholderText = document.getElementById('placeholderText');
const analyzeBtn    = document.getElementById('analyzeBtn');

const loadingBox    = document.getElementById('loading');
const errorBox      = document.getElementById('errorBox');
const resultBox     = document.getElementById('resultBox');
const resultHeader  = document.getElementById('resultHeader');
const resultLabel   = document.getElementById('resultLabel');
const resultConfidence = document.getElementById('resultConfidence');
const resultModel   = document.getElementById('resultModel');
const resultTime    = document.getElementById('resultTime');

let selectedFile = null;

// ── Initialise ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const { access_token, auth_user } = await storage.get(['access_token', 'auth_user']);
  if (access_token && auth_user) {
    showMainSection(auth_user);
  }
});

// ── Auth tab switching ─────────────────────────────────────────────────────
tabLogin.addEventListener('click', () => {
  tabLogin.classList.add('active');
  tabSignup.classList.remove('active');
  loginForm.classList.remove('hidden');
  signupForm.classList.add('hidden');
  clearAuthError();
});

tabSignup.addEventListener('click', () => {
  tabSignup.classList.add('active');
  tabLogin.classList.remove('active');
  signupForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
  clearAuthError();
});

// ── Login ─────────────────────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  clearAuthError();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) { showAuthError('Fill in all fields.'); return; }

  loginBtn.textContent = 'Signing in…';
  loginBtn.disabled = true;
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.detail || 'Login failed.'); return; }

    await storage.set({ access_token: data.access_token, auth_user: data.user });
    chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token: data.access_token });
    showMainSection(data.user);
  } catch {
    showAuthError('Cannot reach backend. Is it running?');
  } finally {
    loginBtn.textContent = 'Sign In';
    loginBtn.disabled = false;
  }
});

// ── Signup ────────────────────────────────────────────────────────────────
signupBtn.addEventListener('click', async () => {
  clearAuthError();
  const name  = signupName.value.trim();
  const email = signupEmail.value.trim();
  const pass  = signupPassword.value;
  if (!name || !email || !pass) { showAuthError('Fill in all fields.'); return; }
  if (pass.length < 6) { showAuthError('Password must be at least 6 characters.'); return; }

  signupBtn.textContent = 'Creating…';
  signupBtn.disabled = true;
  try {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthError(data.detail || 'Signup failed.'); return; }

    await storage.set({ access_token: data.access_token, auth_user: data.user });
    chrome.runtime.sendMessage({ type: 'SAVE_TOKEN', token: data.access_token });
    showMainSection(data.user);
  } catch {
    showAuthError('Cannot reach backend. Is it running?');
  } finally {
    signupBtn.textContent = 'Create Account';
    signupBtn.disabled = false;
  }
});

// ── Logout ────────────────────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  await storage.remove(['access_token', 'auth_user']);
  chrome.runtime.sendMessage({ type: 'CLEAR_TOKEN' });
  showAuthSection();
});

// ── Capture Area ──────────────────────────────────────────────────────────
captureBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  // Close popup so overlay is visible
  window.close();

  chrome.runtime.sendMessage({
    type: 'START_CAPTURE_AREA',
    tabId: tab.id,
    windowId: tab.windowId,
  });
});

// ── File upload ───────────────────────────────────────────────────────────
uploadArea.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showError('Please select a valid image.'); return;
  }
  selectedFile = file;
  analyzeBtn.disabled = false;
  hideError();
  hideResult();
  const reader = new FileReader();
  reader.onload = (ev) => {
    imagePreview.src = ev.target.result;
    previewContainer.style.display = 'block';
    placeholderText.style.display = 'none';
  };
  reader.readAsDataURL(file);
});

analyzeBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  const token = (await storage.get(['access_token'])).access_token;
  if (!token) { showError('Please log in first.'); return; }

  analyzeBtn.disabled = true;
  hideError();
  hideResult();
  loadingBox.classList.remove('hidden');

  try {
    const formData = new FormData();
    formData.append('file', selectedFile);

    const res = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });

    if (res.status === 401) { showError('Session expired. Please log in again.'); return; }
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Error ${res.status}`); }

    showResult(await res.json());
  } catch (err) {
    showError(err.message || 'Failed. Is the backend running?');
  } finally {
    loadingBox.classList.add('hidden');
    analyzeBtn.disabled = false;
  }
});

// ── UI helpers ─────────────────────────────────────────────────────────────
function showMainSection(user) {
  authSection.classList.add('hidden');
  mainSection.classList.remove('hidden');
  userEmail.textContent = user.email;
  userEmail.classList.remove('hidden');
}

function showAuthSection() {
  mainSection.classList.add('hidden');
  authSection.classList.remove('hidden');
  userEmail.classList.add('hidden');
  loginEmail.value = '';
  loginPassword.value = '';
  signupName.value = '';
  signupEmail.value = '';
  signupPassword.value = '';
  hideError();
  hideResult();
}

function showResult(data) {
  resultBox.classList.remove('hidden');
  resultLabel.textContent = data.label;
  resultHeader.className = 'result-header ' + (data.label === 'FAKE' ? 'fake' : 'real');
  resultConfidence.textContent = (data.confidence * 100).toFixed(2) + '%';
  resultModel.textContent = data.model_name;
  resultTime.textContent = data.processing_time_ms + ' ms';
}

function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove('hidden');
}

function hideError() { errorBox.classList.add('hidden'); }
function hideResult() { resultBox.classList.add('hidden'); }

function showAuthError(msg) {
  authError.textContent = msg;
  authError.classList.remove('hidden');
}

function clearAuthError() { authError.classList.add('hidden'); }

// ── Storage wrapper (promise-based) ───────────────────────────────────────
const storage = {
  get: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
  set: (items) => new Promise((r) => chrome.storage.local.set(items, r)),
  remove: (keys) => new Promise((r) => chrome.storage.local.remove(keys, r)),
};
