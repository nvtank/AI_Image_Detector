/**
 * popup.js — AI Image Detector Extension v3
 * ==========================================
 * Manages 4 views: auth | main (detect+history) | loading | result
 * Full dual-token auth: auto-refresh via background service worker
 * History: fetches last 10 predictions from GET /history
 */

const API_URL     = 'https://nvtank.dev/api';
const WEBSITE_URL = 'https://nvtank.dev';

// ── Storage helpers ───────────────────────────────────────────────────────
const storage = {
  get:    keys  => new Promise(r => chrome.storage.local.get(keys, r)),
  set:    items => new Promise(r => chrome.storage.local.set(items, r)),
  remove: keys  => new Promise(r => chrome.storage.local.remove(keys, r)),
};

const KEY_ACCESS  = 'ext_access_token';
const KEY_REFRESH = 'ext_refresh_token';
const KEY_USER    = 'ext_user';

// ── DOM ───────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const views = {
  auth:    $('view-auth'),
  main:    $('view-main'),
  loading: $('view-loading'),
  result:  $('view-result'),
};

// ── App state ─────────────────────────────────────────────────────────────
let currentUser   = null;
let accessToken   = null;
let selectedFile  = null;
let activeNavTab  = 'detect';

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const data = await storage.get([KEY_ACCESS, KEY_REFRESH, KEY_USER]);
  accessToken  = data[KEY_ACCESS]  || null;
  currentUser  = data[KEY_USER]    || null;

  if (accessToken && currentUser) {
    // Auto-refresh if needed
    const fresh = await bg('REFRESH_TOKEN');
    if (fresh?.ok) accessToken = fresh.accessToken;

    if (accessToken) {
      await enterMain();
    } else {
      showView('auth');
    }
  } else {
    showView('auth');
  }

  wireAuth();
  wireMain();
  wireResult();
});

// ═══════════════════════════════════════════════
// Auth view
// ═══════════════════════════════════════════════
function wireAuth() {
  // Tab switching
  $('tab-login').addEventListener('click', () => switchAuthTab('login'));
  $('tab-signup').addEventListener('click', () => switchAuthTab('signup'));

  // Login
  $('btn-login').addEventListener('click', doLogin);
  [$('l-email'), $('l-pass')].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  });

  // Signup
  $('btn-signup').addEventListener('click', doSignup);
}

function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  $('tab-login').classList.toggle('active', isLogin);
  $('tab-signup').classList.toggle('active', !isLogin);
  $('form-login').classList.toggle('hidden', !isLogin);
  $('form-signup').classList.toggle('hidden', isLogin);
  hideAuthErr();
}

async function doLogin() {
  const email = $('l-email').value.trim();
  const pass  = $('l-pass').value;
  if (!email || !pass) { showAuthErr('Vui lòng điền đầy đủ thông tin.'); return; }

  setAuthLoading(true, 'login');
  hideAuthErr();

  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthErr(data.detail || 'Đăng nhập thất bại.'); return; }

    await saveSession(data);
    await enterMain();
  } catch {
    showAuthErr('Không thể kết nối server. Kiểm tra kết nối mạng.');
  } finally {
    setAuthLoading(false, 'login');
  }
}

async function doSignup() {
  const name  = $('s-name').value.trim();
  const email = $('s-email').value.trim();
  const pass  = $('s-pass').value;

  if (!name || !email || !pass) { showAuthErr('Vui lòng điền đầy đủ thông tin.'); return; }
  if (pass.length < 6) { showAuthErr('Mật khẩu phải có ít nhất 6 ký tự.'); return; }

  setAuthLoading(true, 'signup');
  hideAuthErr();

  try {
    const res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: name, email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) { showAuthErr(data.detail || 'Đăng ký thất bại.'); return; }

    await saveSession(data);
    await enterMain();
  } catch {
    showAuthErr('Không thể kết nối server. Kiểm tra kết nối mạng.');
  } finally {
    setAuthLoading(false, 'signup');
  }
}

async function saveSession(data) {
  accessToken = data.access_token;
  currentUser = data.user;
  await storage.set({ [KEY_ACCESS]: data.access_token, [KEY_REFRESH]: data.refresh_token || '', [KEY_USER]: data.user });
  await bg('SAVE_SESSION', {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn: data.expires_in || 900,
    user: data.user,
  });
}

// ═══════════════════════════════════════════════
// Main view
// ═══════════════════════════════════════════════
async function enterMain() {
  showView('main');
  renderUserBar();
  await fetchAndRenderUserStats();
  switchNavTab('detect');
}

