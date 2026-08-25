export function normalizeContactPhone(phone: string | null | undefined): string {
  let digits = String(phone || "").replace(/\D/g, "");

  while (digits.startsWith("55") && digits.length > 11) {
    const withoutCountryCode = digits.slice(2);
    if (withoutCountryCode.length < 10) break;
    digits = withoutCountryCode;
  }

  while (digits.startsWith("0") && digits.length > 11) {
    digits = digits.slice(1);
  }

  return digits;
}

export function isValidBrazilianContactPhone(phone: string | null | undefined): boolean {
  const digits = normalizeContactPhone(phone);
  return digits.length === 10 || digits.length === 11;
}
