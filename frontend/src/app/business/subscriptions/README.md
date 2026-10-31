# Lịch gia hạn

Trang `/business/subscriptions`, mở từ mục **Lịch gia hạn** trong menu.

- Lưu khách hàng (chọn từ CRM hoặc nhập trực tiếp), tài khoản ứng dụng, tên gói, thời hạn, giá, tiền tệ và ghi chú.
- Tên khách mặc định là **Khách lẻ**. Ứng dụng chọn từ danh sách (có sẵn Canva, Netflix và ứng dụng từng dùng); **Thêm ứng dụng** lưu app riêng theo tài khoản, không giới hạn số lượng. Danh sách app được sao lưu cùng dữ liệu kinh doanh.
- Giá gói tự chèn dấu phẩy phân nhóm mỗi 3 chữ số khi nhập, ví dụ `1,500,000`; hỗ trợ tối đa 2 chữ số thập phân với dấu chấm. API vẫn nhận chuỗi số chưa phân nhóm.
- Kỳ hạn tính theo ngày / tháng / năm; các kỳ tháng và năm được chặn về ngày cuối tháng khi cần.
- Ngày nhắc mặc định **đúng ngày hết hạn**, có thể chỉnh sớm hơn trong thời gian gói.
- Lịch tháng hiển thị hẹn theo **ngày nhắc hủy**. Chi tiết hiển thị cả ngày bắt đầu và ngày hết hạn.
- Trạng thái **Đã hủy** là ghi nhận thao tác xử lý của người dùng. **Gia hạn kỳ tiếp** tạo bản ghi mới, giữ kỳ cũ ở trạng thái **Đã gia hạn**.
- **Web Push từ máy chủ:** bật trong mục **Thông báo nhắc hủy**, cấp quyền và dùng **Gửi thử** để kiểm tra. Nhận bản tổng hợp mỗi ngày từ trước hạn 1 / 3 / 7 ngày (hoặc đúng ngày), bao gồm gói quá hạn chưa xử lý. Không cần mở trang. Lịch mặc định 9 giờ sáng UTC+7; giờ thực tế tùy bộ lập lịch, mạng và thiết bị. Cài đặt riêng theo tài khoản và thiết bị, lưu trong PostgreSQL. Xem [hướng dẫn cài đặt và sử dụng Web Push](../../../../WEB_PUSH.md).
- Nhắc khi đóng web: chọn **Tải lịch nhắc**, mở tệp `.ics` và nhập vào lịch thiết bị (Apple Calendar / Google Calendar / Outlook). Chỉ xuất gói đang theo dõi từ hôm nay trở đi, lịch hẹn 9:00 UTC+7, cảnh báo trước số ngày đã chọn và đúng ngày hủy. Khả năng giữ cảnh báo khi nhập tùy ứng dụng lịch; kiểm tra cảnh báo và quyền thông báo sau khi nhập. Tệp có tên khách và ứng dụng, không chứa tài khoản ứng dụng hay liên hệ khách.
- Lịch xuất là bản chụp, không tự đồng bộ: khi sửa, hủy hoặc gia hạn gói, xóa sự kiện cũ trong lịch thiết bị rồi nhập lại. Không có gửi email hay tự hủy trên dịch vụ bên ngoài.
- Dữ liệu được tách theo tài khoản và tích hợp vào sao lưu / khôi phục dữ liệu kinh doanh. Bản sao lưu v2 cũ được hiểu là chưa có gói đăng ký.

## Cơ sở dữ liệu

Model: `CustomerSubscription`, `SubscriptionApp` và `SubscriptionPushDevice` trong `prisma/schema.prisma`. Đăng ký thiết bị không được đưa vào sao lưu kinh doanh để tránh sao chép địa chỉ nhận push.
Sau khi cấu hình `DATABASE_URL` cho môi trường phát triển:

```sh
npx prisma generate
npx prisma db push
```

Luồng build Vercel hiện có (`scripts/vercel-build.mjs`) tự đồng bộ schema khi có URL PostgreSQL.

## Kiểm tra

```sh
npm run test:subscriptions
npm run test:push
npx tsc --noEmit --incremental false
```

Các bài kiểm tra API dùng dữ liệu trong bộ nhớ, không truy cập PostgreSQL thật. Kiểm tra ngày cuối tháng / năm nhuận, ngày nhắc, dữ liệu đầu vào, các thao tác CRUD, phân quyền theo tài khoản và chống gia hạn trùng.
