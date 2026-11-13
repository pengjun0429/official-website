import { z } from "zod";

export const BOT_PRESENCE_ACTIVITY_TYPES = ["custom", "playing", "watching", "listening", "competing"] as const;
export type BotPresenceActivityType = typeof BOT_PRESENCE_ACTIVITY_TYPES[number];

export const DEFAULT_BOT_PRESENCE = {
  activityType: "custom" as BotPresenceActivityType,
  activityText: "",
};

export const botPresenceSchema = z.object({
  activityType: z.enum(BOT_PRESENCE_ACTIVITY_TYPES),
  activityText: z.string().trim().max(128, "活動文字最多 128 字元。")
    .refine(value => !/[\r\n\u0000]/.test(value), "活動文字必須是單行文字。"),
}).strict();

export type BotPresenceSettings = z.infer<typeof botPresenceSchema>;
