/**
 * Normalise a Pakistani-leaning phone number to E.164 for wa.me / SMS links.
 *
 * Accepts local forms like "0300 1234567" or "923001234567" and returns
 * "+923001234567". Numbers that already carry a country code (and "+") are
 * returned unchanged apart from digit cleaning. Returns null when the input
 * cannot be interpreted as a phone number.
 */
export function toE164(input?: string | null, defaultCountryCode = '92'): string | null {
  if (!input) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    const digits = trimmed.replace(/[^\d+]/g, '');
    const body = digits.replace(/\D/g, '');
    return body.length >= 8 ? `+${body}` : null;
  }

  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // Local Pakistani subscriber format: 0XXXXXXXXXX (11 digits) -> 92 + 10 digits
  if (digits.startsWith('0')) {
    const withoutLeadingZero = digits.slice(1);
    return `+${defaultCountryCode}${withoutLeadingZero}`;
  }
  // Already has the country code without a plus sign.
  if (digits.startsWith(defaultCountryCode)) {
    return `+${digits}`;
  }
  // Assume it is a bare subscriber number.
  return `+${defaultCountryCode}${digits}`;
}

/** Build a wa.me deep link that opens WhatsApp with a prefilled message. */
export function buildWhatsAppDeepLink(phone: string | null | undefined, message: string): string | null {
  const e164 = toE164(phone);
  if (!e164) return null;
  const msisdn = e164.replace(/^\+/, '');
  return `https://wa.me/${msisdn}?text=${encodeURIComponent(message)}`;
}
