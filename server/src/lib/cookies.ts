import type { Request, Response } from 'express';
import { config } from '../config.js';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export function getCookie(req: Request, name: string): string | undefined {
  return parseCookies(req.headers.cookie)[name];
}

interface CookieOptions {
  maxAgeMs?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
}

export function setCookie(res: Response, name: string, value: string, options: CookieOptions = {}): void {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path ?? '/'}`];
  if (options.maxAgeMs !== undefined) {
    parts.push(`Max-Age=${Math.floor(options.maxAgeMs / 1000)}`);
    parts.push(`Expires=${new Date(Date.now() + options.maxAgeMs).toUTCString()}`);
  }
  if (options.httpOnly !== false) parts.push('HttpOnly');
  const secure = options.secure ?? config.cookieSecure;
  if (secure) parts.push('Secure');
  // None requires Secure, otherwise browsers drop the cookie entirely.
  const sameSite = options.sameSite ?? config.cookieSameSite;
  parts.push(`SameSite=${sameSite === 'None' && !secure ? 'Lax' : sameSite}`);
  res.append('Set-Cookie', parts.join('; '));
}

export function clearCookie(res: Response, name: string): void {
  const parts = [`${name}=`, 'Path=/', 'Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'];
  const secure = config.cookieSecure;
  if (secure) parts.push('Secure');
  const sameSite = config.cookieSameSite;
  parts.push('HttpOnly', `SameSite=${sameSite === 'None' && !secure ? 'Lax' : sameSite}`);
  res.append('Set-Cookie', parts.join('; '));
}

/**
 * The anonymous CSRF token is a readable double-submit cookie (not HttpOnly by design, it is not
 * a credential). It is bound to the session at login and every mutating request must echo it.
 */
export function ensureCsrfCookie(req: Request, res: Response): string {
  const existing = getCookie(req, config.csrfCookieName);
  if (existing && existing.length >= 20) return existing;
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  setCookie(res, config.csrfCookieName, token, {
    httpOnly: false,
    maxAgeMs: config.sessionTtlMs,
  });
  return token;
}
