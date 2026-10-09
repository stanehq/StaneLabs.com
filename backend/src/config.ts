import { isEmail } from 'class-validator';

export function validateEnvironment(input: Record<string, unknown>): Record<string, unknown> {
  const env = { ...input };
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port.');
  env.PORT = port;
  const origin = String(env.FRONTEND_ORIGIN || 'https://stanelabs.com');
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new Error('FRONTEND_ORIGIN must be one valid HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || parsed.username || parsed.password) throw new Error('FRONTEND_ORIGIN must be an exact HTTP(S) origin without path.');
  env.FRONTEND_ORIGIN = origin;
  env.HOST = String(env.HOST || '0.0.0.0');
  const smtpPort = Number(env.SMTP_PORT || 587);
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535) throw new Error('SMTP_PORT must be a valid port.');
  env.SMTP_PORT = smtpPort;
  const secure = String(env.SMTP_SECURE ?? (smtpPort === 465 ? 'true' : 'false'));
  if (!['true', 'false'].includes(secure)) throw new Error('SMTP_SECURE must be true or false.');
  env.SMTP_SECURE = secure === 'true';
  env.SECURITY_EMAIL = String(env.SECURITY_EMAIL || 'security@stanelabs.com');
  for (const field of ['SECURITY_EMAIL', 'SMTP_FROM']) {
    const value = String(env[field] || '');
    if ((field === 'SECURITY_EMAIL' || value) && (!isEmail(value) || /[\r\n]/.test(value))) throw new Error(`${field} must be a single valid email address.`);
  }
  const proxy = String(env.TRUST_PROXY || '').trim();
  if (['true', '*'].includes(proxy)) throw new Error('TRUST_PROXY must name the real proxy IP/subnet, not trust every source.');
  env.TRUST_PROXY = proxy;
  return env;
}
