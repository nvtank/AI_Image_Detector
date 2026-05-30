/**
 * background.js — AI Image Detector Extension v2
 *
 * Handles:
 *  • Context menu "Check AI Generated Image" (URL-based, no auth needed)
 *  • Capture Area Detection flow (inject overlay → crop → upload → show result)
 */

// ── Config (inline so no importScripts needed for Firefox MV3) ─────────────
const API_URL = 'http://localhost:8000';

// ── Context menu setup ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'checkAIImage',
    title: 'Check AI Generated Image',
    contexts: ['image'],
  });
});

// ── Context menu: right-click image → predict-url ──────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'checkAIImage') return;

  const imageUrl = info.srcUrl;
  const notifId = 'ai-det-' + Date.now();

  chrome.notifications.create(notifId + '-loading', {
    type: 'basic',
    iconUrl: 'icon128.png',
    title: 'AI Image Detector',
    message: '⏳ Analyzing image...',
  });

  try {
    // Fetch token (optional for predict-url — depends on backend config)
    const token = await getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}/predict-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ image_url: imageUrl }),
    });

    chrome.notifications.clear(notifId + '-loading');

    if (res.status === 401) {
      showNotification(notifId + '-err', 'Login Required',
        '🔒 Please log in via the extension popup first.');
      return;
    }
    if (!res.ok) throw new Error(`Server ${res.status}`);

    const data = await res.json();
    const conf = (data.confidence * 100).toFixed(1);

    chrome.notifications.create(notifId + '-result', {
      type: 'basic',
      iconUrl: 'icon128.png',
      title: `[${data.label}] ${data.label === 'FAKE' ? 'AI Generated' : 'Authentic'}`,
      message: `Confidence: ${conf}%  •  Model: ${data.model_name}`,
    });

  } catch (err) {
    chrome.notifications.clear(notifId + '-loading');
    showNotification(notifId + '-err', 'Error',
      err.message === 'UNAUTHORIZED'
        ? '🔒 Please log in via the extension popup.'
        : '❌ Failed to analyze. Is the backend running?');
  }
});

// ── Message listener (from popup & content scripts) ────────────────────────
let pendingCaptureTabId = null;
let pendingCaptureWindowId = null;
let pendingUseGemini = true;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_CAPTURE_AREA') {
    handleStartCapture(message.tabId, message.windowId, message.useGemini);
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'CROP_AREA_SELECTED') {
    handleCropSelected(message.payload, sender);
    return;
  }

  if (message.type === 'CROP_CANCELLED') {
    pendingCaptureTabId = null;
    pendingCaptureWindowId = null;
    pendingUseGemini = true;
    return;
  }

  if (message.type === 'SAVE_TOKEN') {
    chrome.storage.local.set({ access_token: message.token });
    sendResponse({ ok: true });
    return;
  }

  if (message.type === 'CLEAR_TOKEN') {
    chrome.storage.local.remove('access_token');
    sendResponse({ ok: true });
    return;
  }
});

// ── Capture area flow ──────────────────────────────────────────────────────
async function handleStartCapture(tabId, windowId, useGemini = true) {
  pendingCaptureTabId = tabId;
  pendingCaptureWindowId = windowId;
  pendingUseGemini = useGemini;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/crop-selector.js'],
    });
  } catch (e) {
    showNotification('cap-err-' + Date.now(), 'Cannot inject script',
      '❌ This page does not allow extension scripts (e.g. browser internal pages).');
    pendingCaptureTabId = null;
  }
}

