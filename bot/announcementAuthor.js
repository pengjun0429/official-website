export const DEFAULT_ANNOUNCEMENT_AUTHOR = "FUMO 官方網站 Bot";

export function normalizeAnnouncementAuthor(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
}

export function resolveAnnouncementAuthor({
  configuredAuthor,
  providedAuthor,
  defaultAuthor = DEFAULT_ANNOUNCEMENT_AUTHOR,
} = {}) {
  return normalizeAnnouncementAuthor(configuredAuthor)
    || normalizeAnnouncementAuthor(providedAuthor)
    || normalizeAnnouncementAuthor(defaultAuthor)
    || DEFAULT_ANNOUNCEMENT_AUTHOR;
}
