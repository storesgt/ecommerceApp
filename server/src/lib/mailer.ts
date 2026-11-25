import nodemailer from 'nodemailer';
import { prisma } from './prisma';

const smtpSettingKeys = ['smtpHost', 'smtpPort', 'smtpSecure', 'smtpUser', 'smtpPassword', 'smtpFrom', 'supportEmail', 'storeName', 'storeLogo'];

async function getSmtpConfig() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: smtpSettingKeys } } });
  const settings = new Map(rows.map(({ key, value }) => [key, value]));
  const getString = (key: string, fallback: string | undefined = '') => {
    const value = settings.get(key);
    return value === undefined ? fallback || '' : typeof value === 'string' ? value : '';
  };
  const useAdminSmtp = Boolean(getString('smtpHost'));
  const host = useAdminSmtp ? getString('smtpHost') : process.env.SMTP_HOST || '';
  const user = useAdminSmtp ? getString('smtpUser') : process.env.SMTP_USER || '';
  const password = useAdminSmtp ? getString('smtpPassword') : process.env.SMTP_PASSWORD || '';
  const from = (useAdminSmtp ? getString('smtpFrom') : '')
    || getString('supportEmail')
    || process.env.EMAIL_FROM
    || '';
  const configuredPortRaw = useAdminSmtp ? settings.get('smtpPort') : process.env.SMTP_PORT;
  const configuredPort = Number(configuredPortRaw === undefined || configuredPortRaw === '' ? 587 : configuredPortRaw);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 587;
  const secureSetting = useAdminSmtp ? settings.get('smtpSecure') : undefined;
  const secure = secureSetting === undefined
    ? process.env.SMTP_SECURE === 'true'
    : secureSetting === true || secureSetting === 'true';
  const storeName = getString('storeName', process.env.APP_NAME || 'Ground').trim() || 'Ground';
  const supportEmail = getString('supportEmail');
  const appUrl = process.env.APP_URL || 'http://localhost:4000';
  const storeLogo = getString('storeLogo');
  const candidateLogoUrl = storeLogo && URL.canParse(appUrl) && URL.canParse(storeLogo, appUrl)
    ? new URL(storeLogo, appUrl)
    : undefined;
  const logoUrl = candidateLogoUrl && (candidateLogoUrl.protocol === 'http:' || candidateLogoUrl.protocol === 'https:')
    ? candidateLogoUrl.href
    : '';

  return { host, port, secure, user, password, from, storeName, supportEmail, logoUrl, appUrl, adminConfigured: useAdminSmtp };
}

function createTransporter(config: Awaited<ReturnType<typeof getSmtpConfig>>) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

export function renderBrandedEmail(config: Awaited<ReturnType<typeof getSmtpConfig>>, content: string, preheader = '') {
  const storeName = escapeHtml(config.storeName);
  const supportEmail = config.supportEmail.trim();
  const preheaderText = escapeHtml(preheader || `${config.storeName} notification`);
  const logo = config.logoUrl
    ? `<img src="${escapeHtml(config.logoUrl)}" alt="${storeName} logo" width="140" style="display:block;max-width:140px;max-height:44px;width:auto;height:auto;border:0;outline:none;text-decoration:none">`
    : `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="width:40px;height:40px;border-radius:12px;background:#20211d;color:#f5f7f2;text-align:center;font-size:18px;font-weight:700;line-height:40px;font-family:Arial,Helvetica,sans-serif">${escapeHtml(config.storeName.charAt(0).toUpperCase() || 'S')}</td><td style="padding-left:12px;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#20211d;font-family:Arial,Helvetica,sans-serif">${storeName}</td></tr></table>`;
  const brand = config.logoUrl
    ? `<table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse"><tr><td style="vertical-align:middle">${logo}</td><td style="vertical-align:middle;padding-left:12px;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:#20211d;font-family:Arial,Helvetica,sans-serif">${storeName}</td></tr></table>`
    : logo;
  const support = supportEmail
    ? `Need help? <a href="mailto:${escapeHtml(supportEmail)}" style="color:#4b5563;text-decoration:underline">${escapeHtml(supportEmail)}</a>`
    : 'This is an automated message from our store.';
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>${storeName}</title>
  </head>
  <body style="margin:0;padding:0;background:#eef2ec;color:#20211d;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheaderText}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2ec;margin:0;padding:24px 12px;border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dde3d8;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 20px;background:#f7faf5;border-bottom:1px solid #e5ebe1;">
                ${brand}
              </td>
            </tr>
            <tr>
              <td style="padding:32px;font-size:15px;line-height:1.7;color:#374151;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#fbfcfa;border-top:1px solid #e5ebe1;font-size:12px;line-height:1.7;color:#6b7280;">
                <div style="font-weight:600;color:#4b5563;">${storeName}</div>
                <div>${support}</div>
                <div style="margin-top:8px;color:#9ca3af;">© ${year} ${storeName}. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function plainEmailFooter(config: Awaited<ReturnType<typeof getSmtpConfig>>) {
  return `\n\n--\n${config.storeName}${config.supportEmail ? `\nSupport: ${config.supportEmail}` : '\nAutomated message from our store.'}`;
}

export class MailDeliveryError extends Error {
  readonly code: string;
  readonly responseCode?: number;

  constructor(error: unknown) {
    super('SMTP email delivery failed');
    this.name = 'MailDeliveryError';
    const details = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
    this.code = typeof details.code === 'string' ? details.code : '';
    this.responseCode = typeof details.responseCode === 'number' ? details.responseCode : undefined;
  }
}

export function mailDeliveryErrorMessage(error: MailDeliveryError) {
  if (error.code === 'EDNS' || error.code === 'ENOTFOUND') {
    return 'The SMTP host could not be resolved. Check the hostname for typos and confirm its DNS record is active.';
  }
  if (error.code === 'ECONNECTION' || error.code === 'ECONNREFUSED') {
    return 'Could not connect to the SMTP server. Check the host, port, and TLS setting, and confirm the server allows connections.';
  }
  if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
    return 'The SMTP server did not respond in time. Check the host, port, TLS setting, and network access.';
  }
  if (error.code === 'EAUTH' || error.responseCode === 535) {
    return 'The SMTP server rejected authentication. Check the username and password; some providers require an app password.';
  }
  if (error.code === 'EENVELOPE' || (error.responseCode !== undefined && error.responseCode >= 500)) {
    return 'The SMTP server rejected the sender or recipient. Check that the sender address is authorized and the recipient is valid.';
  }
  return 'The SMTP server could not accept the test email. Check the saved SMTP settings and sender permissions.';
}