async function handleCropSelected(selection, sender) {
  const tabId = sender.tab?.id || pendingCaptureTabId;
  const windowId = sender.tab?.windowId || pendingCaptureWindowId;
  pendingCaptureTabId = null;
  pendingCaptureWindowId = null;

  if (!tabId) return;

  // Step 1 — show loading overlay
  await injectResult(tabId, { _loading: true });

  try {
    // Step 2 — check token
    const token = await getToken();
    if (!token) {
      await injectResult(tabId, {
        _error: '🔒 Please log in via the extension popup before using Capture Detection.',
      });
      return;
    }

    // Step 3 — capture visible tab
    let screenshotDataUrl;
    try {
      screenshotDataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
    } catch (e) {
      await injectResult(tabId, { _error: '❌ Could not capture this tab. Try a regular webpage.' });
      return;
    }

    // Step 4 — crop
    const croppedBlob = await cropDataUrl(screenshotDataUrl, selection);

    // Step 5 — upload
    const result = await uploadBlobToPredictApi(croppedBlob, token, API_URL, 'screenshot', pendingUseGemini);

    // Step 6 — show result
    await injectResult(tabId, result);

  } catch (err) {
    const msg = err.message === 'UNAUTHORIZED'
      ? '🔒 Session expired. Please log in again.'
      : `❌ ${err.message || 'Analysis failed. Check backend.'}`;
    await injectResult(tabId, { _error: msg });
  }
}

// ── Inject result overlay ──────────────────────────────────────────────────
async function injectResult(tabId, result) {
  const code = result._loading
    ? injectLoadingCode()
    : result._error
      ? injectErrorCode(result._error)
      : injectResultCode(result);

  await chrome.scripting.executeScript({
    target: { tabId },
    func: code.fn,
    args: code.args,
  });
}

function injectLoadingCode() {
  return {
    fn: function () {
      const prev = document.getElementById('__ai_result_host__');
      if (prev) prev.remove();
      const host = document.createElement('div');
      host.id = '__ai_result_host__';
      Object.assign(host.style, {
        position: 'fixed', top: '20px', right: '20px',
        zIndex: '2147483647', fontFamily: 'system-ui,sans-serif',
        background: 'rgba(15,23,42,0.95)', color: '#f1f5f9',
        borderRadius: '12px', padding: '18px 22px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', gap: '12px',
        fontSize: '14px',
      });
      host.innerHTML = `<span style="font-size:20px">⏳</span> Analyzing captured area...`;
      document.body.appendChild(host);
    },
    args: [],
  };
}

function injectErrorCode(msg) {
  return {
    fn: function (errMsg) {
      const prev = document.getElementById('__ai_result_host__');
      if (prev) prev.remove();
      const host = document.createElement('div');
      host.id = '__ai_result_host__';
      Object.assign(host.style, {
        position: 'fixed', top: '20px', right: '20px',
        zIndex: '2147483647', fontFamily: 'system-ui,sans-serif',
        background: 'rgba(127,29,29,0.97)', color: '#fecaca',
        borderRadius: '12px', padding: '16px 20px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
        maxWidth: '280px', fontSize: '13px', lineHeight: '1.5',
      });
      host.innerHTML = `${errMsg}
        <button onclick="this.parentNode.remove()" style="
          display:block; margin-top:10px; background:rgba(255,255,255,0.15);
          border:none; color:#fecaca; padding:5px 14px; border-radius:6px;
          cursor:pointer; font-size:12px;">Close</button>`;
      document.body.appendChild(host);
      setTimeout(() => host.remove(), 8000);
    },
    args: [msg],
  };
}

