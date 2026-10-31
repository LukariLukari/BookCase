# Web Push nhắc hạn hủy gói — cài đặt và sử dụng

Tính năng nằm tại **Lịch gia hạn → Thông báo nhắc hủy · Web Push** (`/business/subscriptions`). Máy chủ gửi thông báo đến từng thiết bị đã đăng ký; trang không cần đang mở. Người dùng có thể chọn nhắc trước **0 / 1 / 3 / 7 ngày**, mặc định 3 ngày. Mỗi ngày gửi tối đa một bản tổng hợp cho mỗi thiết bị khi có gói cần xử lý, bao gồm gói quá hạn. Khi gói được đánh dấu đã hủy hoặc đã gia hạn, các lần kiểm tra sau sẽ bỏ qua kỳ đó.

Thông báo chỉ nêu số gói cần chú ý; bấm vào sẽ mở lịch để xem dữ liệu mới nhất. Không đưa tên khách, tài khoản ứng dụng hoặc liên hệ khách lên màn hình khóa. Bộ gửi và kiểm thử dùng thư viện `web-push`, không cần tạo dự án Firebase hoặc đăng ký Apple Developer.

## 1. Cấu hình máy chủ một lần

### Tạo khóa

Mở terminal trong thư mục `frontend`:

```powershell
npm.cmd install
npm.cmd run push:keys
```

Nếu terminal đã ở gốc repository, chạy `cd frontend` trước. Trên macOS/Linux dùng `npm` thay cho `npm.cmd`.

Lệnh in ra bốn dòng cấu hình:

```dotenv
WEB_PUSH_PUBLIC_KEY=<khóa công khai vừa tạo>
WEB_PUSH_PRIVATE_KEY=<khóa riêng vừa tạo>
WEB_PUSH_SUBJECT=mailto:email-that-cua-ban@example.com
CRON_SECRET=<chuỗi bí mật vừa tạo>
```

Thay địa chỉ trong `WEB_PUSH_SUBJECT` bằng email thật của người vận hành, giữ tiền tố `mailto:`. Khóa riêng và `CRON_SECRET` chỉ đặt trên máy chủ, không dùng tiền tố `NEXT_PUBLIC_`, không đưa vào Git hoặc gửi cho người dùng. Giữ nguyên cặp khóa sau các lần deploy. Đổi khóa buộc mọi thiết bị bật đăng ký lại; đổi tên miền cũng cần đăng ký trên tên miền mới.

### Nếu chạy trên Vercel

1. Trong project Vercel, kiểm tra **Root Directory = `frontend`**, **Build Command = `npm run build`**. File cấu hình cron là `frontend/vercel.json`, nên thư mục gốc của project phải đúng.
2. Mở **Settings → Environment Variables**, thêm bốn biến ở trên cho **Production**. Dán đúng giá trị, không dán dấu ngoặc `< >` hoặc tên biến vào ô giá trị. Có thể cấu hình riêng cho Preview nếu cần thử đăng ký; cron Vercel chỉ chạy ở Production.
3. Giữ các biến `DATABASE_URL`, `JWT_SECRET` đang có. Web Push lưu thiết bị vào cùng PostgreSQL của ứng dụng.
4. Deploy lại phiên bản có code mới. Build script hiện có chạy `prisma generate` và `prisma db push`, thêm bảng `SubscriptionPushDevice` khi có URL PostgreSQL. Kiểm tra build thành công trước khi bật tính năng.
5. Mở **Settings → Cron Jobs** và kiểm tra job `/api/cron/subscription-reminders` đã xuất hiện và được bật.
6. Mở website Production qua **HTTPS** để đăng ký thiết bị theo phần 2.

Lịch mặc định trong `vercel.json`:

```json
{ "path": "/api/cron/subscription-reminders", "schedule": "0 2 * * *" }
```

Cron sử dụng **UTC**: `02:00 UTC = 09:00 Việt Nam`. Trên Vercel Hobby, job chạy một lần/ngày và có thể bắt đầu bất cứ lúc nào trong khoảng **09:00–09:59**, chưa tính độ trễ khi giao thông báo. Không cam kết đúng phút. Vercel tự gửi header `Authorization: Bearer <CRON_SECRET>`; không cần đưa bí mật vào URL. Thay lịch trong file rồi deploy lại nếu muốn đổi giờ.

