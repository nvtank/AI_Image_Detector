document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');
  const previewContainer = document.getElementById('previewContainer');
  const imagePreview = document.getElementById('imagePreview');
  const placeholderText = document.getElementById('placeholderText');
  const analyzeBtn = document.getElementById('analyzeBtn');
  
  const loadingBox = document.getElementById('loading');
  const errorBox = document.getElementById('errorBox');
  const resultBox = document.getElementById('resultBox');
  
  const resultHeader = document.getElementById('resultHeader');
  const resultLabel = document.getElementById('resultLabel');
  const resultConfidence = document.getElementById('resultConfidence');
  const resultModel = document.getElementById('resultModel');
  const resultTime = document.getElementById('resultTime');

  let selectedFile = null;

  // Open file selector when clicking the area
  uploadArea.addEventListener('click', () => {
    fileInput.click();
  });

  // Handle file selection
  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      if (!file.type.startsWith('image/')) {
        showError('Please select a valid image file.');
        return;
      }

      selectedFile = file;
      analyzeBtn.disabled = false;
      hideError();
      hideResult();

      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        previewContainer.style.display = 'block';
        placeholderText.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });

  // Handle analyze button click
  analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    analyzeBtn.disabled = true;
    hideError();
    hideResult();
    loadingBox.classList.remove('hidden');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`${CONFIG.API_URL}/predict`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      showResult(data);
    } catch (err) {
      showError('Failed to analyze image. Please ensure the backend is running at ' + CONFIG.API_URL);
    } finally {
      loadingBox.classList.add('hidden');
      analyzeBtn.disabled = false;
    }
  });

  function showResult(data) {
    resultBox.classList.remove('hidden');
    
    resultLabel.textContent = data.label;
    if (data.label === 'FAKE') {
      resultHeader.className = 'result-header fake';
    } else {
      resultHeader.className = 'result-header real';
    }

    resultConfidence.textContent = (data.confidence * 100).toFixed(2) + '%';
    resultModel.textContent = data.model_name;
    resultTime.textContent = data.processing_time_ms + ' ms';
  }

  function showError(msg) {
    errorBox.textContent = msg;
    errorBox.classList.remove('hidden');
  }

  function hideError() {
    errorBox.classList.add('hidden');
  }

  function hideResult() {
    resultBox.classList.add('hidden');
  }
});