function injectResultCode(result) {
  return {
    fn: function (r) {
      const prev = document.getElementById('__ai_result_host__');
      if (prev) prev.remove();

      // Normalize hybrid vs legacy structure
      const hasHybrid = !!r.final_decision;
      const decision = hasHybrid ? r.final_decision : r.label;
      const isFake = decision === 'FAKE';
      const isUncertain = decision === 'UNCERTAIN';
      
      const accentColor = isFake ? '#ef4444' : (isUncertain ? '#f59e0b' : '#22c55e');
      const bgAccent = isFake ? 'rgba(239,68,68,0.15)' : (isUncertain ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)');

      const localLabel = hasHybrid ? r.local_model.predicted_label : r.label;
      const localConf = (hasHybrid ? r.local_model.confidence : r.confidence) * 100;
      const fakeProb = (hasHybrid ? r.local_model.fake_probability : r.fake_probability) * 100;
      const realProb = (hasHybrid ? r.local_model.real_probability : r.real_probability) * 100;
      const modelName = hasHybrid ? r.local_model.model_name : r.model_name;
      const timeMs = hasHybrid ? r.local_model.processing_time_ms : r.processing_time_ms;

      const hasGemini = hasHybrid && r.gemini_analysis && !r.gemini_analysis.error;
      const geminiLabel = hasGemini ? r.gemini_analysis.predicted_label : 'N/A';
      const geminiConfLevel = hasGemini ? r.gemini_analysis.confidence_level : '';
      const geminiReason = hasGemini ? r.gemini_analysis.reasoning_summary : '';
      const geminiSignals = hasGemini ? r.gemini_analysis.visual_signals : [];

      const host = document.createElement('div');
      host.id = '__ai_result_host__';
      Object.assign(host.style, {
        position: 'fixed', top: '20px', right: '20px',
        zIndex: '2147483647', fontFamily: 'system-ui,sans-serif',
        width: '320px',
      });

      const shadow = host.attachShadow({ mode: 'open' });

      const imageLink = r.image_url
        ? `<a class="link" href="${r.image_url}" target="_blank">↗ View saved image</a>` : '';

      // Build Gemini Section HTML
      let geminiHtml = '';
      if (hasGemini) {
        let sigsLi = '';
        geminiSignals.forEach(sig => {
          sigsLi += `<li style="font-size:10px; margin-top:2px; color:#cbd5e1">• ${sig}</li>`;
        });
        geminiHtml = `
          <div class="sec-title" style="margin-top:10px; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
            ✨ Gemini Review (${geminiLabel})
          </div>
          <div style="font-size:11px; color:#cbd5e1; line-height:1.4; background:rgba(255,255,255,0.03); padding:6px 10px; border-radius:6px; margin-top:4px;">
            <strong>Reason:</strong> ${geminiReason}
          </div>
          ${geminiSignals.length > 0 ? `<ul style="list-style:none; padding-left:4px; margin-top:4px;">${sigsLi}</ul>` : ''}
        `;
      }

      // Build Recommendation HTML
      const recommendationHtml = hasHybrid ? `
        <div style="font-size:11px; font-style:italic; color:#a5b4fc; background:rgba(99,102,241,0.08); border-left:2px solid #6366f1; padding:6px 10px; border-radius:4px; margin-top:10px;">
          "${r.recommendation}"
        </div>
      ` : '';

      shadow.innerHTML = `
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          .card { background:#0f172a; color:#f1f5f9; border-radius:16px;
            box-shadow:0 8px 40px rgba(0,0,0,0.6); overflow:hidden;
            border: 1px solid rgba(255,255,255,0.08);
            animation: slideIn 0.25s ease; }
          @keyframes slideIn { from{opacity:0;transform:translateX(30px)} to{opacity:1;transform:translateX(0)} }
          .hd { padding:16px 20px 12px; background:${bgAccent};
            border-bottom:1px solid rgba(255,255,255,0.07); }
          .badge { font-size:24px; font-weight:900; color:${accentColor}; letter-spacing:.05em; }
          .sub { font-size:10px; opacity:.5; text-transform:uppercase; letter-spacing:.06em; margin-top:2px; }
          .bd { padding:14px 20px 16px; display:flex; flex-direction:column; gap:8px; }
          .sec-title { font-size:11px; font-weight:700; color:#3b82f6; text-transform:uppercase; letter-spacing:.04em; }
          .row { display:flex; justify-content:space-between; font-size:12px; }
          .k { opacity:.5; }
          .v { font-weight:600; }
          .bar-wrap { background:rgba(255,255,255,0.08); border-radius:4px; height:4px; overflow:hidden; margin-top:-4px; }
          .bar { height:100%; border-radius:4px; }
          .link { font-size:11px; color:#60a5fa; text-decoration:none; margin-top:4px; display:block; }
          .link:hover { text-decoration:underline; }
          .ft { padding:10px 20px; border-top:1px solid rgba(255,255,255,0.07);
            display:flex; justify-content:space-between; align-items:center; }
          .timer { font-size:11px; opacity:.4; }
          .close { background:rgba(255,255,255,0.07); border:none; color:#f1f5f9;
            font-size:11px; padding:5px 12px; border-radius:6px; cursor:pointer; }
          .close:hover { background:rgba(255,255,255,0.15); }
        </style>
        <div class="card">
          <div class="hd">
            <div class="badge">${decision}</div>
            <div class="sub">Hybrid Region AI Detection</div>
          </div>
          <div class="bd">
            <div class="sec-title">Local PyTorch model (${localLabel})</div>
            <div class="row"><span class="k">Confidence</span><span class="v">${localConf.toFixed(1)}%</span></div>
            <div class="row"><span class="k">AI Generated</span><span class="v" style="color:#ef4444">${fakeProb.toFixed(1)}%</span></div>
            <div class="bar-wrap"><div class="bar" style="width:${fakeProb}%;background:#ef4444"></div></div>
            <div class="row"><span class="k">Authentic</span><span class="v" style="color:#22c55e">${realProb.toFixed(1)}%</span></div>
            <div class="bar-wrap"><div class="bar" style="width:${realProb}%;background:#22c55e"></div></div>
            
            ${geminiHtml}
            ${recommendationHtml}

            <div style="font-size:10px; color:#64748b; margin-top:8px; display:flex; justify-content:space-between;">
              <span>Model: ${modelName}</span>
              <span>Latency: ${timeMs}ms</span>
            </div>
            ${imageLink}
          </div>
          <div class="ft">
            <span class="timer" id="tm">Closing in 15s</span>
            <button class="close" id="cl">Close ✕</button>
          </div>
        </div>`;

      document.body.appendChild(host);

      let t = 15;
      const iv = setInterval(() => {
        t--;
        const el = shadow.getElementById('tm');
        if (el) el.textContent = `Closing in ${t}s`;
        if (t <= 0) { clearInterval(iv); host.remove(); }
      }, 1000);

      shadow.getElementById('cl').addEventListener('click', () => {
        clearInterval(iv); host.remove();
      });
    },
    args: [result],
  };
}

