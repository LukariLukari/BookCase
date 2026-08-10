import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 465

def send_otp_email(recipient_email: str, otp_code: str, purpose: str):
    """
    Sends an OTP email. If SMTP credentials are not set, it logs to console instead.
    """
    if purpose == "register":
        subject = "Xác thực Đăng ký tài khoản BookCase"
        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #ff6b00; text-align: center;">BookCase.</h2>
            <p>Chào bạn,</p>
            <p>Cảm ơn bạn đã đăng ký tài khoản tại BookCase. Đây là mã OTP xác thực của bạn:</p>
            <div style="background-color: #f8f7f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                {otp_code}
            </div>
            <p style="color: #666; font-size: 12px;">Mã OTP này có hiệu lực trong vòng 5 phút. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
        </div>
        """
    else:
        subject = "Khôi phục Mật khẩu BookCase"
        body_html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
            <h2 style="color: #ff6b00; text-align: center;">BookCase.</h2>
            <p>Chào bạn,</p>
            <p>Chúng tôi nhận được yêu cầu khôi phục mật khẩu từ bạn. Đây là mã OTP của bạn:</p>
            <div style="background-color: #f8f7f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px; margin: 20px 0;">
                {otp_code}
            </div>
            <p style="color: #666; font-size: 12px;">Mã OTP này có hiệu lực trong vòng 5 phút. Nếu bạn không yêu cầu khôi phục mật khẩu, vui lòng bỏ qua email này.</p>
        </div>
        """

    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"\n[MOCK EMAIL] To: {recipient_email} | Subject: {subject} | OTP: {otp_code}\n")
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"BookCase <{SMTP_EMAIL}>"
        msg["To"] = recipient_email

        part = MIMEText(body_html, "html")
        msg.attach(part)

        # Using SMTP_SSL for port 465
        with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, recipient_email, msg.as_string())
        
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
