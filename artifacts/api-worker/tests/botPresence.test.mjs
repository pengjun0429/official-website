import assert from "node:assert/strict";
import test from "node:test";
import {
  botPresenceSchema,
  DEFAULT_BOT_PRESENCE,
  parseStoredBotPresence,
  selectBotPresenceActivity,
  serializeBotPresence,
} from "../src/botPresence.ts";

const sampleActivities = [
  { activityType: "playing", activityText: "正在舉行大會" },
  { activityType: "watching", activityText: "FUMO 官方網站" },
];

test("supports multiple Discord activities in the shared activity area", () => {
  for (const activityType of ["playing", "watching", "listening", "competing"]) {
    assert.equal(botPresenceSchema.safeParse({
      activities: [{ activityType, activityText: "活動文字" }],
      rotationIntervalSeconds: 60,
    }).success, true);
  }
  assert.equal(botPresenceSchema.safeParse({
    activities: [{ activityType: "streaming", activityText: "正在直播", activityUrl: "https://www.twitch.tv/fumo" }],
    rotationIntervalSeconds: 60,
  }).success, true);
  assert.deepEqual(DEFAULT_BOT_PRESENCE, { activities: [], rotationIntervalSeconds: 60 });
});

test("validates activity count, text length, one-line text, and rotation interval", () => {
  const makeConfig = (activities, rotationIntervalSeconds = 60) => ({ activities, rotationIntervalSeconds });
  assert.equal(botPresenceSchema.safeParse(makeConfig(sampleActivities, 30)).success, true);
  assert.equal(botPresenceSchema.safeParse(makeConfig(Array.from({ length: 10 }, (_, index) => ({ activityType: "playing", activityText: `活動 ${index + 1}` })))).success, true);
  assert.equal(botPresenceSchema.safeParse(makeConfig(Array.from({ length: 11 }, () => sampleActivities[0]))).success, false);
  assert.equal(botPresenceSchema.safeParse(makeConfig([{ activityType: "playing", activityText: "x".repeat(129) }])).success, false);
  assert.equal(botPresenceSchema.safeParse(makeConfig([{ activityType: "playing", activityText: "大會\n開始" }])).success, false);
  assert.equal(botPresenceSchema.safeParse(makeConfig([{ activityType: "playing", activityText: "   " }])).success, false);
  assert.equal(botPresenceSchema.safeParse(makeConfig([{ activityType: "streaming", activityText: "直播" }])).success, false);
  for (const activityUrl of ["http://www.twitch.tv/fumo", "https://twitch.tv.attacker.example/fumo", "https://example.com/watch?v=123", "https://www.youtube.com/", "https://user:pass@www.youtube.com/watch?v=123"]) {
    assert.equal(botPresenceSchema.safeParse(makeConfig([{ activityType: "streaming", activityText: "直播", activityUrl }])).success, false, activityUrl);
  }
  assert.equal(botPresenceSchema.safeParse(makeConfig([{ activityType: "playing", activityText: "遊戲", activityUrl: "https://www.twitch.tv/fumo" }])).success, false);
  for (const activityUrl of ["https://www.twitch.tv/fumo", "https://youtube.com/live/abc", "https://youtu.be/abc123"]) {
    assert.equal(botPresenceSchema.safeParse(makeConfig([{ activityType: "streaming", activityText: "直播", activityUrl }])).success, true, activityUrl);
  }
  assert.equal(botPresenceSchema.safeParse(makeConfig([], 45)).success, false);
  assert.equal(botPresenceSchema.safeParse(makeConfig([], 601)).success, false);
  assert.equal(botPresenceSchema.safeParse(makeConfig([], 30)).success, true);
  assert.equal(botPresenceSchema.safeParse(makeConfig([], 600)).success, true);
});

test("converts the prior single-activity format and legacy Custom Status into Playing", () => {
  assert.deepEqual(botPresenceSchema.parse({ activityType: "watching", activityText: "FUMO" }), {
    activities: [{ activityType: "watching", activityText: "FUMO" }],
    rotationIntervalSeconds: 60,
  });
  assert.deepEqual(botPresenceSchema.parse({ activityType: "custom", activityText: "舊自訂狀態" }), {
    activities: [{ activityType: "playing", activityText: "舊自訂狀態" }],
    rotationIntervalSeconds: 60,
  });
  assert.deepEqual(botPresenceSchema.parse({ activityType: "streaming", activityText: "直播", activityUrl: "https://www.youtube.com/watch?v=abc" }), {
    activities: [{ activityType: "streaming", activityText: "直播", activityUrl: "https://www.youtube.com/watch?v=abc" }],
    rotationIntervalSeconds: 60,
  });
  assert.deepEqual(botPresenceSchema.parse({ activityType: "playing", activityText: "" }), DEFAULT_BOT_PRESENCE);
  assert.equal(botPresenceSchema.safeParse({ activities: [{ activityType: "custom", activityText: "不要使用獨立狀態欄" }], rotationIntervalSeconds: 60 }).success, false);
});

test("reads prior D1 rows and safely serializes the new list in the existing text column", () => {
  assert.deepEqual(parseStoredBotPresence("watching", "舊活動文字"), {
    activities: [{ activityType: "watching", activityText: "舊活動文字" }],
    rotationIntervalSeconds: 60,
  });
  assert.deepEqual(parseStoredBotPresence("custom", "舊自訂狀態"), {
    activities: [{ activityType: "playing", activityText: "舊自訂狀態" }],
    rotationIntervalSeconds: 60,
  });
  const config = { activities: sampleActivities, rotationIntervalSeconds: 90 };
  assert.deepEqual(parseStoredBotPresence("playing", serializeBotPresence(config)), config);
  assert.deepEqual(parseStoredBotPresence("playing", ""), DEFAULT_BOT_PRESENCE);
});

test("rotates in list order using the saved time while keeping the legacy Bot response scalar", () => {
  const config = { activities: sampleActivities, rotationIntervalSeconds: 30 };
  const savedAt = "2026-01-01 00:00:00";
  const start = Date.parse("2026-01-01T00:00:00Z");
  assert.deepEqual(selectBotPresenceActivity(config, savedAt, start), sampleActivities[0]);
  assert.deepEqual(selectBotPresenceActivity(config, savedAt, start + 30_000), sampleActivities[1]);
  assert.deepEqual(selectBotPresenceActivity(config, savedAt, start + 60_000), sampleActivities[0]);
  assert.deepEqual(selectBotPresenceActivity(config, null, start + 60_000), sampleActivities[0]);
  assert.deepEqual(selectBotPresenceActivity(DEFAULT_BOT_PRESENCE, savedAt, start), { activityType: "playing", activityText: "" });
});
