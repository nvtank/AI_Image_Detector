# AI Image Detector

Dự án phát hiện ảnh AI (AI-generated image detection) sử dụng Deep Learning (EfficientNetV2, ConvNeXt, ResNet50). Hệ thống bao gồm Backend FastAPI, Web App Next.js, và Chrome Extension.

## 🌟 Tính năng

- **Phát hiện ảnh AI** với độ chính xác cao (F1 ~98.6%)
- **Hệ thống lai kép (Hybrid AI Detection)**: Kết hợp mô hình Deep Learning nội bộ (ResNet50/ConvNeXt) và Gemini Multimodal API (`gemini-2.5-flash`) cho đánh giá chuyên sâu và giải trình chi tiết
- **Capture Area Detection**: Cho phép chụp vùng bất kỳ trên màn hình qua Extension để kiểm tra tức thì
- **Grad-CAM Explainability** – hiển thị vùng ảnh model chú ý
- **REST API** (FastAPI): upload ảnh, kiểm tra qua URL hoặc hybrid pipeline
- **Web Dashboard**: hiển thị chi tiết thẻ kết quả Gemini, bộ lọc lịch sử đồng thuận/mâu thuẫn
- **Chrome Extension**: kéo vùng chụp (screenshot) hoặc right-click kiểm tra ảnh trực tiếp


## 📂 Cấu trúc dự án

```
project/
├── backend/          # FastAPI inference server
├── frontend/         # Next.js web app
├── extension/        # Chrome Extension (Manifest V3)
├── experiments/      # Training results, benchmark data
├── docs/             # Documentation
└── demo/             # Demo images
```

## 🚀 Quick Start

### 1. Backend (FastAPI)

```bash
cd backend

# Tạo và kích hoạt virtual environment
# Khuyến nghị Python 3.10 (theo `shell.nix`/Dockerfile). Python 3.13 có thể lỗi build `pydantic-core` với versions đang pin.
python3.10 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Cài đặt dependencies
pip install -r requirements.txt

# Sao chép biến môi trường
cp .env.example .env

# Đặt file model weights vào backend/weights/best_model.pt

# Chạy server
uvicorn app.main:app --reload
```

Nếu bạn dùng Nix:

```bash
nix-shell
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend sẽ chạy tại: **http://localhost:8000**
API Docs (Swagger): **http://localhost:8000/docs**

### 2. Frontend (Next.js)

```bash
cd frontend

# Cài đặt dependencies
npm install

# Sao chép biến môi trường
cp .env.example .env.local

# Chạy dev server
npm run dev
```

Frontend sẽ chạy tại: **http://localhost:3000**

### 3. Chrome Extension

1. Mở `chrome://extensions/`
2. Bật **Developer mode**
3. Nhấn **Load unpacked** → chọn thư mục `extension/`
4. Right-click vào bất kỳ ảnh nào trên web → **"Check AI Generated Image"**

### 4. Docker (Backend only)

```bash
cd backend
docker compose up -d
```

## 🔌 API Endpoints

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/health` | Kiểm tra trạng thái server |
| POST | `/predict` | Upload ảnh để phân tích (Local Model only) |
| POST | `/predict-hybrid` | Phân tích ảnh với hệ thống lai kép (Local Model + Gemini) |
| POST | `/predict-url` | Phân tích ảnh qua URL |
| POST | `/explain` | Grad-CAM heatmap |
| GET | `/history` | Lịch sử dự đoán và báo cáo đánh giá Gemini |
| GET | `/models` | Thông tin model đang dùng |
| GET | `/metrics` | Dữ liệu benchmark |

Chi tiết kiến trúc hệ thống lai kép có tại [docs/gemini_hybrid_analysis.md](docs/gemini_hybrid_analysis.md).

## 🛠 Công nghệ

- **AI/ML**: Python, PyTorch, timm, OpenCV
- **Backend**: FastAPI, Uvicorn, SQLite, Pydantic
- **Frontend**: Next.js 15, Tailwind CSS, Recharts, TypeScript
- **Extension**: Vanilla JS, Manifest V3
