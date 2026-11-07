export const DEFAULT_VOTE_ANNOUNCEMENT_CHANNEL_ID = "1249237308096643186";
export const DEFAULT_VOTE_ANNOUNCEMENT_ROLE_ID = "1556182329238618154";

export function getVoteAnnouncementConfig(env = process.env) {
  return {
    channelId: env.VOTE_ANNOUNCEMENT_CHANNEL_ID || DEFAULT_VOTE_ANNOUNCEMENT_CHANNEL_ID,
    roleId: env.VOTE_ANNOUNCEMENT_ROLE_ID === undefined
      ? DEFAULT_VOTE_ANNOUNCEMENT_ROLE_ID
      : env.VOTE_ANNOUNCEMENT_ROLE_ID,
  };
}

export function buildVoteAnnouncementRoleOptions(roleId, operatorNameValue = "") {
  const normalizedRoleId = typeof roleId === "string" && /^\d{17,20}$/.test(roleId.trim())
    ? roleId.trim()
    : "";
  const operatorName = typeof operatorNameValue === "string"
    ? operatorNameValue.replace(/[\r\n\t]+/g, " ").replace(/@/g, "@\u200b").replace(/[\\`*_~|#]/g, "\\$&").trim().slice(0, 80)
    : "";
  const content = [
    normalizedRoleId ? `<@&${normalizedRoleId}>` : "",
    operatorName ? `-# 操作者：${operatorName}` : "",
  ].filter(Boolean).join("\n");
  return {
    content,
    allowedMentions: normalizedRoleId ? { roles: [normalizedRoleId] } : { parse: [] },
  };
}
