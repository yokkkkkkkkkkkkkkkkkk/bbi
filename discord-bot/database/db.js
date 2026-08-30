const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'bot.sqlite'));
db.pragma('journal_mode = WAL');

// ================= TABLES =================

db.exec(`
CREATE TABLE IF NOT EXISTS economy (
  userId TEXT NOT NULL,
  guildId TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  bank INTEGER NOT NULL DEFAULT 0,
  lastDaily INTEGER DEFAULT 0,
  lastWork INTEGER DEFAULT 0,
  PRIMARY KEY (userId, guildId)
);

CREATE TABLE IF NOT EXISTS levels (
  userId TEXT NOT NULL,
  guildId TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 0,
  lastMessage INTEGER DEFAULT 0,
  PRIMARY KEY (userId, guildId)
);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  guildId TEXT NOT NULL,
  moderatorId TEXT NOT NULL,
  reason TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS guild_settings (
  guildId TEXT PRIMARY KEY,
  welcomeChannelId TEXT,
  welcomeMessage TEXT,
  leaveChannelId TEXT,
  autoRoleId TEXT,
  ticketCategoryId TEXT,
  ticketLogChannelId TEXT,
  modLogChannelId TEXT,
  antispamEnabled INTEGER DEFAULT 1,
  raidProtectionEnabled INTEGER DEFAULT 1,
  raidLockdownUntil INTEGER DEFAULT 0,
  badwordFilterEnabled INTEGER DEFAULT 0,
  suggestionChannelId TEXT,
  statsCategoryId TEXT,
  statsTotalChannelId TEXT,
  statsHumanChannelId TEXT,
  statsBotChannelId TEXT
);

CREATE TABLE IF NOT EXISTS tickets (
  channelId TEXT PRIMARY KEY,
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  createdAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reaction_roles (
  messageId TEXT PRIMARY KEY,
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  title TEXT,
  description TEXT
);

CREATE TABLE IF NOT EXISTS reaction_role_options (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  messageId TEXT NOT NULL,
  roleId TEXT NOT NULL,
  label TEXT NOT NULL,
  emoji TEXT
);

CREATE TABLE IF NOT EXISTS badwords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  word TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  messageId TEXT,
  userId TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId TEXT NOT NULL,
  channelId TEXT NOT NULL,
  messageId TEXT,
  question TEXT NOT NULL,
  options TEXT NOT NULL,
  endsAt INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS poll_votes (
  pollId INTEGER NOT NULL,
  userId TEXT NOT NULL,
  optionIndex INTEGER NOT NULL,
  PRIMARY KEY (pollId, userId)
);

CREATE TABLE IF NOT EXISTS member_joins (
  guildId TEXT NOT NULL,
  userId TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS afk (
  userId TEXT NOT NULL,
  guildId TEXT NOT NULL,
  reason TEXT,
  timestamp INTEGER NOT NULL,
  PRIMARY KEY (userId, guildId)
);
`);

// ================= ECONOMY =================

function getEconomy(userId, guildId) {
  let row = db.prepare('SELECT * FROM economy WHERE userId = ? AND guildId = ?').get(userId, guildId);
  if (!row) {
    db.prepare('INSERT INTO economy (userId, guildId, balance, bank) VALUES (?, ?, 0, 0)').run(userId, guildId);
    row = { userId, guildId, balance: 0, bank: 0, lastDaily: 0, lastWork: 0 };
  }
  return row;
}
function updateBalance(userId, guildId, amount) {
  getEconomy(userId, guildId);
  db.prepare('UPDATE economy SET balance = balance + ? WHERE userId = ? AND guildId = ?').run(amount, userId, guildId);
  return getEconomy(userId, guildId);
}
function updateBank(userId, guildId, amount) {
  getEconomy(userId, guildId);
  db.prepare('UPDATE economy SET bank = bank + ? WHERE userId = ? AND guildId = ?').run(amount, userId, guildId);
  return getEconomy(userId, guildId);
}
function setLastDaily(userId, guildId, ts) {
  getEconomy(userId, guildId);
  db.prepare('UPDATE economy SET lastDaily = ? WHERE userId = ? AND guildId = ?').run(ts, userId, guildId);
}
function setLastWork(userId, guildId, ts) {
  getEconomy(userId, guildId);
  db.prepare('UPDATE economy SET lastWork = ? WHERE userId = ? AND guildId = ?').run(ts, userId, guildId);
}
function getEconomyLeaderboard(guildId, limit = 10) {
  return db.prepare('SELECT * FROM economy WHERE guildId = ? ORDER BY (balance + bank) DESC LIMIT ?').all(guildId, limit);
}

// ================= LEVELING =================

