import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ANNOUNCEMENT_AUTHOR,
  normalizeAnnouncementAuthor,
  resolveAnnouncementAuthor,
} from "./announcementAuthor.js";

test("the configured global publisher name overrides source-specific names", () => {
  assert.equal(resolveAnnouncementAuthor({
    configuredAuthor: " FUMO Council ",
    providedAuthor: "Website editor",
    defaultAuthor: "FUMO Bot",
  }), "FUMO Council");
});

test("an empty global setting preserves an explicit source name before falling back", () => {
  assert.equal(resolveAnnouncementAuthor({ configuredAuthor: "  ", providedAuthor: "Slash command operator" }), "Slash command operator");
  assert.equal(resolveAnnouncementAuthor({ configuredAuthor: "", defaultAuthor: "Configured fallback" }), "Configured fallback");
  assert.equal(resolveAnnouncementAuthor(), DEFAULT_ANNOUNCEMENT_AUTHOR);
});

test("publisher names collapse line breaks and whitespace and are capped at 80 characters", () => {
  assert.equal(normalizeAnnouncementAuthor("  Bot\n  operator\tname  "), "Bot operator name");
  assert.equal(normalizeAnnouncementAuthor("A".repeat(90)), "A".repeat(80));
  assert.equal(normalizeAnnouncementAuthor(" \n\t "), "");
});