function renderUserBar() {
  if (!currentUser) return;
  $('user-name').textContent    = currentUser.full_name || currentUser.email || 'User';
  $('user-avatar').textContent  = (currentUser.full_name || currentUser.email || 'U')[0].toUpperCase();

  const tier = currentUser.subscription_tier || 'free';
  const badge = $('tier-badge');
  badge.textContent = tier.charAt(0).toUpperCase() + tier.slice(1);
  badge.className   = `tier-badge ${tier}`;

  const tokens = currentUser.tokens ?? 0;
  $('token-count').textContent = tier === 'pro' ? '∞ tokens' : `${tokens} tokens`;

  if (tokens <= 2 && tier === 'free') {
    $('token-warn').classList.remove('hidden');
  }

  // Header right: token pill
  const hdr = $('hd-right');
  hdr.innerHTML = '';
  if (tier !== 'free') {
    const pill = Object.assign(document.createElement('a'), {
      href: `${WEBSITE_URL}/billing`,
      target: '_blank',
      title: 'Xem gói cước',
      className: `token-pill ${tier}`,
    });
    pill.innerHTML = `🪙 <span>${tier === 'pro' ? '∞' : tokens}</span>`;
    hdr.appendChild(pill);
  }

  $('btn-logout').classList.remove('hidden');

  $('hd-sub').textContent = currentUser.email || 'nvtank.dev';
}

async function fetchAndRenderUserStats() {
  try {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) return;
    const user = await res.json();
    // Update stored user with fresh data
    currentUser = { ...currentUser, ...user };
    await storage.set({ [KEY_USER]: currentUser });
    renderUserBar();
  } catch { /* silent */ }
}

function wireMain() {
  // Nav tabs
  document.querySelectorAll('.ntab').forEach(btn => {
    btn.addEventListener('click', () => switchNavTab(btn.dataset.tab));
  });

  // Capture area
  $('btn-capture').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    const useGemini = $('use-gemini').checked;
    window.close();
    chrome.runtime.sendMessage({ type: 'START_CAPTURE', tabId: tab.id, windowId: tab.windowId, useGemini });
  });

  // File upload
  const zone = $('upload-zone');
  $('file-input').addEventListener('change', e => handleFile(e.target.files?.[0]));
  zone.addEventListener('click', e => {
    if (e.target !== $('clear-file')) $('file-input').click();
  });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    handleFile(e.dataTransfer.files?.[0]);
  });
  $('clear-file').addEventListener('click', e => { e.stopPropagation(); clearFile(); });

  // URL analyze
  $('btn-url').addEventListener('click', doUrlAnalyze);
  $('url-input').addEventListener('keydown', e => { if (e.key === 'Enter') doUrlAnalyze(); });

  // Analyze button
  $('btn-analyze').addEventListener('click', doFileAnalyze);

  // Logout
  $('btn-logout').addEventListener('click', doLogout);

  // Gemini toggle desc update
  $('use-gemini').addEventListener('change', e => {
    $('gemini-desc').textContent = e.target.checked
      ? 'Phân tích bổ sung bởi Gemini AI'
      : 'Chỉ dùng PyTorch model';
  });
}

function switchNavTab(tab) {
  activeNavTab = tab;
  document.querySelectorAll('.ntab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('tab-detect').classList.toggle('hidden', tab !== 'detect');
  $('tab-history').classList.toggle('hidden', tab !== 'history');
  if (tab === 'history') loadHistory();
}

// ── File handling ─────────────────────────────────────────────────────────
function handleFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) { showGlobalErr('Vui lòng chọn file ảnh hợp lệ.'); return; }
  if (file.size > 10 * 1024 * 1024) { showGlobalErr('File quá lớn. Tối đa 10MB.'); return; }

  selectedFile = file;
  $('btn-analyze').disabled = false;

  const reader = new FileReader();
  reader.onload = ev => {
    $('preview-img').src = ev.target.result;
    $('upload-placeholder').classList.add('hidden');
    $('upload-preview').classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function clearFile() {
  selectedFile = null;
  $('btn-analyze').disabled = true;
  $('upload-placeholder').classList.remove('hidden');
  $('upload-preview').classList.add('hidden');
  $('preview-img').src = '';
  $('file-input').value = '';
  $('url-input').value = '';
}

// ── URL analyze ────────────────────────────────────────────────────────────
async function doUrlAnalyze() {
  const url = $('url-input').value.trim();
  if (!url) return;
  const token = await getToken();
  if (!token) { showGlobalErr('Vui lòng đăng nhập trước.'); return; }

  showView('loading');
  updateLoadingSub('Đang tải và phân tích URL...');

  try {
    const useGemini = $('use-gemini').checked;
    const res = await fetch(`${API_URL}/predict-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ image_url: url, use_gemini: useGemini }),
    });
    if (res.status === 401) { await handleUnauthorized(); return; }
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Error ${res.status}`); }
    showResult(await res.json());
  } catch (err) {
    showView('main');
    switchNavTab('detect');
    showGlobalErr(err.message || 'Phân tích thất bại.');
  }
}

