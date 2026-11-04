/**
 * Turns a deck title into a safe download file name: lower case, accents
 * stripped, words joined by single dashes.
 */
export function toFileNameSlug(value: unknown, fallback = "deck"): string {
  const slug = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}
