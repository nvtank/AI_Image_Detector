# AI Image Detector - Chrome Extension

This extension provides a quick and accessible way to verify images via a browser popup without having to navigate to the full web dashboard.

## Requirements
- The FastAPI backend must be running locally at `http://localhost:8000`.

## Installation Guide (Developer Mode)

To install this extension directly into Google Chrome for testing:

1. Open Google Chrome.
2. Type `chrome://extensions/` in the URL bar and press Enter.
3. In the top right corner, toggle the **Developer mode** switch to ON.
4. Click the **Load unpacked** button that appears in the top left.
5. In the file dialog, navigate to the `extension/` directory within this project repository.
6. Click **Select** or **Open**.

The extension should now appear in your browser's extension list. You can click the puzzle piece icon in Chrome to pin the AI Image Detector to your toolbar for easy access!

## Usage

**Method 1: Direct File Upload**
1. Click the AI Image Detector icon in your toolbar.
2. Click the dashed box to select an image from your computer.
3. Click "Analyze Image".
4. The extension will securely send the image to your local AI backend and display the FAKE/REAL classification, confidence percentage, and processing speed immediately.

**Method 2: Right-Click on any Webpage (Context Menu)**
1. While browsing any website, right-click on any image.
2. Select **"Check AI Generated Image"** from the context menu.
3. The extension will automatically extract the image URL and send it to the backend.
4. A browser notification will appear showing you the result (FAKE/REAL and confidence).

## Configuration
If your backend runs on a different URL, you can edit the API URL by modifying the `extension/config.js` file before loading the unpacked extension.