### Nếu chạy ở máy cá nhân hoặc máy chủ khác

1. Sao chép `frontend/.env.example` thành `frontend/.env` nếu chưa có file môi trường. Nếu đã có, chỉ thêm các biến còn thiếu, giữ thông tin cơ sở dữ liệu và tài khoản hiện tại.
2. Điền các giá trị Web Push đã tạo, `DATABASE_URL` và `JWT_SECRET`.
3. Chạy từ thư mục `frontend`:

```powershell
npx.cmd prisma generate
npx.cmd prisma db push
npm.cmd run dev
```

4. Truy cập `http://localhost:3000` trên chính máy chạy web để thử. `localhost` được trình duyệt xem là môi trường an toàn. Điện thoại truy cập `http://192.168...` không đáp ứng điều kiện HTTPS; để thử trên điện thoại, dùng website HTTPS đã deploy hoặc tunnel HTTPS do bạn cấu hình.
5. `npm run dev` **không tự chạy cron**. Trên hosting khác, cấu hình bộ lập lịch bên ngoài gọi `GET https://TEN-MIEN/api/cron/subscription-reminders` mỗi ngày, kèm header Authorization ở trên. Máy chủ ứng dụng và PostgreSQL phải hoạt động khi job chạy. Thiết bị nhận có thể đóng tab.

## 2. Bật trên từng thiết bị

### Máy tính — Chrome, Edge, Firefox hoặc Safari có hỗ trợ Web Push

1. Mở website HTTPS, đăng nhập tài khoản của bạn.
2. Vào **Lịch gia hạn**.
3. Trong **Thông báo nhắc hủy · Web Push**, chọn số ngày nhắc trước. Mốc tính theo **Ngày nhắc hủy** của gói, không nhất thiết là ngày hết hạn.
4. Bấm **Bật Web Push trên thiết bị**, chọn **Cho phép / Allow** khi trình duyệt hỏi quyền.
5. Khi thấy **Đã bật trên thiết bị này**, bấm **Gửi thử**.
6. Khi thông báo đến, bấm vào để kiểm tra lịch mở đúng.

Đóng tab không xóa đăng ký. Một số trình duyệt máy tính cần tiếp tục chạy nền; thoát hẳn trình duyệt hoặc tắt máy có thể làm thông báo đến muộn. Bật quyền thông báo cho trình duyệt trong Windows/macOS nếu đã cho phép trên website mà vẫn không thấy.

### Android

1. Mở website HTTPS bằng Chrome hoặc trình duyệt có Push API, đăng nhập.
2. Có thể thêm Billy vào màn hình chính để mở tiện hơn.
3. Vào **Lịch gia hạn**, chọn thời điểm nhắc, bấm **Bật Web Push trên thiết bị → Cho phép**.
4. Bấm **Gửi thử**. Nếu không thấy, kiểm tra quyền thông báo của trình duyệt trong cài đặt Android, chế độ tiết kiệm pin và Không làm phiền.

### iPhone/iPad

1. Dùng thiết bị **iOS/iPadOS 16.4 trở lên**.
2. Mở website HTTPS bằng Safari.
3. Chọn **Chia sẻ → Thêm vào Màn hình chính / Add to Home Screen → Thêm**. Vị trí mục này có thể thay đổi theo phiên bản hệ điều hành.
4. Đóng tab Safari và mở Billy **từ biểu tượng vừa thêm trên màn hình chính**.
5. Đăng nhập trong Billy, vào **Lịch gia hạn**, chọn số ngày nhắc trước.
6. Bấm **Bật Web Push trên thiết bị → Cho phép** rồi **Gửi thử**.
7. Nếu không thấy, vào **Cài đặt → Thông báo → Billy**, kiểm tra quyền, màn hình khóa và chế độ Tập trung/Không làm phiền.

Chỉ mở web trong tab Safari thông thường chưa đủ cho luồng Web Push trên iPhone/iPad. Không dùng trình duyệt nhúng của Zalo/Facebook để đăng ký.

## 3. Kiểm tra gửi nhắc thật khi đã đóng tab

