import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBotPresenceOptions,
  isSupportedStreamingUrl,
  isValidBotPresenceActivity,
} from "./presence.js";

const activityTypes = {
  custom: 4,
  playing: 0,
  streaming: 1,
  listening: 2,
  watching: 3,
  competing: 5,
};

test("accepts the four existing activity types and the new streaming type", () => {
  for (const activityType of ["playing", "watching", "listening", "competing"]) {
    assert.equal(isValidBotPresenceActivity({ activityType, activityText: "活動文字" }, activityTypes), true);
  }
  assert.equal(isValidBotPresenceActivity({
    activityType: "streaming",
    activityText: "正在直播",
    activityUrl: "https://www.twitch.tv/fumo",
  }, activityTypes), true);
  assert.equal(isValidBotPresenceActivity({ activityType: "playing", activityText: "" }, activityTypes), true);
});

test("accepts HTTPS Twitch and YouTube channel, live, and video URLs only", () => {
  for (const url of [
    "https://www.twitch.tv/fumo",
    "https://youtube.com/live/abc",
    "https://youtu.be/abc123",
  ]) assert.equal(isSupportedStreamingUrl(url), true, url);

  for (const url of [
    "http://www.twitch.tv/fumo",
    "https://twitch.tv.attacker.example/fumo",
    "https://example.com/watch?v=123",
    "https://www.youtube.com/",
    "https://user:pass@www.youtube.com/watch?v=123",
    "https://www.twitch.tv:8443/fumo",
  ]) assert.equal(isSupportedStreamingUrl(url), false, url);
});

test("rejects missing streaming URLs and URLs attached to non-streaming activities", () => {
  assert.equal(isValidBotPresenceActivity({ activityType: "streaming", activityText: "直播" }, activityTypes), false);
  assert.equal(isValidBotPresenceActivity({
    activityType: "playing",
    activityText: "遊戲",
    activityUrl: "https://www.twitch.tv/fumo",
  }, activityTypes), false);
  assert.equal(isValidBotPresenceActivity({ activityType: "invalid", activityText: "文字" }, activityTypes), false);
  assert.equal(isValidBotPresenceActivity({ activityType: "playing", activityText: "文字\n插入" }, activityTypes), false);
});

test("maps every existing activity type and includes the URL for Streaming", () => {
  for (const [activityType, expectedType] of [["playing", 0], ["watching", 3], ["listening", 2], ["competing", 5]]) {
    assert.deepEqual(buildBotPresenceOptions({ activityType }, activityTypes), { type: expectedType });
  }
  assert.deepEqual(buildBotPresenceOptions({
    activityType: "streaming",
    activityUrl: " https://www.youtube.com/watch?v=abc ",
  }, activityTypes), { type: 1, url: "https://www.youtube.com/watch?v=abc" });
});
