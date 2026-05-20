/**
 * image-utils.js — helper functions for screenshot capture, crop, and upload.
 * Runs inside the background service worker (no DOM access, uses OffscreenCanvas).
 */

/**
 * Convert a dataURL string to a Blob object.
 * @param {string} dataUrl
 * @returns {Blob}
 */
function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/**
 * Crop a dataURL screenshot to the selected region.
 * Accounts for devicePixelRatio so result is pixel-perfect on HiDPI screens.
 *
 * @param {string} dataUrl     – Full visible-tab screenshot as dataURL
 * @param {{ x, y, width, height, devicePixelRatio }} sel – CSS-pixel selection
 * @returns {Promise<Blob>}    – Cropped image as PNG Blob
 */
async function cropDataUrl(dataUrl, sel) {
  const scale = sel.devicePixelRatio || 1;

  // Decode image using createImageBitmap (available in service workers)
  const blob = dataUrlToBlob(dataUrl);
  const imageBitmap = await createImageBitmap(blob);

  const canvas = new OffscreenCanvas(sel.width, sel.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    imageBitmap,
    sel.x * scale,      // source x (physical pixel)
    sel.y * scale,      // source y
    sel.width * scale,  // source width
    sel.height * scale, // source height
    0,                  // destination x
    0,                  // destination y
    sel.width,          // destination width (CSS pixel)
    sel.height          // destination height
  );

  return canvas.convertToBlob({ type: 'image/png' });
}

/**
 * Upload a Blob to POST /predict.
 *
 * @param {Blob}   blob     – Cropped image blob
 * @param {string} token    – Bearer JWT token
 * @param {string} apiUrl   – Backend base URL
 * @param {string} sourceType – "upload" | "screenshot"
 * @returns {Promise<object>} – Parsed JSON response
 */
async function uploadBlobToPredictApi(blob, token, apiUrl, sourceType = 'screenshot') {
  const formData = new FormData();
  formData.append('file', blob, 'captured-area.png');
  formData.append('source_type', sourceType);

  const response = await fetch(`${apiUrl}/predict`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Server error ${response.status}`);
  }

  return response.json();
}