// ── File analyze ───────────────────────────────────────────────────────────
async function doFileAnalyze() {
  if (!selectedFile) return;
  const token = await getToken();
  if (!token) { showGlobalErr('Vui lòng đăng nhập trước.'); return; }

  showView('loading');
  updateLoadingSub('Đang tải lên và phân tích...');

  try {
    const useGemini = $('use-gemini').checked;
    const fd = new FormData();
    fd.append('file', selectedFile);
    if (useGemini) fd.append('use_gemini', 'true');

    const endpoint = useGemini ? `${API_URL}/predict-hybrid` : `${API_URL}/predict`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: fd,
    });

    if (res.status === 401) { await handleUnauthorized(); return; }
    if (!res.ok) { const d = await res.json(); throw new Error(d.detail || `Error ${res.status}`); }
    showResult(await res.json());
  } catch (err) {
    showView('main');
    switchNavTab('detect');
    showGlobalErr(err.message || 'Phân tích thất bại.');
  }
}

// ── History ────────────────────────────────────────────────────────────────
async function loadHistory() {
  const list = $('history-list');
  list.innerHTML = `<div class="history-loading" id="history-loading"><div class="mini-spinner"></div> Đang tải lịch sử...</div>`;

  const token = await getToken();
  if (!token) {
    list.innerHTML = `<div style="color:#475569;font-size:12px;padding:12px 0">Vui lòng đăng nhập để xem lịch sử.</div>`;
    return;
  }

  try {
    const res = await fetch(`${API_URL}/history?limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    const items = data.predictions || data || [];

    if (!items.length) {
      list.innerHTML = `<div style="color:#475569;font-size:12px;padding:12px 0;text-align:center">Chưa có lịch sử phân tích nào.</div>`;
      return;
    }

    list.innerHTML = items.map(item => {
      const decision = item.final_decision || item.label || '?';
      const conf     = ((item.confidence || 0) * 100).toFixed(0);
      const model    = item.model_name || '';
      const date     = new Date(item.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      const cls      = decision === 'FAKE' ? 'fake' : decision === 'REAL' ? 'real' : 'uncertain';
      const thumb    = item.image_url
        ? `<img class="hi-thumb" src="${item.image_url}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
        : '';

      return `<div class="history-item">
        ${thumb}
        <div class="hi-thumb-placeholder" style="${item.image_url ? 'display:none' : ''}">🖼</div>
        <div class="hi-info">
          <div class="hi-label ${cls}">${decision}</div>
          <div class="hi-meta">${date} • ${model}</div>
        </div>
        <div class="hi-conf">${conf}%</div>
      </div>`;
    }).join('');

  } catch {
    list.innerHTML = `<div style="color:#475569;font-size:12px;padding:12px 0">Không tải được lịch sử.</div>`;
  }
}

// ═══════════════════════════════════════════════
// Result view
// ═══════════════════════════════════════════════
function wireResult() {
  $('btn-back').addEventListener('click', () => {
    showView('main');
    switchNavTab('detect');
    fetchAndRenderUserStats(); // refresh token count after analysis
  });
}