export async function isMailerConfigured() {
  const config = await getSmtpConfig();
  return Boolean(config.host && config.user && config.password && config.from);
}

export async function sendTestEmail(recipient: string) {
  const config = await getSmtpConfig();
  if (!config.adminConfigured || !config.host || !config.user || !config.password || !config.from) return false;
  const storeName = escapeHtml(config.storeName);
  const content = `
    <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Email delivery</p>
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.25;color:#111827;font-weight:700;">SMTP test successful</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#4b5563;">Your ${storeName} email settings are working. This test message was sent through your configured SMTP provider and accepted for delivery.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px;">
      <tr>
        <td style="border-radius:12px;background:#20211d;">
          <span style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;color:#ffffff;">Delivery confirmed</span>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">If you found this message in spam, mark it as “Not spam” and ask your mail provider to configure SPF, DKIM, and DMARC for your sender domain.</p>`;
  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    await transporter.sendMail({
      from: config.from,
      to: recipient,
      replyTo: config.supportEmail || undefined,
      subject: `${config.storeName} - SMTP test successful`,
      text: `SMTP test successful\n\nYour ${config.storeName} email settings are working. This test message was sent through your configured SMTP provider and accepted for delivery.${plainEmailFooter(config)}`,
      html: renderBrandedEmail(config, content, `Your ${config.storeName} SMTP test was delivered successfully.`),
    });
  } catch (error) {
    throw new MailDeliveryError(error);
  }
  return true;
}

export async function sendVerificationEmail(input: { email: string; firstName: string; token: string }) {
  const config = await getSmtpConfig();
  if (!config.host || !config.user || !config.password || !config.from) return false;
  const transporter = createTransporter(config);
  const verificationUrl = `${config.appUrl.replace(/\/+$/, '')}/api/v1/auth/verify-email?token=${encodeURIComponent(input.token)}`;
  const firstName = escapeHtml(input.firstName);
  const storeName = escapeHtml(config.storeName);
  const link = escapeHtml(verificationUrl);
  const content = `
    <p style="margin:0 0 16px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Account verification</p>
    <h1 style="margin:0 0 12px;font-size:28px;line-height:1.25;color:#111827;font-weight:700;">Verify your email address</h1>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.75;color:#4b5563;">Hi ${firstName}, confirm your email address to activate your ${storeName} account and continue securely.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 24px;">
      <tr>
        <td style="border-radius:12px;background:#20211d;">
          <a href="${link}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Verify email address</a>
        </td>
      </tr>
    </table>
    <p style="margin:0;font-size:13px;line-height:1.7;color:#6b7280;">If the button doesn’t work, copy and paste this link into your browser:<br><a href="${link}" target="_blank" rel="noopener noreferrer" style="color:#20211d;word-break:break-all;text-decoration:underline;">${link}</a></p>`;
  await transporter.sendMail({
    from: config.from,
    to: input.email,
    replyTo: config.supportEmail || undefined,
    subject: `Verify your ${config.storeName} account`,
    text: `Hi ${input.firstName}, confirm your email address to activate your ${config.storeName} account: ${verificationUrl}${plainEmailFooter(config)}`,
    html: renderBrandedEmail(config, content, `Confirm your email address to activate your ${config.storeName} account.`),
  });
  return true;
}
