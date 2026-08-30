// Menyimpan history pesan & join secara in-memory (per proses bot berjalan)

const messageHistory = new Map(); // key: `${guildId}-${userId}` -> [{ ts, content }]
const joinHistory = new Map();    // key: guildId -> [timestamp]

function trackMessage(guildId, userId, content) {
  const key = `${guildId}-${userId}`;
  const list = messageHistory.get(key) || [];
  list.push({ ts: Date.now(), content });
  // buang yang lebih tua dari 30 detik biar memory ga bengkak
  const cutoff = Date.now() - 30_000;
  const trimmed = list.filter(m => m.ts >= cutoff);
  messageHistory.set(key, trimmed);
  return trimmed;
}

function checkSpam(guildId, userId, content, config) {
  const history = trackMessage(guildId, userId, content);
  const { maxMessages, intervalSeconds, maxDuplicates } = config.antispam;
  const cutoff = Date.now() - intervalSeconds * 1000;
  const recent = history.filter(m => m.ts >= cutoff);

  if (recent.length > maxMessages) {
    return { spam: true, type: 'flood', count: recent.length };
  }

  const duplicates = recent.filter(m => m.content === content);
  if (duplicates.length >= maxDuplicates) {
    return { spam: true, type: 'duplicate', count: duplicates.length };
  }

  return { spam: false };
}

function resetUser(guildId, userId) {
  messageHistory.delete(`${guildId}-${userId}`);
}

function trackJoin(guildId) {
  const list = joinHistory.get(guildId) || [];
  list.push(Date.now());
  const cutoff = Date.now() - 60_000;
  const trimmed = list.filter(t => t >= cutoff);
  joinHistory.set(guildId, trimmed);
  return trimmed;
}

function checkRaid(guildId, config) {
  const list = trackJoin(guildId);
  const { joinThreshold, intervalSeconds } = config.raid;
  const cutoff = Date.now() - intervalSeconds * 1000;
  const recent = list.filter(t => t >= cutoff);
  return recent.length >= joinThreshold;
}

module.exports = { checkSpam, resetUser, checkRaid };
