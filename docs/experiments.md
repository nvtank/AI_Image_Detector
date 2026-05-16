# Quản lý Kết quả Thử nghiệm (Experiments)

Thư mục `experiments/` chứa các dữ liệu, báo cáo và file lịch sử huấn luyện (training history) của các mô hình Deep Learning trong dự án AI Image Detector.

## 📂 Cấu trúc thư mục

```text
experiments/
├── model_comparison.csv          # So sánh tổng quan các mô hình
├── training_history/             # Lịch sử accuracy/loss qua từng epoch
│   ├── efficientnetv2_rw_s.csv
│   ├── convnext_tiny.csv
│   └── ...
├── robustness_results/           # Kết quả kiểm thử với các loại nhiễu/biến dạng
│   ├── efficientnetv2_rw_s.csv
│   ├── convnext_tiny.csv
│   └── ...
├── reports/                      # Báo cáo Classification chi tiết (Precision, Recall, F1)
│   ├── classification_report_efficientnetv2_rw_s.txt
│   ├── classification_report_convnext_tiny.txt
│   └── ...
└── summary.json                  # File tổng hợp dạng JSON (được generate tự động)
```

## 🛠 Script Tổng hợp Dữ liệu

Để dễ dàng tích hợp dữ liệu vào Dashboard (Frontend), dự án cung cấp script `build_experiment_summary.py` nhằm đọc các file `.csv` và `.txt` rồi xuất ra file `summary.json`. 

### Hướng dẫn chạy script

Mỗi khi có kết quả train mới, hoặc update file trong `experiments/`, bạn chạy lệnh sau từ thư mục gốc của project:

```bash
python scripts/build_experiment_summary.py
```

### Chức năng của script

1. Đọc `model_comparison.csv` để lấy các thông số cơ bản (`clean_f1`, `robust_avg_f1`, `avg_drop`).
2. Đọc file `classification_report_{model_name}.txt` tương ứng trong `reports/` để trích xuất `accuracy`.
3. Tính toán và chọn ra "Best Model" dựa trên kết hợp độ chính xác và độ ổn định.
4. Ghi kết quả tổng hợp vào `experiments/summary.json` giúp cho Frontend dễ dàng fetch và hiển thị.
