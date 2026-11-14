export const IBAN_COUNTRY_CODES: ReadonlySet<string> = new Set([
  "AD","AE","AL","AT","AZ","BA","BE","BG","BH","BR","BY","CH","CR","CY","CZ",
  "DE","DK","DO","EE","EG","ES","FI","FO","FR","GB","GE","GI","GL","GR","GT",
  "HR","HU","IE","IL","IQ","IS","IT","JO","KW","KZ","LB","LC","LI","LT","LU",
  "LV","MC","MD","ME","MK","MR","MT","MU","NL","NO","PK","PL","PS","PT","QA",
  "RO","RS","SA","SC","SE","SI","SK","SM","ST","SV","TL","TN","TR","UA","VA","VG","XK",
]);

export function isValidIban(value: string): boolean {
  const iban = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban) || iban.length < 15 || iban.length > 34) return false;
  if (!IBAN_COUNTRY_CODES.has(iban.slice(0, 2))) return false;

  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const digits = character >= "A" && character <= "Z"
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of digits) remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1;
}
