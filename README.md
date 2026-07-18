# 🔍 AI Image Detector

> A comprehensive, high-performance system for detecting AI-generated images using State-of-the-Art Deep Learning models (EfficientNetV2, ConvNeXt, ResNet50) integrated with Gemini Multimodal capabilities for advanced explainable AI.

---

## 🌟 Key Features

- **High-Accuracy Deep Learning Detection:** Built-in models achieving up to 99% accuracy and 98.6% F1-score.
- **Hybrid AI Pipeline (Dual Check):** Combines local CNN/Transformer models with **Gemini 2.5 Flash** for deep analysis, reasoning, and detailed explainability.
- **Chrome Extension (Capture & Detect):** Right-click any image on the web or capture a specific screen area to instantly verify if it's AI-generated.
- **Grad-CAM Explainability:** Generates heatmaps highlighting the exact regions the local model focused on to make its decision.
- **Modern Web Dashboard:** A Next.js frontend to view detailed Gemini result cards, filter prediction history (consensus vs. conflict), and visualize metrics.
- **Robust REST API:** A FastAPI-powered backend supporting direct uploads, URL-based detection, and hybrid pipeline execution.

---

## 🛠 Technologies Used

### **AI & Machine Learning**
- **Frameworks & Libraries:** Python 3.10, PyTorch, `timm` (PyTorch Image Models), OpenCV, Scikit-learn
- **Local Models:** EfficientNetV2-RW-S, ConvNeXt-Tiny, ResNet50, EfficientNet-B0
- **Cloud/LLM:** Google Gemini Multimodal API (`gemini-2.5-flash`)

### **Backend (API Server)**
- **Framework:** FastAPI, Uvicorn
- **Database:** SQLite (with SQLAlchemy/Pydantic)
- **Deployment:** Docker, Nix (optional)

### **Frontend (Web Dashboard)**
- **Framework:** Next.js 15, React
- **Styling & UI:** Tailwind CSS, Recharts
- **Language:** TypeScript

### **Browser Integration**
- **Extension:** Chrome Extension API (Manifest V3), Vanilla JavaScript

---

## 📊 Model Training Results

Our models were rigorously trained and evaluated on both clean datasets and robust datasets (containing noise, blur, dark lighting, and JPEG compression artifacts). 

**🏆 Recommended Best Model:** `EfficientNetV2-RW-S` (Best balance of high accuracy and robustness against distortions).

| Model | Clean Accuracy | Clean F1 Score | Robust Avg F1 | Avg Drop (Robustness) | Total Train Time |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **EfficientNetV2-RW-S** 🏆 | **99.00%** | 98.58% | **98.08%** | **-0.50%** | ~3.3 hours |
| **ConvNeXt-Tiny** | 99.00% | **98.63%** | 97.53% | -1.10% | ~2.0 hours |
| **EfficientNet-B0** | 99.00% | 98.48% | 96.42% | -2.06% | ~1.3 hours |
| **ResNet50** | 98.00% | 98.03% | 97.45% | -0.58% | ~1.7 hours |

*Data extracted from `experiments/summary.json` and `experiments/model_comparison.csv`.*

---

## 🎯 System Outputs & Deliverables

1. **REST API Service:** Ready-to-use endpoints for integration into other platforms.
2. **Web Dashboard:** A responsive UI for users to upload images and review detailed Hybrid AI reports.
3. **Chrome Extension:** A seamless browser tool for real-time fact-checking of images on the internet.
4. **Grad-CAM Visualizations:** Heatmaps providing transparency into the AI's decision-making process.
5. **Comprehensive Evaluation Reports:** Detailed metrics on model performance under various adversarial conditions.

---

## 📂 Project Structure

```text
project/
├── backend/          # FastAPI inference server, DB models, Hybrid AI logic
├── frontend/         # Next.js web application and dashboard
├── extension/        # Chrome Extension (Manifest V3) source code
├── experiments/      # Training results, logs, and benchmark data
├── docs/             # Technical documentation & architecture designs
└── demo/             # Demo images and examples
```

---

## 🚀 Quick Start Guide

### 1. Backend (FastAPI)

```bash
cd backend

# Create and activate virtual environment (Python 3.10 recommended)
python3.10 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env

# 🚨 Important: Place the trained model weights into backend/weights/best_model.pt

# Run the server
uvicorn app.main:app --reload
```
* Backend URL: **http://localhost:8000**
* API Swagger Docs: **http://localhost:8000/docs**

> **Docker alternative:** Run `docker compose up -d` inside the `backend` folder.

### 2. Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Run the development server
npm run dev
```
* Frontend URL: **http://localhost:3000**

### 3. Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (top right corner).
3. Click **Load unpacked** and select the `extension/` folder in this repository.
4. Right-click any image on the web and select **"Check AI Generated Image"**, or use the extension popup to capture a screen area.

---

## 🔌 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Check server and model loading status |
| `POST` | `/predict` | Analyze an uploaded image (Local Model only) |
| `POST` | `/predict-hybrid`| Analyze an image using the Hybrid AI Pipeline (Local + Gemini) |
| `POST` | `/predict-url` | Analyze an image via its web URL |
| `POST` | `/explain` | Generate a Grad-CAM heatmap visualization |
| `GET` | `/history` | Retrieve prediction history and Gemini reports |
| `GET` | `/models` | Get information about the currently loaded local model |
| `GET` | `/metrics` | Retrieve benchmark and evaluation data |

*For deeper insights into the Hybrid AI architecture, see [docs/gemini_hybrid_analysis.md](docs/gemini_hybrid_analysis.md).*