// ── Storage helpers ────────────────────────────────────────────────────────
function getToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get('access_token', (data) => {
      resolve(data.access_token || null);
    });
  });
}

function showNotification(id, title, message) {
  chrome.notifications.create(id, {
    type: 'basic',
    iconUrl: 'icon128.png',
    title,
    message,
  });
}

// ── Image helpers (inline — no importScripts for Firefox compat) ───────────
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function cropDataUrl(dataUrl, sel) {
  const scale = sel.devicePixelRatio || 1;
  const blob = dataUrlToBlob(dataUrl);
  const imageBitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(sel.width, sel.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(
    imageBitmap,
    sel.x * scale, sel.y * scale,
    sel.width * scale, sel.height * scale,
    0, 0, sel.width, sel.height
  );
  return canvas.convertToBlob({ type: 'image/png' });
}

async function uploadBlobToPredictApi(blob, token, apiUrl, sourceType = 'screenshot', useGemini = true) {
  const formData = new FormData();
  formData.append('file', blob, 'captured-area.png');
  formData.append('source_type', sourceType);
  
  const endpoint = useGemini ? `${apiUrl}/predict-hybrid` : `${apiUrl}/predict`;
  if (useGemini) {
    formData.append('use_gemini', 'true');
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${res.status}`);
  }
  return res.json();
}
