export const VALID_BRAZILIAN_DDDS = new Set([
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24', // RJ
  '27', '28', // ES
  '31', '32', '33', '34', '35', '37', '38', // MG
  '41', '42', '43', '44', '45', '46', // PR
  '47', '48', '49', // SC
  '51', '53', '54', '55', // RS
  '61', // DF
  '62', '64', // GO
  '63', // TO
  '65', '66', // MT
  '67', // MS
  '68', // AC
  '69', // RO
  '71', '73', '74', '75', '77', // BA
  '79', // SE
  '81', '87', // PE
  '82', // AL
  '83', // PB
  '84', // RN
  '85', '88', // CE
  '86', '89', // PI
  '91', '93', '94', // PA
  '92', '97', // AM
  '95', // RR
  '96', // AP
  '98', '99', // MA
]);

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

  // Se tiver 10 dígitos com DDD válido e terceiro dígito de celular (6, 7, 8 ou 9), completa com 9
  if (digits.length === 10) {
    const ddd = digits.slice(0, 2);
    const third = digits.slice(2, 3);
    if (VALID_BRAZILIAN_DDDS.has(ddd) && ['6', '7', '8', '9'].includes(third)) {
      digits = `${ddd}9${digits.slice(2)}`;
    }
  }

  return digits;
}

export function isValidBrazilianContactPhone(phone: string | null | undefined): boolean {
  const digits = normalizeContactPhone(phone);
  if (digits.length !== 10 && digits.length !== 11) return false;
  const ddd = digits.slice(0, 2);
  return VALID_BRAZILIAN_DDDS.has(ddd);
}