function getLevel(userId, guildId) {
  let row = db.prepare('SELECT * FROM levels WHERE userId = ? AND guildId = ?').get(userId, guildId);
  if (!row) {
    db.prepare('INSERT INTO levels (userId, guildId, xp, level) VALUES (?, ?, 0, 0)').run(userId, guildId);
    row = { userId, guildId, xp: 0, level: 0, lastMessage: 0 };
  }
  return row;
}
function addXp(userId, guildId, amount) {
  getLevel(userId, guildId);
  db.prepare('UPDATE levels SET xp = xp + ? WHERE userId = ? AND guildId = ?').run(amount, userId, guildId);
  return getLevel(userId, guildId);
}
function setLevel(userId, guildId, level) {
  getLevel(userId, guildId);
  db.prepare('UPDATE levels SET level = ? WHERE userId = ? AND guildId = ?').run(level, userId, guildId);
}
function setLastMessage(userId, guildId, ts) {
  getLevel(userId, guildId);
  db.prepare('UPDATE levels SET lastMessage = ? WHERE userId = ? AND guildId = ?').run(ts, userId, guildId);
}
function getLevelLeaderboard(guildId, limit = 10) {
  return db.prepare('SELECT * FROM levels WHERE guildId = ? ORDER BY xp DESC LIMIT ?').all(guildId, limit);
}
function xpNeededForLevel(level) {
  return 5 * (level ** 2) + 50 * level + 100;
}

// ================= WARNINGS =================

function addWarning(userId, guildId, moderatorId, reason) {
  db.prepare('INSERT INTO warnings (userId, guildId, moderatorId, reason, timestamp) VALUES (?, ?, ?, ?, ?)')
    .run(userId, guildId, moderatorId, reason, Date.now());
}
function getWarnings(userId, guildId) {
  return db.prepare('SELECT * FROM warnings WHERE userId = ? AND guildId = ? ORDER BY timestamp DESC').all(userId, guildId);
}
function clearWarnings(userId, guildId) {
  db.prepare('DELETE FROM warnings WHERE userId = ? AND guildId = ?').run(userId, guildId);
}

// ================= GUILD SETTINGS =================

function getGuildSettings(guildId) {
  let row = db.prepare('SELECT * FROM guild_settings WHERE guildId = ?').get(guildId);
  if (!row) {
    db.prepare('INSERT INTO guild_settings (guildId) VALUES (?)').run(guildId);
    row = db.prepare('SELECT * FROM guild_settings WHERE guildId = ?').get(guildId);
  }
  return row;
}
function updateGuildSettings(guildId, fields) {
  getGuildSettings(guildId);
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => fields[k]);
  db.prepare(`UPDATE guild_settings SET ${setClause} WHERE guildId = ?`).run(...values, guildId);
  return getGuildSettings(guildId);
}

// ================= TICKETS =================

