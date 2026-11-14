import { z } from "zod";

export const BOT_PRESENCE_ACTIVITY_TYPES = ["playing", "watching", "listening", "competing", "streaming"] as const;
export type BotPresenceActivityType = typeof BOT_PRESENCE_ACTIVITY_TYPES[number];

const STREAMING_HOSTS = new Set([
  "twitch.tv", "www.twitch.tv", "m.twitch.tv",
  "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be",
]);

export function isSupportedStreamingUrl(value: string): boolean {
  try {
    const url = new URL(value);
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

function validateActivityUrl(activity: { activityType: string; activityUrl?: string }, ctx: z.RefinementCtx) {
  if (activity.activityType === "streaming") {
    if (!activity.activityUrl) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["activityUrl"], message: "Streaming 活動必須填寫 Twitch 或 YouTube 網址。" });
    } else if (!isSupportedStreamingUrl(activity.activityUrl)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["activityUrl"], message: "請輸入有效的 HTTPS Twitch 或 YouTube 頻道、直播或影片網址。" });
    }
  } else if (activity.activityUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["activityUrl"], message: "只有 Streaming 活動可以設定串流網址。" });
  }
}

export const botPresenceActivitySchema = z.object({
  activityType: z.enum(BOT_PRESENCE_ACTIVITY_TYPES),
  activityText: z.string().trim().min(1, "活動文字不可空白。")
    .max(128, "活動文字最多 128 字元。")
    .refine(value => !/[\r\n\u0000]/.test(value), "活動文字必須是單行文字。"),
  activityUrl: z.string().trim().max(2048, "串流網址最多 2048 字元。").optional(),
}).strict().superRefine(validateActivityUrl);

export const botPresenceConfigSchema = z.object({
  activities: z.array(botPresenceActivitySchema).max(10, "最多可設定 10 組 Bot 活動。"),
  rotationIntervalSeconds: z.number().int().min(30).max(600)
    .refine(value => value % 30 === 0, "輪播間隔必須是 30 秒的倍數。"),
}).strict();

const legacyBotPresenceSchema = z.object({
  activityType: z.enum(["custom", ...BOT_PRESENCE_ACTIVITY_TYPES]),
  activityText: z.string().trim().max(128, "活動文字最多 128 字元。")
    .refine(value => !/[\r\n\u0000]/.test(value), "活動文字必須是單行文字。"),
  activityUrl: z.string().trim().max(2048, "串流網址最多 2048 字元。").optional(),
}).strict().superRefine(validateActivityUrl);

export const botPresenceSchema = z.union([botPresenceConfigSchema, legacyBotPresenceSchema]).transform(value => {
  if ("activities" in value) return value;
  const activity = {
    activityType: value.activityType === "custom" ? "playing" as const : value.activityType,
    activityText: value.activityText,
    ...(value.activityUrl ? { activityUrl: value.activityUrl } : {}),
  };
  return {
    activities: value.activityText ? [activity] : [],
    rotationIntervalSeconds: 60,
  };
});

export type BotPresenceActivity = z.infer<typeof botPresenceActivitySchema>;
export type BotPresenceConfig = z.infer<typeof botPresenceConfigSchema>;

export const DEFAULT_BOT_PRESENCE: BotPresenceConfig = {
  activities: [],
  rotationIntervalSeconds: 60,
};

const STORAGE_PREFIX = "fumo-presence-v2:";

export function serializeBotPresence(config: BotPresenceConfig): string {
  return `${STORAGE_PREFIX}${JSON.stringify(config)}`;
}

export function parseStoredBotPresence(activityType: string | null, activityText: string | null): BotPresenceConfig {
  const storedText = activityText ?? "";
  if (storedText.startsWith(STORAGE_PREFIX)) {
    try {
      const parsed = botPresenceConfigSchema.safeParse(JSON.parse(storedText.slice(STORAGE_PREFIX.length)));
      return parsed.success ? parsed.data : DEFAULT_BOT_PRESENCE;
    } catch {
      return DEFAULT_BOT_PRESENCE;
    }
  }

  const validLegacyType = BOT_PRESENCE_ACTIVITY_TYPES.includes(activityType as BotPresenceActivityType)
    ? activityType as BotPresenceActivityType
    : "playing";
  if (!storedText.trim()) return DEFAULT_BOT_PRESENCE;

  const legacy = legacyBotPresenceSchema.safeParse({ activityType: validLegacyType, activityText: storedText });
  return legacy.success
    ? { activities: [{ activityType: legacy.data.activityType === "custom" ? "playing" : legacy.data.activityType, activityText: legacy.data.activityText }], rotationIntervalSeconds: 60 }
    : DEFAULT_BOT_PRESENCE;
}

export function selectBotPresenceActivity(config: BotPresenceConfig, updatedAt: string | null, nowMs = Date.now()): BotPresenceActivity {
  if (config.activities.length === 0) return { activityType: "playing", activityText: "" };
  if (config.activities.length === 1 || !updatedAt) return config.activities[0];

  const normalized = updatedAt.includes("T") ? updatedAt : `${updatedAt.replace(" ", "T")}Z`;
  const savedAtMs = Date.parse(normalized);
  if (!Number.isFinite(savedAtMs) || nowMs < savedAtMs) return config.activities[0];

  const elapsedIntervals = Math.floor((nowMs - savedAtMs) / (config.rotationIntervalSeconds * 1000));
  return config.activities[elapsedIntervals % config.activities.length];
}