**Gửi thử** gửi thông báo từ máy chủ qua dịch vụ push, kể cả khi chưa có gói đến hạn. Trạng thái thành công có nghĩa dịch vụ push đã nhận yêu cầu, không phải xác nhận người dùng đã nhìn thấy. Giới hạn một lần gửi thử mỗi 30 giây/thiết bị.

Để kiểm tra toàn bộ luồng cron:

1. Bật Web Push và xác nhận thông báo thử đã đến.
2. Thêm một gói thử đang theo dõi, có **Ngày nhắc hủy = hôm nay** và ngày bắt đầu/thời hạn phù hợp. Không đánh dấu hủy hoặc gia hạn gói thử.
3. Đóng tab Billy; trên máy tính để trình duyệt tiếp tục chạy nền.
4. Gọi endpoint cron từ terminal khác hoặc bộ lập lịch. Ví dụ PowerShell dưới đây yêu cầu nhập `CRON_SECRET` đã cấu hình; bí mật không xuất hiện trong lịch sử câu lệnh:

```powershell
$pushSecret = Read-Host 'Nhap CRON_SECRET' -AsSecureString
$pushCredential = New-Object System.Management.Automation.PSCredential('cron', $pushSecret)
$pushHeaders = @{ Authorization = 'Bearer ' + $pushCredential.GetNetworkCredential().Password }
Invoke-RestMethod -Uri 'https://TEN-MIEN-CUA-BAN/api/cron/subscription-reminders' -Headers $pushHeaders -Method Get
Remove-Variable pushHeaders, pushCredential, pushSecret
```

Khi chạy local thay URL bằng `http://localhost:3000/api/cron/subscription-reminders`. Đừng chạy thử trên localhost rồi chờ thiết bị đăng ký ở tên miền Production nhận thông báo: chúng cần cùng cấu hình máy chủ và cơ sở dữ liệu phù hợp.

5. Phản hồi có dạng `{ sent, skipped, expired, failed, incomplete }`. `sent` là số thiết bị được dịch vụ push chấp nhận gửi; không phải số gói. Nếu đã nhắc thiết bị đó hôm nay, chạy lại không gửi thêm; dùng **Gửi thử** để thử thông báo nhiều lần mà không thay lịch nhắc hằng ngày.
6. Bấm thông báo, đánh dấu gói thử đã hủy. Các ngày sau gói đó không còn được tính. Nếu tài khoản vẫn còn gói đến hạn khác, bản tổng hợp vẫn được gửi.

## 4. Dùng hằng ngày

- **Trước 3 ngày**: bắt đầu có mặt trong bản tổng hợp khi ngày cần hủy cách hôm nay tối đa 3 ngày. Tiếp tục nhắc hằng ngày cho đến khi xử lý. Chỉ gửi khi cron chạy, không gửi ngay khi vừa thêm gói.
- **Đúng ngày hủy**: chỉ tính gói đến hạn hôm nay và gói quá hạn.
- Gói sửa ngày sẽ được kiểm tra theo dữ liệu mới ở lần cron kế tiếp. Thông báo đã nằm trong hàng đợi hoặc đã hiện trước đó không thể thu hồi; mở lịch để xem trạng thái hiện tại.
- Chọn số ngày khác khi đã bật: tự lưu lên máy chủ cho **thiết bị hiện tại**.
- Điện thoại và máy tính dùng cùng tài khoản: bật riêng trên từng thiết bị. Hỗ trợ tối đa 20 đăng ký/tài khoản.
- **Tắt Web Push trên thiết bị** chỉ tắt đăng ký hiện tại. **Đăng xuất** cũng thử xóa đăng ký trên máy chủ và hủy đăng ký trong trình duyệt; khi đăng nhập lại cần bật lại.
- Đăng ký thiết bị không nằm trong bản sao lưu dữ liệu kinh doanh; khôi phục bản sao lưu không sao chép địa chỉ push sang thiết bị khác.
- Nút **Tải lịch nhắc** vẫn dùng được độc lập. Lịch `.ics` đã nhập không tự đồng bộ; dùng cả lịch và Web Push có thể nhắc hai lần.

## 5. Xử lý lỗi và giới hạn

