const STREAMING_HOSTS = new Set([
  "twitch.tv", "www.twitch.tv", "m.twitch.tv",
  "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be",
]);

export function isSupportedStreamingUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && !url.port
      && STREAMING_HOSTS.has(url.hostname.toLowerCase())
      && url.pathname.split("/").filter(Boolean).length > 0;
  } catch {
    return false;
  }
}

export function isValidBotPresenceActivity(activity, activityTypes) {
  if (!activity || typeof activity !== "object"
    || !Object.prototype.hasOwnProperty.call(activityTypes, activity.activityType)
    || typeof activity.activityText !== "string") return false;

  const text = activity.activityText.trim();
  if (text.length > 128 || /[\r\n\u0000]/.test(text)) return false;
  const url = activity.activityUrl === undefined ? "" : activity.activityUrl;
  if (typeof url !== "string") return false;
  if (activity.activityType === "streaming") return isSupportedStreamingUrl(url);
  return !url.trim();
}

export function buildBotPresenceOptions(activity, activityTypes) {
  const options = { type: activityTypes[activity.activityType] };
  if (activity.activityType === "streaming") options.url = activity.activityUrl.trim();
  return options;
}
