import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter | null = null;

    constructor() {
        this.initializeTransporter();
    }

    private initializeTransporter() {
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;

        if (host && user && pass) {
            this.transporter = nodemailer.createTransport({
                host,
                port,
                secure: port === 465,
                auth: { user, pass },
            });
        }
    }

    async sendPasswordResetOtp(to: string, otp: string): Promise<boolean> {
        const from = process.env.MAIL_FROM || 'no-reply@pharmatrace.io';
        const subject = 'PharmaTrace-ES: Password Reset Verification Code';
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0B1220; color: #F1F5F9; padding: 24px; margin: 0; }
    .card { max-width: 520px; margin: 0 auto; background-color: #172638; border: 1px solid #304257; border-radius: 16px; padding: 32px; }
    .badge { display: inline-block; background-color: rgba(0, 214, 180, 0.15); color: #00D6B4; border: 1px solid rgba(0, 214, 180, 0.4); padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 16px; }
    .title { font-size: 20px; font-weight: 800; color: #F1F5F9; margin-top: 0; margin-bottom: 8px; }
    .text { font-size: 13px; color: #94A3B8; line-height: 1.6; margin-bottom: 24px; }
    .otp-box { background-color: #0B1220; border: 1px dashed #00D6B4; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px; }
    .otp-code { font-family: Courier, monospace; font-size: 32px; font-weight: 900; letter-spacing: 8px; color: #00D6B4; }
    .footer { font-size: 11px; color: #64748B; border-top: 1px solid #304257; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">PharmaTrace-ES Security Notice</div>
    <h1 class="title">Password Reset Verification Code</h1>
    <p class="text">You requested a password reset for your PharmaTrace-ES enterprise account. Use the one-time verification code below to complete your credential recovery:</p>
    <div class="otp-box">
      <div class="otp-code">${otp}</div>
    </div>
    <p class="text">This code will expire in 10 minutes. If you did not initiate this request, you can safely ignore this email.</p>
    <div class="footer">PharmaTrace-ES Cryptographic Track & Trace Platform</div>
  </div>
</body>
</html>
        `;

        this.logger.log(`Password reset OTP for ${to}: [${otp}]`);

        if (this.transporter) {
            try {
                await this.transporter.sendMail({
                    from,
                    to,
                    subject,
                    html,
                    text: `PharmaTrace-ES Password Reset OTP: ${otp}. Valid for 10 minutes.`,
                });
                return true;
            } catch (err: any) {
                this.logger.error(`Failed to send email to ${to}: ${err.message}`);
                return false;
            }
        }

        return true;
    }
}

