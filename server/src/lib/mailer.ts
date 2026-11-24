import nodemailer from 'nodemailer';

const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM);
const transporter = smtpConfigured ? nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
}) : null;

export function isMailerConfigured() {
  return Boolean(transporter);
}

export async function sendVerificationEmail(input: { email: string; firstName: string; token: string }) {
  if (!transporter) return false;
  const baseUrl = process.env.APP_URL || 'http://localhost:4000';
  const verificationUrl = `${baseUrl}/api/v1/auth/verify-email?token=${encodeURIComponent(input.token)}`;
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: input.email,
    subject: 'Verify your Ground account',
    text: `Hi ${input.firstName}, verify your Ground account here: ${verificationUrl}`,
    html: `<p>Hi ${input.firstName},</p><p>Verify your Ground account to start shopping:</p><p><a href="${verificationUrl}">Verify your email</a></p>`,
  });
  return true;
}
