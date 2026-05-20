/**
 * result-overlay.js — injected into the active tab by background.js
 * Displays a floating result card using Shadow DOM so it is isolated from
 * the website's own CSS.
 *
 * Called via chrome.scripting.executeScript with args: [result]
 */
(function (result) {
  // Remove previous overlay if present
  const prev = document.getElementById('__ai_detector_result__');
  if (prev) prev.remove();

  const isFake = result.label === 'FAKE';
  const conf = (result.confidence * 100).toFixed(2);
  const fakeProb = (result.fake_probability * 100).toFixed(1);
  const realProb = (result.real_probability * 100).toFixed(1);
  const accentColor = isFake ? '#ef4444' : '#22c55e';
  const bgAccent = isFake ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)';

  // Host element
  const host = document.createElement('div');
  host.id = '__ai_detector_result__';
  Object.assign(host.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '2147483647',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  });

  // Shadow DOM to prevent style leakage
  const shadow = host.attachShadow({ mode: 'open' });

  const css = `
    .card {
      background: #0f172a;
      color: #f1f5f9;
      border-radius: 14px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      width: 290px;
      overflow: hidden;
      animation: slideIn 0.25s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(30px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    .header {
      padding: 18px 20px 14px;
      background: ${bgAccent};
      border-bottom: 1px solid rgba(255,255,255,0.07);
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 0.05em;
      color: ${accentColor};
    }
    .subtitle {
      font-size: 11px;
      opacity: 0.55;
      margin-top: 2px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .body {
      padding: 14px 20px 16px;
      display: flex;
      flex-direction: column;
      gap: 9px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
    }
    .row .k { opacity: 0.55; }
    .row .v { font-weight: 600; }
    .bar-wrap {
      background: rgba(255,255,255,0.08);
      border-radius: 4px;
      height: 5px;
      margin-top: -4px;
      overflow: hidden;
    }
    .bar { height: 100%; border-radius: 4px; }
    .bar.fake { background: #ef4444; }
    .bar.real { background: #22c55e; }
    .link {
      font-size: 12px;
      color: #60a5fa;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 2px;
    }
    .link:hover { text-decoration: underline; }
    .footer {
      padding: 10px 20px;
      border-top: 1px solid rgba(255,255,255,0.07);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .timer { font-size: 11px; opacity: 0.4; }
    .close-btn {
      background: rgba(255,255,255,0.07);
      border: none;
      color: #f1f5f9;
      font-size: 12px;
      padding: 5px 12px;
      border-radius: 6px;
      cursor: pointer;
    }
    .close-btn:hover { background: rgba(255,255,255,0.15); }
  `;

  const imageLink = result.image_url
    ? `<a class="link" href="${result.image_url}" target="_blank">
        ↗ View saved image
      </a>`
    : '';

  const html = `
    <style>${css}</style>
    <div class="card" id="card">
      <div class="header">
        <div>
          <div class="badge">${result.label}</div>
          <div class="subtitle">AI Detection Result</div>
        </div>
      </div>
      <div class="body">
        <div class="row"><span class="k">Confidence</span><span class="v">${conf}%</span></div>
        <div class="row"><span class="k">AI Generated</span><span class="v" style="color:#ef4444">${fakeProb}%</span></div>
        <div class="bar-wrap"><div class="bar fake" style="width:${fakeProb}%"></div></div>
        <div class="row"><span class="k">Authentic</span><span class="v" style="color:#22c55e">${realProb}%</span></div>
        <div class="bar-wrap"><div class="bar real" style="width:${realProb}%"></div></div>
        <div class="row"><span class="k">Model</span><span class="v">${result.model_name}</span></div>
        <div class="row"><span class="k">Time</span><span class="v">${result.processing_time_ms} ms</span></div>
        ${imageLink}
      </div>
      <div class="footer">
        <span class="timer" id="timer">Closing in 10s</span>
        <button class="close-btn" id="closeBtn">Close</button>
      </div>
    </div>
  `;

  shadow.innerHTML = html;
  document.body.appendChild(host);

  // Auto-close countdown
  let remaining = 10;
  const timerEl = shadow.getElementById('timer');
  const interval = setInterval(() => {
    remaining--;
    if (timerEl) timerEl.textContent = `Closing in ${remaining}s`;
    if (remaining <= 0) {
      clearInterval(interval);
      host.remove();
    }
  }, 1000);

  shadow.getElementById('closeBtn').addEventListener('click', () => {
    clearInterval(interval);
    host.remove();
  });
})(RESULT_PLACEHOLDER);
