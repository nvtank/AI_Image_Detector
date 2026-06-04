/**
 * background.js — AI Image Detector Extension v3
 * ================================================
 * MV3 Service Worker — ALL state lives in chrome.storage, never global vars.
 *
 * Handles:
 *  • Context menu: right-click any image → detect AI
 *  • Capture Area flow: inject crop overlay → screenshot → crop → upload → overlay result
 *  • Messages from popup: LOGIN, LOGOUT, SAVE_TOKENS, START_CAPTURE, CROP_SELECTED
 *  • Token refresh: auto-refresh access token using refresh token
 */

const API_URL     = 'https://nvtank.dev/api';
const WEBSITE_URL = 'https://nvtank.dev';

// ── Storage keys ────────────────────────────────────────────────────────────
const KEY_ACCESS  = 'ext_access_token';
const KEY_REFRESH = 'ext_refresh_token';
const KEY_EXPIRY  = 'ext_token_expiry';   // Unix timestamp (seconds)
const KEY_USER    = 'ext_user';

// ── Context menus setup ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'ai-detect-image',
      title: '🔍 Detect AI Image',
      contexts: ['image'],
    });
    chrome.contextMenus.create({
      id: 'ai-detect-link',
      title: '🔍 Detect AI Image (from link)',
      contexts: ['link'],
    });
    chrome.contextMenus.create({
      id: 'ai-open-website',
      title: '🌐 Open AI Detector Website',
      contexts: ['action'],
    });
  });
});

