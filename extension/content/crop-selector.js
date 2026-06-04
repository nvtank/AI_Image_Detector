/**
 * crop-selector.js — injected into the active tab by background.js
 * Creates a full-screen overlay that lets the user drag-select a region.
 * When the selection is confirmed, sends CROP_SELECTED to background.
 */
(function () {
  // Prevent double-injection
  if (document.getElementById('__ai_detector_overlay__')) return;

  const MIN_SIZE = 30; // px

  // ── Build overlay DOM ──────────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = '__ai_detector_overlay__';
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '2147483647',
    cursor: 'crosshair',
    userSelect: 'none',
    background: 'rgba(0,0,0,0.35)',
  });

  // Instruction hint
  const hint = document.createElement('div');
  Object.assign(hint.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'rgba(15,23,42,0.92)',
    color: '#f8fafc',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    padding: '10px 20px',
    borderRadius: '8px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
  });
  hint.textContent = '🔍 Drag to select area — Press ESC to cancel';
  overlay.appendChild(hint);

  // Selection rectangle
  const selection = document.createElement('div');
  Object.assign(selection.style, {
    position: 'fixed',
    border: '2px solid #3b82f6',
    background: 'rgba(59,130,246,0.08)',
    boxSizing: 'border-box',
    display: 'none',
    pointerEvents: 'none',
  });
  overlay.appendChild(selection);

  document.body.appendChild(overlay);

  // ── State ──────────────────────────────────────────────────────────────────
  let startX = 0, startY = 0;
  let isDragging = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function cleanup() {
    overlay.remove();
    document.removeEventListener('keydown', onKeyDown);
  }

  function getRect(x1, y1, x2, y2) {
    return {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  function updateSelectionBox(rect) {
    Object.assign(selection.style, {
      display: 'block',
      left: rect.x + 'px',
      top: rect.y + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    });
  }

  // ── Event handlers ─────────────────────────────────────────────────────────
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'CROP_CANCELLED' });
    }
  }

  overlay.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    selection.style.display = 'none';
  });

  overlay.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = getRect(startX, startY, e.clientX, e.clientY);
    updateSelectionBox(rect);
  });

  overlay.addEventListener('mouseup', (e) => {
    if (!isDragging) return;
    isDragging = false;

    const rect = getRect(startX, startY, e.clientX, e.clientY);

    if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
      // Too small — show flash message then keep overlay
      hint.textContent = '⚠️ Selection too small. Drag a larger area.';
      hint.style.background = 'rgba(220,38,38,0.92)';
      selection.style.display = 'none';
      setTimeout(() => {
        hint.textContent = '🔍 Drag to select area — Press ESC to cancel';
        hint.style.background = 'rgba(15,23,42,0.92)';
      }, 1800);
      return;
    }

    cleanup();

    chrome.runtime.sendMessage({
      type: 'CROP_SELECTED',
      selection: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
    });
  });

  document.addEventListener('keydown', onKeyDown);
})();
