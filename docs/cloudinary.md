# Cloudinary — Tại sao dùng và cách cấu hình

## Tại sao dùng Cloudinary?

Project lưu ảnh lên Cloudinary vì:
1. **Persistent storage** — File upload tạm thời trên server sẽ bị xóa khi restart (đặc biệt khi deploy Docker/Cloud).
2. **CDN miễn phí** — Ảnh được phục vụ qua CDN toàn cầu → tải nhanh.
3. **Auto thumbnail** — Cloudinary hỗ trợ resize/crop qua URL parameter (không cần xử lý thêm).
4. **Free tier** — 25GB storage, 25GB bandwidth/tháng, đủ để demo đồ án.

## Cách tạo tài khoản Cloudinary

1. Truy cập https://cloudinary.com/ → **Sign Up for Free**
2. Điền thông tin đăng ký (có thể dùng email trường)
3. Sau khi đăng nhập, vào **Dashboard**

## Cách lấy credentials

Trong Cloudinary Dashboard:

| Thông tin | Cách lấy |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Hiển thị ở góc trên dashboard: `Cloud name: xxxxx` |
| `CLOUDINARY_API_KEY` | Tab **API Keys** → copy **API Key** |
| `CLOUDINARY_API_SECRET` | Tab **API Keys** → click **Reveal** cạnh **API Secret** |

## Cách cấu hình .env

Mở file `backend/.env` và điền vào:

```env
ENABLE_CLOUDINARY_UPLOAD=true
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=ai-image-detector/uploads
```

## Nếu không muốn dùng Cloudinary

Đặt `ENABLE_CLOUDINARY_UPLOAD=false` trong `.env`. Hệ thống sẽ hoạt động bình thường (predict vẫn chạy), chỉ là ảnh sẽ không được lưu lại. Trang `/history` sẽ không hiện thumbnail.

## Bảo mật — QUAN TRỌNG

> **KHÔNG bao giờ commit `CLOUDINARY_API_SECRET` lên Git.**

File `.env` đã được thêm vào `.gitignore`. Kiểm tra bằng lệnh:
```bash
git status  # .env không được xuất hiện trong danh sách tracked files
```

Nếu lỡ commit secret:
1. Xóa secret ngay lập tức trên Cloudinary Dashboard → **Regenerate API Secret**
2. Cập nhật `.env` với secret mới
