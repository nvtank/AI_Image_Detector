# AI Image Detector

Dự án phát hiện ảnh AI (AI-generated image detection) sử dụng công nghệ Deep Learning. Hệ thống cung cấp giải pháp toàn diện bao gồm việc benchmark nhiều mô hình khác nhau, cung cấp Backend API, ứng dụng Web Frontend và Browser Extension.

## 🌟 Tính năng chính

- **Phát hiện ảnh AI**: Ứng dụng các mô hình Deep Learning tiên tiến để phân loại ảnh thật và ảnh do AI tạo ra.
- **Benchmark nhiều Model**: Đánh giá và so sánh hiệu năng của các kiến trúc khác nhau (ví dụ: CNNs, Vision Transformers) trên nhiều tập dữ liệu đa dạng.
- **Backend API**: RESTful API mạnh mẽ phục vụ việc gửi ảnh và nhận kết quả dự đoán với độ trễ thấp.
- **Web App**: Giao diện trực quan cho phép người dùng tải ảnh lên và xem kết quả phân tích chi tiết.
- **Browser Extension**: Tiện ích mở rộng cho trình duyệt giúp kiểm tra nhanh hình ảnh trực tiếp trên các trang web đang xem.

## 📂 Cấu trúc dự án

- `backend/`: Chứa mã nguồn cho API server (ví dụ: FastAPI hoặc Flask), chịu trách nhiệm nhận request, xử lý logic, load model và trả về dự đoán.
- `frontend/`: Ứng dụng web tương tác người dùng (ví dụ: React, Vue, hoặc Next.js).
- `extension/`: Mã nguồn của tiện ích mở rộng trình duyệt (Manifest V3).
- `experiments/`: Nơi chứa Jupyter notebooks, dataset configs, và các scripts dùng để train, evaluate, và benchmark các mô hình Deep Learning.
- `docs/`: Tài liệu thiết kế hệ thống, API references, báo cáo và các tài liệu khác.
- `demo/`: Các hình ảnh, video, hoặc tài liệu dùng để thuyết trình/demo dự án.

## 🛠 Công nghệ dự kiến

- **Core AI**: Python, PyTorch / TensorFlow, OpenCV, Scikit-learn
- **Backend**: Python (FastAPI / Flask)
- **Frontend**: JavaScript / TypeScript, React.js / Next.js, Tailwind CSS
- **Extension**: Vanilla JS / React, HTML, CSS

## 🚀 Bắt đầu (Đang cập nhật)

*Hướng dẫn cài đặt chi tiết cho từng môi trường (dev/prod) sẽ được cập nhật trong quá trình phát triển.*
