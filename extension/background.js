importScripts('config.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "checkAIImage",
    title: "Check AI Generated Image",
    contexts: ["image"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "checkAIImage") {
    const imageUrl = info.srcUrl;
    
    // Notification options using the small red pixel icon
    const iconUrl = 'icon128.png';
    const notifId = 'ai-detector-' + Date.now();

    chrome.notifications.create(notifId + '-loading', {
      type: 'basic',
      iconUrl: iconUrl,
      title: 'AI Image Detector',
      message: 'Analyzing image... Please wait.'
    });

    try {
      const response = await fetch(`${CONFIG.API_URL}/predict-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      // Clear loading notification
      chrome.notifications.clear(notifId + '-loading');

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      const conf = (data.confidence * 100).toFixed(1);
      const isFake = data.label === 'FAKE';
      
      chrome.notifications.create(notifId + '-result', {
        type: 'basic',
        iconUrl: iconUrl,
        title: `[${data.label}] Result`,
        message: `${isFake ? 'AI Generated' : 'Authentic'} Image (${conf}% confidence)\nModel: ${data.model_name}`
      });

    } catch (error) {
      chrome.notifications.clear(notifId + '-loading');
      chrome.notifications.create(notifId + '-error', {
        type: 'basic',
        iconUrl: iconUrl,
        title: 'Analysis Failed',
        message: 'Could not analyze image. Make sure the backend is running and the image URL is accessible.'
      });
    }
  }
});