function createTicket(channelId, guildId, userId) {
  db.prepare('INSERT INTO tickets (channelId, guildId, userId, status, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(channelId, guildId, userId, 'open', Date.now());
}
function closeTicket(channelId) {
  db.prepare("UPDATE tickets SET status = 'closed' WHERE channelId = ?").run(channelId);
}
function getTicket(channelId) {
  return db.prepare('SELECT * FROM tickets WHERE channelId = ?').get(channelId);
}
function getOpenTicketByUser(guildId, userId) {
  return db.prepare("SELECT * FROM tickets WHERE guildId = ? AND userId = ? AND status = 'open'").get(guildId, userId);
}

// ================= REACTION ROLES / ROLE MENU =================

function createRoleMenu(messageId, guildId, channelId, title, description) {
  db.prepare('INSERT INTO reaction_roles (messageId, guildId, channelId, title, description) VALUES (?, ?, ?, ?, ?)')
    .run(messageId, guildId, channelId, title, description);
}
function getRoleMenu(messageId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE messageId = ?').get(messageId);
}
function getRoleMenusByGuild(guildId) {
  return db.prepare('SELECT * FROM reaction_roles WHERE guildId = ?').all(guildId);
}
function deleteRoleMenu(messageId) {
  db.prepare('DELETE FROM reaction_roles WHERE messageId = ?').run(messageId);
  db.prepare('DELETE FROM reaction_role_options WHERE messageId = ?').run(messageId);
}
function addRoleMenuOption(messageId, roleId, label, emoji) {
  db.prepare('INSERT INTO reaction_role_options (messageId, roleId, label, emoji) VALUES (?, ?, ?, ?)')
    .run(messageId, roleId, label, emoji);
}
function removeRoleMenuOption(messageId, roleId) {
  db.prepare('DELETE FROM reaction_role_options WHERE messageId = ? AND roleId = ?').run(messageId, roleId);
}
function getRoleMenuOptions(messageId) {
  return db.prepare('SELECT * FROM reaction_role_options WHERE messageId = ?').all(messageId);
}

// ================= BADWORDS =================

function addBadword(guildId, word) {
  const exists = db.prepare('SELECT 1 FROM badwords WHERE guildId = ? AND word = ?').get(guildId, word.toLowerCase());
  if (exists) return false;
  db.prepare('INSERT INTO badwords (guildId, word) VALUES (?, ?)').run(guildId, word.toLowerCase());
  return true;
}
function removeBadword(guildId, word) {
  db.prepare('DELETE FROM badwords WHERE guildId = ? AND word = ?').run(guildId, word.toLowerCase());
}
function getBadwords(guildId) {
  return db.prepare('SELECT word FROM badwords WHERE guildId = ?').all(guildId).map(r => r.word);
}

// ================= SUGGESTIONS =================

function createSuggestion(guildId, channelId, userId, content) {
  const info = db.prepare('INSERT INTO suggestions (guildId, channelId, userId, content, status, timestamp) VALUES (?, ?, ?, ?, ?, ?)')
    .run(guildId, channelId, userId, content, 'pending', Date.now());
  return info.lastInsertRowid;
}
function setSuggestionMessage(id, messageId) {
  db.prepare('UPDATE suggestions SET messageId = ? WHERE id = ?').run(messageId, id);
}
function getSuggestion(id) {
  return db.prepare('SELECT * FROM suggestions WHERE id = ?').get(id);
}
function updateSuggestionStatus(id, status, reason) {
  db.prepare('UPDATE suggestions SET status = ?, reason = ? WHERE id = ?').run(status, reason || null, id);
}

// ================= POLLS =================

function createPoll(guildId, channelId, question, options, endsAt) {
  const info = db.prepare('INSERT INTO polls (guildId, channelId, question, options, endsAt, status) VALUES (?, ?, ?, ?, ?, ?)')
    .run(guildId, channelId, question, JSON.stringify(options), endsAt, 'active');
  return info.lastInsertRowid;
}
function setPollMessage(id, messageId) {
  db.prepare('UPDATE polls SET messageId = ? WHERE id = ?').run(messageId, id);
}
function getPoll(id) {
  const row = db.prepare('SELECT * FROM polls WHERE id = ?').get(id);
  if (row) row.options = JSON.parse(row.options);
  return row;
}
function getActiveExpiredPolls() {
  const rows = db.prepare("SELECT * FROM polls WHERE status = 'active' AND endsAt <= ?").all(Date.now());
  return rows.map(r => ({ ...r, options: JSON.parse(r.options) }));
}
function closePoll(id) {
  db.prepare("UPDATE polls SET status = 'closed' WHERE id = ?").run(id);
}
function castVote(pollId, userId, optionIndex) {
  db.prepare('INSERT INTO poll_votes (pollId, userId, optionIndex) VALUES (?, ?, ?) ON CONFLICT(pollId, userId) DO UPDATE SET optionIndex = excluded.optionIndex')
    .run(pollId, userId, optionIndex);
}
function getPollVotes(pollId) {
  return db.prepare('SELECT * FROM poll_votes WHERE pollId = ?').all(pollId);
}
function getPollResults(pollId, optionCount) {
  const votes = getPollVotes(pollId);
  const counts = new Array(optionCount).fill(0);
  for (const v of votes) counts[v.optionIndex]++;
  return counts;
}

// ================= MEMBER JOINS (growth stats & raid log) =================

function logMemberJoin(guildId, userId) {
  db.prepare('INSERT INTO member_joins (guildId, userId, timestamp) VALUES (?, ?, ?)').run(guildId, userId, Date.now());
}
function countJoinsSince(guildId, sinceTs) {
  return db.prepare('SELECT COUNT(*) AS c FROM member_joins WHERE guildId = ? AND timestamp >= ?').get(guildId, sinceTs).c;
}

// ================= AFK =================

function setAfk(userId, guildId, reason) {
  db.prepare(`
    INSERT INTO afk (userId, guildId, reason, timestamp) VALUES (?, ?, ?, ?)
    ON CONFLICT(userId, guildId) DO UPDATE SET reason = excluded.reason, timestamp = excluded.timestamp
  `).run(userId, guildId, reason || 'AFK', Date.now());
}
function getAfk(userId, guildId) {
  return db.prepare('SELECT * FROM afk WHERE userId = ? AND guildId = ?').get(userId, guildId);
}
function removeAfk(userId, guildId) {
  db.prepare('DELETE FROM afk WHERE userId = ? AND guildId = ?').run(userId, guildId);
}

module.exports = {
  db,
  getEconomy, updateBalance, updateBank, setLastDaily, setLastWork, getEconomyLeaderboard,
  getLevel, addXp, setLevel, setLastMessage, getLevelLeaderboard, xpNeededForLevel,
  addWarning, getWarnings, clearWarnings,
  getGuildSettings, updateGuildSettings,
  createTicket, closeTicket, getTicket, getOpenTicketByUser,
  createRoleMenu, getRoleMenu, getRoleMenusByGuild, deleteRoleMenu,
  addRoleMenuOption, removeRoleMenuOption, getRoleMenuOptions,
  addBadword, removeBadword, getBadwords,
  createSuggestion, setSuggestionMessage, getSuggestion, updateSuggestionStatus,
  createPoll, setPollMessage, getPoll, getActiveExpiredPolls, closePoll,
  castVote, getPollVotes, getPollResults,
  logMemberJoin, countJoinsSince,
  setAfk, getAfk, removeAfk,
};
