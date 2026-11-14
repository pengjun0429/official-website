import { once } from "node:events";
import assert from "node:assert/strict";
import test from "node:test";
import { shouldIgnoreWebhookEvent, startWebhookRelay } from "./webhookRelay.js";

test("the webhook relay ignores vote.started because the Bot outbox owns that notice", () => {
  assert.equal(shouldIgnoreWebhookEvent("vote.started"), true);
});

test("the webhook relay keeps unrelated website and vote lifecycle events", () => {
  assert.equal(shouldIgnoreWebhookEvent("vote.created"), false);
  assert.equal(shouldIgnoreWebhookEvent("vote.published"), false);
  assert.equal(shouldIgnoreWebhookEvent("vote.closing_soon"), false);
  assert.equal(shouldIgnoreWebhookEvent("vote.closed"), false);
  assert.equal(shouldIgnoreWebhookEvent("ballot.cast"), false);
  assert.equal(shouldIgnoreWebhookEvent("member.updated"), false);
});

async function startTestRelay(t, options = {}) {
  let sentPayload;
  const channel = {
    id: "channel-1",
    isTextBased: () => true,
    isSendable: () => true,
    send: async payload => {
      sentPayload = payload;
      return { id: "message-1", url: "https://discord.com/channels/guild-1/channel-1/message-1" };
    },
  };
  const roleList = [
    { id: "guild-1", name: "@everyone", position: 0, mentionable: true, managed: false },
    { id: "123456789012345678", name: "Council", position: 2, mentionable: true, managed: false },
    { id: "234567890123456789", name: "Members", position: 1, mentionable: false, managed: false },
    { id: "345678901234567890", name: "Managed role", position: 3, mentionable: false, managed: true },
  ];
  const guild = {
    id: "guild-1",
    channels: { cache: { values: () => [channel] } },
    roles: { cache: { values: () => roleList } },
  };
  const server = startWebhookRelay({
    client: {
      channels: { fetch: async () => channel },
      guilds: { cache: { get: id => id === guild.id ? guild : null } },
      isReady: () => true,
    },
    guildId: guild.id,
    channelId: channel.id,
    websiteUrl: "https://www.micronationfumo.org",
    secret: "",
    path: "/fumo/webhook",
    port: 0,
    mentionRoleId: "456789012345678901",
    mentionEvents: ["vote.published"],
    defaultAuthor: "FUMO Bot",
    ...options,
  });
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    sentPayload: () => sentPayload,
    getRoles: () => fetch(`${baseUrl}/roles`),
    sendAnnouncement: payload => fetch(`${baseUrl}/announce`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channelId: channel.id, mode: "embed", title: "Website announcement", content: "Announcement body", ...payload }),
    }),
    sendVoteEvent: () => fetch(`${baseUrl}/fumo/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fumo-event": "vote.published" },
      body: JSON.stringify({ event: "vote.published", vote: { name: "Test vote", startsAt: "2026-03-29T01:30:00.000Z", deadline: "2026-03-30T01:30:00.000Z" } }),
    }),
  };
}

test("the website role picker endpoint returns selectable roles, excluding everyone and managed roles", async t => {
  const relay = await startTestRelay(t);
  const response = await relay.getRoles();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).roles.map(({ id, name }) => ({ id, name })), [
    { id: "123456789012345678", name: "Council" },
    { id: "234567890123456789", name: "Members" },
  ]);
});

test("a website announcement mentions only its selected roles and allowlists those roles", async t => {
  const relay = await startTestRelay(t);
  const response = await relay.sendAnnouncement({ roleIds: ["123456789012345678", "234567890123456789"] });
  assert.equal(response.status, 200);
  assert.equal(relay.sentPayload().content, "<@&123456789012345678> <@&234567890123456789>");
  assert.equal(relay.sentPayload().embeds[0].author.name, "FUMO Bot");
  assert.deepEqual(relay.sentPayload().allowedMentions, { roles: ["123456789012345678", "234567890123456789"] });
});

test("website form publisher overrides the legacy global name while vote event attribution stays separate", async t => {
  const relay = await startTestRelay(t, { announcementAuthor: "FUMO Global Publisher" });
  const response = await relay.sendAnnouncement({ author: "Website admin name" });
  assert.equal(response.status, 200);
  assert.equal(relay.sentPayload().embeds[0].author.name, "Website admin name");

  const voteResponse = await relay.sendVoteEvent();
  assert.equal(voteResponse.status, 204);
  assert.equal(relay.sentPayload().embeds[0].author.name, "FUMO Global Publisher");
});

test("website announcement falls back to the default instead of a legacy global publisher when the form name is empty", async t => {
  const relay = await startTestRelay(t, { announcementAuthor: "FUMO Global Publisher" });
  const response = await relay.sendAnnouncement({ author: "" });
  assert.equal(response.status, 200);
  assert.equal(relay.sentPayload().embeds[0].author.name, "FUMO Bot");
});

test("an explicit website announcement author remains the fallback when no global override is set", async t => {
  const relay = await startTestRelay(t);
  const response = await relay.sendAnnouncement({ author: "One-time publisher" });
  assert.equal(response.status, 200);
  assert.equal(relay.sentPayload().embeds[0].author.name, "One-time publisher");
});

test("the website announcement relay remains compatible with a legacy single roleId payload", async t => {
  const relay = await startTestRelay(t);
  const response = await relay.sendAnnouncement({ roleId: "123456789012345678" });
  assert.equal(response.status, 200);
  assert.equal(relay.sentPayload().content, "<@&123456789012345678>");
  assert.deepEqual(relay.sentPayload().allowedMentions, { roles: ["123456789012345678"] });
});

test("website plain-text announcements allow only their selected roles", async t => {
  const relay = await startTestRelay(t);
  const response = await relay.sendAnnouncement({ mode: "text", title: "重要公告", author: "FUMO 行政部", roleIds: ["123456789012345678"] });
  assert.equal(response.status, 200);
  assert.equal(relay.sentPayload().content, "<@&123456789012345678>\n\n# 📢 重要公告\n\n發布者：FUMO 行政部\n\nAnnouncement body");
  assert.deepEqual(relay.sentPayload().allowedMentions, { roles: ["123456789012345678"] });
});

test("website plain-text announcements fall back to the Bot publisher without changing body content", async t => {
  const relay = await startTestRelay(t);
  const response = await relay.sendAnnouncement({ mode: "text", title: "", author: "", content: "Keep this body exactly." });
  assert.equal(response.status, 200);
  assert.equal(relay.sentPayload().content, "發布者：FUMO Bot\n\nKeep this body exactly.");
});

test("vote webhook times show Taipei UTC+8 and Paris local time", async t => {
  const relay = await startTestRelay(t);
  const response = await relay.sendVoteEvent();
  assert.equal(response.status, 204);
  const fields = relay.sentPayload().embeds[0].fields;
  assert.match(fields.find(field => field.name === "開始時間").value, /台北時間（UTC\+8）：2026\/03\/29 09:30\n巴黎時間：2026\/03\/29 03:30/);
  assert.match(fields.find(field => field.name === "截止時間").value, /台北時間（UTC\+8）：2026\/03\/30 09:30\n巴黎時間：2026\/03\/30 03:30/);
});

test("the pre-existing automated vote-event role mention remains unchanged", async t => {
  const relay = await startTestRelay(t);
  const response = await relay.sendVoteEvent();
  assert.equal(response.status, 204);
  assert.equal(relay.sentPayload().content, "<@&456789012345678901>");
  assert.deepEqual(relay.sentPayload().allowedMentions, { roles: ["456789012345678901"] });
});