// ── Context menu click ──────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'ai-open-website') {
    chrome.tabs.create({ url: WEBSITE_URL });
    return;
  }

  const imageUrl = info.srcUrl || info.linkUrl;
  if (!imageUrl) return;

  const notifId = `ai-det-${Date.now()}`;

  await showNotif(notifId + '-loading', '⏳ Phân tích ảnh...', 'Đang gửi lên server...');

  try {
    const token = await getValidAccessToken();

    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/predict-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image_url: imageUrl }),
    });

    chrome.notifications.clear(notifId + '-loading');

    if (res.status === 401) {
      await showNotif(notifId + '-err', '🔒 Cần đăng nhập', 'Vui lòng đăng nhập trong popup extension trước.');
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Server ${res.status}`);
    }

    const data = await res.json();
    const decision = data.final_decision || data.label;
    const conf = ((data.local_model?.confidence || data.confidence || 0) * 100).toFixed(1);
    const isFake = decision === 'FAKE';

    await showNotif(
      notifId + '-result',
      `${isFake ? '🚨 AI GENERATED' : '✅ AUTHENTIC'} — ${decision}`,
      `Confidence: ${conf}%  •  ${data.local_model?.model_name || data.model_name || ''}`
    );

    // Also inject overlay onto the tab if we have permission
    if (tab?.id) {
      try {
        await injectResult(tab.id, data);
      } catch (_) { /* page may not allow scripting */ }
    }

  } catch (err) {
    chrome.notifications.clear(notifId + '-loading');
    await showNotif(notifId + '-err', '❌ Lỗi phân tích', err.message || 'Không thể kết nối backend.');
  }
});

// ── Message handler ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {

      case 'SAVE_SESSION': {
        const { accessToken, refreshToken, expiresIn = 900, user } = message;
        const expiry = Math.floor(Date.now() / 1000) + expiresIn;
        await chrome.storage.local.set({
          [KEY_ACCESS]:  accessToken,
          [KEY_REFRESH]: refreshToken,
          [KEY_EXPIRY]:  expiry,
          [KEY_USER]:    user,
        });
        sendResponse({ ok: true });
        break;
      }

      case 'CLEAR_SESSION': {
        await chrome.storage.local.remove([KEY_ACCESS, KEY_REFRESH, KEY_EXPIRY, KEY_USER]);
        sendResponse({ ok: true });
        break;
      }

      case 'GET_SESSION': {
        const data = await chrome.storage.local.get([KEY_ACCESS, KEY_REFRESH, KEY_EXPIRY, KEY_USER]);
        sendResponse({
          accessToken:  data[KEY_ACCESS]  || null,
          refreshToken: data[KEY_REFRESH] || null,
          expiry:       data[KEY_EXPIRY]  || null,
          user:         data[KEY_USER]    || null,
        });
        break;
      }

      case 'REFRESH_TOKEN': {
        const newToken = await refreshAccessToken();
        sendResponse({ ok: !!newToken, accessToken: newToken });
        break;
      }

      case 'START_CAPTURE': {
        const { tabId, windowId, useGemini } = message;
        // Store capture state in chrome.storage.session (ephemeral, cleared on browser close)
        await chrome.storage.session.set({ captureTabId: tabId, captureWindowId: windowId, captureUseGemini: useGemini });
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ['content/crop-selector.js'] });
          sendResponse({ ok: true });
        } catch (e) {
          await chrome.storage.session.remove(['captureTabId', 'captureWindowId', 'captureUseGemini']);
          sendResponse({ ok: false, error: 'Cannot inject script on this page.' });
        }
        break;
      }

      case 'CROP_SELECTED': {
        await handleCropSelected(message.selection, sender);
        sendResponse({ ok: true });
        break;
      }

      case 'CROP_CANCELLED': {
        await chrome.storage.session.remove(['captureTabId', 'captureWindowId', 'captureUseGemini']);
        sendResponse({ ok: true });
        break;
      }

      default:
        sendResponse({ ok: false, error: 'Unknown message type' });
    }
  })();
  return true; // keep channel open for async sendResponse
});

// ── Capture area flow ────────────────────────────────────────────────────────
async function handleCropSelected(selection, sender) {
  const session = await chrome.storage.session.get(['captureTabId', 'captureWindowId', 'captureUseGemini']);
  const tabId     = sender.tab?.id    || session.captureTabId;
  const windowId  = sender.tab?.windowId || session.captureWindowId;
  const useGemini = session.captureUseGemini ?? true;

  await chrome.storage.session.remove(['captureTabId', 'captureWindowId', 'captureUseGemini']);

  if (!tabId) return;

  // Show loading overlay
  await injectResult(tabId, { _loading: true });

  try {
    const token = await getValidAccessToken();
    if (!token) {
      await injectResult(tabId, { _error: '🔒 Vui lòng đăng nhập trong popup extension trước.' });
      return;
    }

    // Capture visible tab
    let screenshotDataUrl;
    try {
      screenshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch (e) {
      await injectResult(tabId, { _error: '❌ Không thể chụp tab này. Thử trên trang web thông thường.' });
      return;
    }

    // Crop + upload
    const blob   = await cropDataUrl(screenshotDataUrl, selection);
    const result = await uploadBlob(blob, token, useGemini);

    await injectResult(tabId, result);

  } catch (err) {
    const msg = err.message === 'UNAUTHORIZED'
      ? '🔒 Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.'
      : `❌ ${err.message || 'Phân tích thất bại.'}`;
    await injectResult(tabId, { _error: msg });
  }
}

// ── Inject result/loading/error overlay ──────────────────────────────────────
async function injectResult(tabId, result) {
  if (result._loading) {
    await chrome.scripting.executeScript({ target: { tabId }, func: showLoadingOverlay });
  } else if (result._error) {
    await chrome.scripting.executeScript({ target: { tabId }, func: showErrorOverlay, args: [result._error] });
  } else {
    await chrome.scripting.executeScript({ target: { tabId }, func: showResultOverlay, args: [result] });
  }
}

function showLoadingOverlay() {
  document.getElementById('__ai_det__')?.remove();
  const host = Object.assign(document.createElement('div'), { id: '__ai_det__' });
  Object.assign(host.style, {
    position: 'fixed', top: '20px', right: '20px', zIndex: '2147483647',
    fontFamily: 'system-ui,sans-serif', background: 'rgba(15,23,42,0.97)',
    color: '#f1f5f9', borderRadius: '14px', padding: '16px 22px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', gap: '12px', fontSize: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    animation: '__ai_slidein 0.25s ease',
  });
  const style = document.createElement('style');
  style.textContent = `@keyframes __ai_slidein{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
    @keyframes __ai_spin{to{transform:rotate(360deg)}}`;
  document.head.appendChild(style);
  host.innerHTML = `<div style="width:20px;height:20px;border:3px solid rgba(255,255,255,0.15);border-top-color:#3b82f6;border-radius:50%;animation:__ai_spin 0.7s linear infinite;flex-shrink:0"></div>
    <span>Đang phân tích vùng chọn...</span>`;
  document.body.appendChild(host);
}

function showErrorOverlay(msg) {
  document.getElementById('__ai_det__')?.remove();
  const host = Object.assign(document.createElement('div'), { id: '__ai_det__' });
  Object.assign(host.style, {
    position: 'fixed', top: '20px', right: '20px', zIndex: '2147483647',
    fontFamily: 'system-ui,sans-serif', background: 'rgba(127,29,29,0.97)',
    color: '#fecaca', borderRadius: '14px', padding: '16px 20px',
    boxShadow: '0 8px 40px rgba(0,0,0,0.6)', maxWidth: '300px',
    fontSize: '13px', lineHeight: '1.5', border: '1px solid rgba(239,68,68,0.3)',
  });
  host.innerHTML = `<div>${msg}</div>
    <button onclick="this.parentNode.remove()" style="display:block;margin-top:10px;background:rgba(255,255,255,0.1);border:none;color:#fecaca;padding:5px 14px;border-radius:6px;cursor:pointer;font-size:12px;">Đóng ✕</button>`;
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 10000);
}

function showResultOverlay(r) {
  document.getElementById('__ai_det__')?.remove();

  const hasHybrid = !!r.final_decision;
  const decision  = hasHybrid ? r.final_decision : r.label;
  const isFake    = decision === 'FAKE';
  const isUncert  = decision === 'UNCERTAIN';

  const accent = isFake ? '#ef4444' : isUncert ? '#f59e0b' : '#22c55e';
  const bgAccent = isFake ? 'rgba(239,68,68,0.13)' : isUncert ? 'rgba(245,158,11,0.13)' : 'rgba(34,197,94,0.13)';

  const local   = hasHybrid ? r.local_model : r;
  const conf    = ((local.confidence ?? 0) * 100).toFixed(1);
  const fakeP   = ((local.fake_probability ?? 0) * 100).toFixed(1);
  const realP   = ((local.real_probability ?? 0) * 100).toFixed(1);
  const model   = local.model_name ?? '';
  const timeMs  = local.processing_time_ms ?? 0;

  const gemini  = hasHybrid && r.gemini_analysis && !r.gemini_analysis.error ? r.gemini_analysis : null;

  const host = Object.assign(document.createElement('div'), { id: '__ai_det__' });
  Object.assign(host.style, { position: 'fixed', top: '20px', right: '20px', zIndex: '2147483647', width: '320px' });
  const shadow = host.attachShadow({ mode: 'open' });

  let geminiHtml = '';
  if (gemini) {
    const sigs = (gemini.visual_signals || []).slice(0, 3).map(s => `<li style="font-size:10px;color:#94a3b8;margin-top:2px">• ${s}</li>`).join('');
    geminiHtml = `
      <div style="border-top:1px solid rgba(255,255,255,0.07);margin-top:10px;padding-top:10px;">
        <div style="font-size:10px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">✨ Gemini Review — ${gemini.predicted_label}</div>
        <div style="font-size:11px;color:#cbd5e1;background:rgba(255,255,255,0.04);padding:7px 10px;border-radius:7px;line-height:1.5">${gemini.reasoning_summary}</div>
        ${sigs ? `<ul style="list-style:none;padding:0;margin-top:5px">${sigs}</ul>` : ''}
      </div>`;
  }

  const rec = hasHybrid ? `<div style="font-size:11px;font-style:italic;color:#a5b4fc;background:rgba(99,102,241,0.08);border-left:2px solid #6366f1;padding:7px 10px;border-radius:4px;margin-top:10px">"${r.recommendation}"</div>` : '';

  shadow.innerHTML = `<style>
    *{box-sizing:border-box;margin:0;padding:0}
    .card{background:#0f172a;color:#f1f5f9;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,0.7);border:1px solid rgba(255,255,255,0.08);overflow:hidden;animation:si .25s ease}
    @keyframes si{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
    .hd{padding:16px 20px 12px;background:${bgAccent};border-bottom:1px solid rgba(255,255,255,0.07)}
    .badge{font-size:26px;font-weight:900;color:${accent};letter-spacing:.04em}
    .sub{font-size:10px;opacity:.5;text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    .bd{padding:14px 20px 16px}
    .lbl{font-size:10px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px}
    .row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}
    .k{opacity:.5}.v{font-weight:600}
    .bar-wrap{background:rgba(255,255,255,0.08);border-radius:4px;height:5px;overflow:hidden;margin-bottom:8px;margin-top:-1px}
    .bar{height:100%;border-radius:4px}
    .ft{padding:10px 20px;border-top:1px solid rgba(255,255,255,0.07);display:flex;justify-content:space-between;align-items:center}
    .tm{font-size:11px;opacity:.4}.cl{background:rgba(255,255,255,0.07);border:none;color:#f1f5f9;font-size:11px;padding:5px 12px;border-radius:6px;cursor:pointer}
    .cl:hover{background:rgba(255,255,255,0.15)}
  </style>
  <div class="card">
    <div class="hd">
      <div class="badge">${decision}</div>
      <div class="sub">AI Image Detection — Hybrid Analysis</div>
    </div>
    <div class="bd">
      <div class="lbl">PyTorch Model (${local.predicted_label ?? decision})</div>
      <div class="row"><span class="k">Confidence</span><span class="v">${conf}%</span></div>
      <div class="row"><span class="k">AI Generated</span><span class="v" style="color:#ef4444">${fakeP}%</span></div>
      <div class="bar-wrap"><div class="bar" style="width:${fakeP}%;background:#ef4444"></div></div>
      <div class="row"><span class="k">Authentic</span><span class="v" style="color:#22c55e">${realP}%</span></div>
      <div class="bar-wrap"><div class="bar" style="width:${realP}%;background:#22c55e"></div></div>
      <div style="font-size:10px;color:#475569;display:flex;justify-content:space-between;margin-top:4px">
        <span>${model}</span><span>${timeMs}ms</span>
      </div>
      ${geminiHtml}
      ${rec}
    </div>
    <div class="ft">
      <span class="tm" id="tm">Đóng sau 15s</span>
      <button class="cl" id="cl">Đóng ✕</button>
    </div>
  </div>`;

  document.body.appendChild(host);

  let t = 15;
  const iv = setInterval(() => {
    const el = shadow.getElementById('tm');
    if (el) el.textContent = `Đóng sau ${--t}s`;
    if (t <= 0) { clearInterval(iv); host.remove(); }
  }, 1000);
  shadow.getElementById('cl').addEventListener('click', () => { clearInterval(iv); host.remove(); });
}

// ── Token management ─────────────────────────────────────────────────────────
async function getValidAccessToken() {
  const data = await chrome.storage.local.get([KEY_ACCESS, KEY_REFRESH, KEY_EXPIRY]);
  const access  = data[KEY_ACCESS];
  const refresh = data[KEY_REFRESH];
  const expiry  = data[KEY_EXPIRY] || 0;

  if (!access) return null;

  // If expiring within 60s, refresh
  const secsLeft = expiry - Math.floor(Date.now() / 1000);
  if (secsLeft < 60 && refresh) {
    return await refreshAccessToken();
  }
  return access;
}

async function refreshAccessToken() {
  const { [KEY_REFRESH]: refreshToken } = await chrome.storage.local.get(KEY_REFRESH);
  if (!refreshToken) return null;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      await chrome.storage.local.remove([KEY_ACCESS, KEY_REFRESH, KEY_EXPIRY, KEY_USER]);
      return null;
    }
    const data = await res.json();
    const expiry = Math.floor(Date.now() / 1000) + (data.expires_in || 900);
    await chrome.storage.local.set({
      [KEY_ACCESS]:  data.access_token,
      [KEY_REFRESH]: data.refresh_token,
      [KEY_EXPIRY]:  expiry,
      [KEY_USER]:    data.user,
    });
    return data.access_token;
  } catch {
    return null;
  }
}

// ── Notification helper ──────────────────────────────────────────────────────
async function showNotif(id, title, message) {
  // Generate icon via OffscreenCanvas (no file required)
  const canvas = new OffscreenCanvas(128, 128);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 128, 128);
  grad.addColorStop(0, '#2563eb');
  grad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, 0, 128, 128, 24);
  ctx.fill();
  ctx.fillStyle = 'white';
  ctx.font = 'bold 64px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AI', 64, 68);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const iconUrl = await new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });

  return chrome.notifications.create(id, { type: 'basic', iconUrl, title, message });
}

// ── Image helpers ────────────────────────────────────────────────────────────
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = (header.match(/:(.*?);/) || [])[1] || 'image/png';
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}

async function cropDataUrl(dataUrl, sel) {
  const scale = sel.devicePixelRatio || 1;
  const bmp   = await createImageBitmap(dataUrlToBlob(dataUrl));
  const canvas = new OffscreenCanvas(sel.width, sel.height);
  const ctx    = canvas.getContext('2d');
  ctx.drawImage(bmp, sel.x * scale, sel.y * scale, sel.width * scale, sel.height * scale, 0, 0, sel.width, sel.height);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function uploadBlob(blob, token, useGemini = true) {
  const fd = new FormData();
  fd.append('file', blob, 'capture.png');
  fd.append('source_type', 'screenshot');
  if (useGemini) fd.append('use_gemini', 'true');

  const endpoint = useGemini ? `${API_URL}/predict-hybrid` : `${API_URL}/predict`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: fd,
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}
