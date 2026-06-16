/**
 * Thin email helper for Next.js API routes.
 * Uses Resend (https://resend.com). Set RESEND_API_KEY in .env.local to enable.
 * If the key is absent, send() returns silently — never throws.
 */

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const MAIL_FROM = process.env.MAIL_FROM ?? 'OU Roundnet <noreply@ouroundnet.club>';

export async function sendNotificationEmail(opts: {
  to: string | string[];
  subject: string;
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // silently skip

  const to = Array.isArray(opts.to) ? opts.to : [opts.to];

  const btnHtml = opts.link
    ? `
      <div style="text-align:center;margin:28px 0;">
        <a href="${APP_URL}${opts.link}"
           style="background:#FFB81C;color:#0a0a0a;padding:12px 28px;border-radius:8px;
                  font-weight:700;font-size:15px;text-decoration:none;display:inline-block;">
          ${opts.linkLabel ?? 'View in Portal'}
        </a>
      </div>
    `
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:system-ui,sans-serif;">
      <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
        <div style="background:#0a0a0a;padding:24px 32px;text-align:center;">
          <p style="color:#FFB81C;font-size:20px;font-weight:800;margin:0;letter-spacing:.5px;">🏐 OU Roundnet</p>
        </div>
        <div style="padding:32px;">
          <h1 style="font-size:22px;font-weight:700;color:#111;margin:0 0 12px;">${opts.title}</h1>
          <p style="font-size:15px;color:#444;line-height:1.6;margin:0 0 8px;">${opts.body}</p>
          ${btnHtml}
        </div>
        <div style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;text-align:center;">
          <p style="font-size:12px;color:#999;margin:0;">OU Roundnet Club Portal &bull; Automated notification.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: MAIL_FROM, to, subject: opts.subject, html, text: opts.body }),
    });
  } catch {
    // non-fatal
  }
}
