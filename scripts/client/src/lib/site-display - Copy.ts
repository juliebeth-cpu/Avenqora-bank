// Empty optional values stay empty; explicitly entered text is never rewritten.
export const UNAVAILABLE = "";

export function getWebsiteCreationYear(
  launchDate?: string | null,
  createdAt?: string | Date | null,
  currentYear = new Date().getFullYear(),
): number {
  for (const value of [launchDate, createdAt]) {
    if (!value) continue;
    const text = value instanceof Date ? value.toISOString() : String(value).trim();
    const year = Number(text.match(/(?:^|[^\d])(\d{4})(?:[^\d]|$)/)?.[1]);
    if (Number.isInteger(year) && year >= 1000 && year <= currentYear) return year;
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() <= currentYear) {
      return parsed.getFullYear();
    }
  }
  return currentYear;
}

export function formatWebsiteCopyright(
  siteName: string | null | undefined,
  launchDate?: string | null,
  createdAt?: string | Date | null,
  currentYear = new Date().getFullYear(),
): string {
  const startYear = getWebsiteCreationYear(launchDate, createdAt, currentYear);
  const years = startYear < currentYear ? `${startYear}–${currentYear}` : String(currentYear);
  const name = siteName?.trim();
  return `${years} © All Rights Reserved${name ? ` | ${name}` : ""}`;
}
