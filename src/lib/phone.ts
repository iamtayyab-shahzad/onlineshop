/**
 * Pakistani mobile numbers. Customers can type 0300 1234567, 0300-1234567,
 * +92 300 1234567 or 923001234567; all become "03001234567".
 * Returns null when it is not a valid mobile number.
 */
export function normalizePkMobile(input: string): string | null {
  const compact = input.replace(/[\s\-().]/g, "");
  const match = /^(?:\+92|0092|92|0)?(3\d{9})$/.exec(compact);
  return match ? `0${match[1]}` : null;
}

/** "03001234567" → "0300 1234567" for display. */
export function formatPkMobile(phone: string): string {
  return /^03\d{9}$/.test(phone) ? `${phone.slice(0, 4)} ${phone.slice(4)}` : phone;
}
