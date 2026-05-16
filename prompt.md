Đây là bản kế hoạch hoàn chỉnh để hoàn thiện project theo đề cương nhưng nâng cấp hơn, có chia giai đoạn, commit từng bước và prompt cho AI code hiệu quả.

Mục tiêu cuối cùng:

AI Image Detector System
= Multi-model benchmark

- FastAPI inference backend
- Web app upload/check image
- Browser extension check image trực tiếp
- Dashboard kết quả train/robustness
- Log lịch sử dự đoán
- Docker/deploy/demo docs

0. Quy tắc làm project

Không nên làm một lần quá nhiều. Làm theo nhánh và commit nhỏ:

git checkout -b feature/ai-detector-system

Mỗi giai đoạn xong thì:

git status
git add .
git commit -m "commit message"

Format commit nên dùng:

chore: cấu hình, folder, docs
feat: thêm chức năng mới
fix: sửa lỗi
refactor: tối ưu code
docs: tài liệu
test: thêm test
Tổng roadmap
Giai đoạn 1: Chuẩn hóa project structure
Giai đoạn 2: Đưa kết quả train vào experiments
Giai đoạn 3: Xây backend FastAPI
Giai đoạn 4: Tích hợp model inference
Giai đoạn 5: Tạo API /predict
Giai đoạn 6: Tạo API /predict-url
Giai đoạn 7: Lưu lịch sử dự đoán
Giai đoạn 8: Tạo frontend web app
Giai đoạn 9: Trang upload ảnh
Giai đoạn 10: Dashboard model comparison
Giai đoạn 11: Browser extension popup
Giai đoạn 12: Browser extension right click image
Giai đoạn 13: Docker hóa backend
Giai đoạn 14: Viết docs demo
Giai đoạn 15: Final polish để đi chấm
Giai đoạn 1: Chuẩn hóa cấu trúc project
Mục tiêu

Tạo lại cấu trúc project rõ ràng để thầy nhìn vào repo là hiểu ngay.

Cấu trúc cần có
ai-image-detector/
├── backend/
├── frontend/
├── extension/
├── experiments/
├── docs/
├── demo/
├── README.md
└── .gitignore
Việc cần làm

- Tạo folder backend
- Tạo folder frontend
- Tạo folder extension
- Tạo folder experiments
- Tạo folder docs
- Tạo folder demo
- Viết README.md tổng quan
- Tạo .gitignore cho Python, Node.js, model weights, env
  Commit
  git add .
  git commit -m "chore(project): initialize AI image detector structure"