function showResult(data) {
  const hasHybrid = !!data.final_decision;
  const decision  = hasHybrid ? data.final_decision : data.label;
  const isFake    = decision === 'FAKE';
  const isUncert  = decision === 'UNCERTAIN';

  const local = hasHybrid ? (data.local_model || {}) : data;
  const conf  = ((local.confidence ?? 0) * 100).toFixed(1);
  const fakeP = ((local.fake_probability ?? 0) * 100).toFixed(1);
  const realP = ((local.real_probability ?? 0) * 100).toFixed(1);
  const model = local.model_name || data.model_name || '—';
  const timeMs = local.processing_time_ms || data.processing_time_ms || 0;

  // Header
  const hd = $('result-header');
  hd.className = `result-hd ${isFake ? 'fake' : isUncert ? 'uncertain' : 'real'}`;
  $('result-label').textContent = decision;
  $('result-sub').textContent = isFake ? 'Ảnh do AI tạo ra' : isUncert ? 'Không xác định' : 'Ảnh thật';

  // Model section
  $('result-model-name').textContent = hasHybrid ? `PyTorch Model (${local.predicted_label || decision})` : 'Model';
  $('r-conf').textContent  = `${conf}%`;
  $('r-fake').textContent  = `${fakeP}%`;
  $('r-real').textContent  = `${realP}%`;
  $('bar-fake').style.width = `${fakeP}%`;
  $('bar-real').style.width = `${realP}%`;
  $('r-model').textContent = model;
  $('r-time').textContent  = `${timeMs}ms`;

  // Gemini section
  const gemini = hasHybrid && data.gemini_analysis && !data.gemini_analysis.error ? data.gemini_analysis : null;
  const geminiSection = $('gemini-section');
  if (gemini) {
    geminiSection.classList.remove('hidden');
    $('g-label').textContent  = gemini.predicted_label || '?';
    $('g-reason').textContent = gemini.reasoning_summary || '';
    const sigList = $('g-signals');
    sigList.innerHTML = (gemini.visual_signals || []).slice(0, 4).map(s => `<li>• ${s}</li>`).join('');
  } else {
    geminiSection.classList.add('hidden');
  }

  // Recommendation
  const recSection = $('rec-section');
  if (hasHybrid && data.recommendation) {
    recSection.classList.remove('hidden');
    $('rec-text').textContent = `"${data.recommendation}"`;
  } else {
    recSection.classList.add('hidden');
  }

  showView('result');
}

// ═══════════════════════════════════════════════
// Token & session helpers
// ═══════════════════════════════════════════════
async function getToken() {
  // Ask background to refresh if needed
  const fresh = await bg('REFRESH_TOKEN');
  if (fresh?.ok && fresh.accessToken) {
    accessToken = fresh.accessToken;
    return accessToken;
  }
  return accessToken;
}

async function handleUnauthorized() {
  await doLogout();
  showGlobalErr('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
}

async function doLogout() {
  try {
    const token = await storage.get([KEY_ACCESS]);
    const refreshData = await storage.get(['ext_refresh_token']);
    if (refreshData.ext_refresh_token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token[KEY_ACCESS]}` },
        body: JSON.stringify({ refresh_token: refreshData.ext_refresh_token }),
      }).catch(() => {});
    }
  } catch { /* silent */ }

  await storage.remove([KEY_ACCESS, 'ext_refresh_token', 'ext_token_expiry', KEY_USER]);
  await bg('CLEAR_SESSION');
  accessToken  = null;
  currentUser  = null;
  selectedFile = null;

  $('btn-logout').classList.add('hidden');
  $('hd-right').innerHTML = '';
  $('hd-sub').textContent = 'nvtank.dev';
  showView('auth');
  switchAuthTab('login');
}

// ═══════════════════════════════════════════════
// View management
// ═══════════════════════════════════════════════
function showView(name) {
  Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== name));
}

function updateLoadingSub(text) { $('loading-sub').textContent = text; }

// ═══════════════════════════════════════════════
// Error helpers
// ═══════════════════════════════════════════════
function showAuthErr(msg) {
  $('auth-err').textContent = msg;
  $('auth-err').classList.remove('hidden');
}
function hideAuthErr() { $('auth-err').classList.add('hidden'); }

let errTimer;
function showGlobalErr(msg) {
  const el = $('global-err');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(errTimer);
  errTimer = setTimeout(() => el.classList.add('hidden'), 4000);
}

function setAuthLoading(loading, which) {
  const btn = $(which === 'login' ? 'btn-login' : 'btn-signup');
  btn.disabled = loading;
  btn.textContent = loading ? (which === 'login' ? 'Đang đăng nhập...' : 'Đang tạo tài khoản...') : (which === 'login' ? 'Đăng nhập' : 'Tạo tài khoản');
}

// ═══════════════════════════════════════════════
// Background messaging helper
// ═══════════════════════════════════════════════
function bg(type, payload = {}) {
  return new Promise(resolve => {
    try {
      chrome.runtime.sendMessage({ type, ...payload }, response => {
        if (chrome.runtime.lastError) { resolve(null); return; }
        resolve(response);
      });
    } catch { resolve(null); }
  });
}
