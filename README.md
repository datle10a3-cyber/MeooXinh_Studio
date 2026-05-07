# Mèo Xinh Studio

Ứng dụng quản lý booking, tài chính, khách hàng và vận hành studio.

## Chạy local với PostgreSQL

1. Cài dependencies:

```bash
npm install
```

2. Tạo file `.env` từ `.env.example` và đổi các secret nếu cần.

3. Bật PostgreSQL local bằng Docker:

```bash
npm run db:up
```

4. Tạo bảng database:

```bash
npm run db:migrate
npm run db:generate
```

5. Chạy app:

```bash
npm run dev
```

Mở `http://localhost:3000`.

## Lệnh database

```bash
npm run db:up       # bật PostgreSQL
npm run db:down     # tắt PostgreSQL
npm run db:migrate  # chạy migration cho database hiện tại
npm run db:dev      # tạo/chạy migration khi đang phát triển
npm run db:studio   # mở Prisma Studio
```

## Ghi chú production

- Dùng PostgreSQL managed database khi triển khai thật.
- Đổi `JWT_SECRET`, mật khẩu database và các API key trước khi public.
- Bật backup database tự động hằng ngày.
- Ảnh nên lưu ở Cloudinary/S3, không lưu file nặng trong database.

## Checklist trước deploy

1. Cấu hình biến môi trường production trên hosting:
   - `DATABASE_URL` trỏ về PostgreSQL production, không dùng localhost/LAN.
   - `JWT_SECRET` là chuỗi random mạnh, tối thiểu 48 ký tự.
   - `AUTH_DEV_BYPASS=false` và `NEXT_PUBLIC_AUTH_DEV_BYPASS=false`.
   - `ALLOW_STUDIO_REGISTRATION=false`, hoặc dùng `STUDIO_REGISTRATION_CODE` mạnh nếu cần mở đăng ký.
   - Có đủ Cloudinary và VAPID keys.

2. Chạy kiểm tra deploy:

```bash
NODE_ENV=production npm run deploy:check
```

3. Trên database production, chạy migration:

```bash
npm run db:migrate
```

4. Sau khi deploy xong, chạy smoke test với tài khoản admin:

```bash
SMOKE_BASE_URL="https://domain-cua-ban" SMOKE_EMAIL="admin@example.com" SMOKE_PASSWORD="..." npm run test:smoke
```
