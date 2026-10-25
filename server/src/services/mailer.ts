import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config.js';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const url = process.env.SMTP_URL;
  if (!url) return null;
  if (!transporter) transporter = nodemailer.createTransport(url);
  return transporter;
}

export function appUrl(): string {
  return process.env.APP_URL ?? `http://localhost:${config.port}`;
}

export interface MailResult {
  delivered: boolean;
  reason?: string;
}

/**
 * Sends the password-reset link. Delivery is optional in this environment: without SMTP_URL the
 * link is logged (never returned to the client in production) so an operator can still help a user.
 */
export async function sendPasswordResetEmail(to: string, token: string, expiresAt: string): Promise<MailResult> {
  const link = `${appUrl()}/aterstall-losenord?token=${encodeURIComponent(token)}`;
  const mail = getTransporter();
  const subject = 'Återställ ditt lösenord i Sparly';
  const text = [
    'Hej!',
    '',
    'Vi fick en begäran om att återställa lösenordet för ditt Sparly-konto.',
    `Öppna länken för att välja ett nytt lösenord: ${link}`,
    `Länken gäller till ${new Date(expiresAt).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })}.`,
    '',
    'Om du inte begärde detta kan du ignorera mejlet – ditt lösenord är oförändrat.',
    '',
    'Sparly – Små steg. Stora mål.',
  ].join('\n');

  if (!mail) {
    if (config.isProduction) {
      console.warn('[sparly] SMTP_URL is not configured: password reset link was not delivered.');
      return { delivered: false, reason: 'smtp_not_configured' };
    }
    console.info(`[sparly] password reset link for ${to}: ${link}`);
    return { delivered: false, reason: 'development_console' };
  }

  try {
    await mail.sendMail({
      from: process.env.MAIL_FROM ?? 'Sparly <no-reply@sparly.se>',
      to,
      subject,
      text,
    });
    return { delivered: true };
  } catch (error) {
    console.error('[sparly] failed to send password reset email', error);
    return { delivered: false, reason: 'send_failed' };
  }
}
