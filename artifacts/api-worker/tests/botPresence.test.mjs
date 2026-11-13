import assert from "node:assert/strict";
import test from "node:test";
import { botPresenceSchema, DEFAULT_BOT_PRESENCE } from "../src/botPresence.ts";

test("supports activity types compatible with bot presences", () => {
  for (const activityType of ["custom", "playing", "watching", "listening", "competing"]) {
    assert.equal(botPresenceSchema.safeParse({ activityType, activityText: "正在舉行大會" }).success, true);
  }
  assert.deepEqual(DEFAULT_BOT_PRESENCE, { activityType: "custom", activityText: "" });
});

test("allows clearing the activity and enforces the 128-character text limit", () => {
  assert.equal(botPresenceSchema.safeParse({ activityType: "custom", activityText: "" }).success, true);
  assert.equal(botPresenceSchema.safeParse({ activityType: "custom", activityText: "x".repeat(128) }).success, true);
  assert.equal(botPresenceSchema.safeParse({ activityType: "custom", activityText: "x".repeat(129) }).success, false);
});

test("rejects streaming because it requires an external stream URL and rejects multiline text", () => {
  assert.equal(botPresenceSchema.safeParse({ activityType: "streaming", activityText: "正在直播" }).success, false);
  assert.equal(botPresenceSchema.safeParse({ activityType: "custom", activityText: "大會\n開始" }).success, false);
});