| Hiện tượng | Cách kiểm tra |
| --- | --- |
| Máy chủ chưa cấu hình Web Push | Kiểm tra bốn biến môi trường, deploy lại rồi bấm **Kiểm tra lại**. Không thêm dấu nháy bao quanh giá trị trong Vercel. |
| Không thể cập nhật thông báo / lỗi cơ sở dữ liệu | Kiểm tra PostgreSQL đã có bảng `SubscriptionPushDevice`, build schema thành công và `DATABASE_URL` đúng. |
| Nút bật không dùng được | Dùng HTTPS hoặc localhost; trên iPhone mở từ màn hình chính; dùng trình duyệt hỗ trợ Push API. |
| Trước đây đã chặn thông báo | Mở cài đặt quyền website/hệ điều hành để cho phép; website không thể tự vượt qua lựa chọn chặn của bạn. |
| Gửi thử thành công nhưng không hiện | Kiểm tra quyền hệ điều hành, Tập trung/Không làm phiền, mạng, tiết kiệm pin và việc trình duyệt đã thoát hẳn. |
| Gửi thử được nhưng không có nhắc hằng ngày | Kiểm tra cron Production có bật, header bí mật đúng, có gói active nằm trong cửa sổ nhắc, và thiết bị chưa được nhắc hôm nay. |
| Cron trả 401 | `CRON_SECRET` thiếu hoặc Authorization không khớp. Khi gọi thủ công cần tiền tố `Bearer ` và giá trị đúng. |
| Cron trả 503 | Thiếu/sai cấu hình, lỗi DB/dịch vụ push, hoặc chưa xử lý hết thiết bị trong thời gian cho phép. Xem JSON và logs; chạy lại sau ít nhất 2 phút nếu có tác vụ bị ngắt. |
| Đăng ký hết hiệu lực / đổi khóa VAPID | Tắt rồi bật lại Web Push. Máy chủ tự xóa đăng ký khi nhà cung cấp trả 404/410. |
| Chuyển tên miền, xóa dữ liệu trình duyệt hoặc cài lại app | Mở đúng website rồi bật đăng ký lại. |

Không bảo đảm giao đúng giờ hoặc giao 100%: thiết bị mất mạng/tắt máy, quyền bị thu hồi hoặc giới hạn hệ điều hành đều có thể ngăn nhận. Tin nhắc thường được giữ ở dịch vụ push tối đa 24 giờ, tin thử 5 phút. Tin quá cũ sẽ hết hạn.

Cron dùng khóa tạm trong PostgreSQL để ngăn gửi đồng thời và lưu ngày đã gửi để tránh lặp trong ngày. Nếu tiến trình chết ngay sau khi dịch vụ push đã nhận nhưng trước khi DB được cập nhật, lần thử lại vẫn có thể gửi trùng. Thông báo dùng tag cố định theo tài khoản/ngày để thay thế trên trình duyệt có hỗ trợ.

Vercel không tự retry cron lỗi. Bộ xử lý trả 503 khi có lỗi hoặc hết khoảng thời gian làm việc khoảng 40 giây; người vận hành cần kiểm tra logs và chạy lại, hoặc dùng scheduler có retry nếu cần độ tin cậy cao hơn. Các thiết bị đã gửi thành công trong ngày được bỏ qua. Nếu lượng thiết bị lớn, cần thêm hàng đợi hoặc tăng tần suất chạy phù hợp gói hosting.

Luồng này chỉ hỗ trợ endpoint của Google FCM, Mozilla Push, Apple Push và Windows Notification Service, chặn URL tùy ý để bảo vệ máy chủ. Không gửi email, SMS hoặc tự hủy gói trên dịch vụ bên ngoài.

## 6. Kiểm tra code

Từ `frontend`:

```powershell
npm.cmd run test:subscriptions
npm.cmd run test:push
npx.cmd tsc --noEmit --incremental false
```

Các test dùng DB và dịch vụ push giả lập, không gửi tin thật hoặc sửa PostgreSQL. Kiểm tra thiết bị thực tế vẫn cần thực hiện theo phần 3 sau khi cấu hình và deploy.

Tài liệu nền tảng: [Web Push trên iOS/iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [thư viện web-push](https://github.com/web-push-libs/web-push), [giới hạn cron Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing), [bảo vệ và vận hành cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).
