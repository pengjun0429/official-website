import assert from "node:assert/strict";
import test from "node:test";
import {
  ACTIVITY_BOARD,
  DEFAULT_ACTIVITY_CONTENT,
  INITIAL_ROTATIONS,
  SOLVED_ROTATIONS,
  activityContentSchema,
  getConnectedPipeIndexes,
  isActivityInstanceId,
} from "../src/activityContent.ts";

test("default activity content satisfies the editable-content contract", () => {
  assert.equal(activityContentSchema.safeParse(DEFAULT_ACTIVITY_CONTENT).success, true);
});

test("content validation trims text and rejects blank, oversized, or unsafe time limits", () => {
  const parsed = activityContentSchema.parse({ ...DEFAULT_ACTIVITY_CONTENT, title: "  電路合作  " });
  assert.equal(parsed.title, "電路合作");
  assert.equal(activityContentSchema.safeParse({ ...DEFAULT_ACTIVITY_CONTENT, title: "  " }).success, false);
  assert.equal(activityContentSchema.safeParse({ ...DEFAULT_ACTIVITY_CONTENT, timeLimitSeconds: 10 }).success, false);
  assert.equal(activityContentSchema.safeParse({ ...DEFAULT_ACTIVITY_CONTENT, instructions: "x".repeat(901) }).success, false);
});

test("default collaborative board has a valid solution but starts unsolved", () => {
  assert.equal(ACTIVITY_BOARD.length, 16);
  assert.ok(getConnectedPipeIndexes(SOLVED_ROTATIONS).includes(15));
  assert.ok(!getConnectedPipeIndexes(INITIAL_ROTATIONS).includes(15));
});

test("activity instance identifiers reject blank and path-like values", () => {
  assert.equal(isActivityInstanceId("discord-instance_123"), true);
  assert.equal(isActivityInstanceId("../private"), false);
  assert.equal(isActivityInstanceId(""), false);
  assert.equal(isActivityInstanceId("a".repeat(129)), false);
});
