const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');
const protection = require('../utils/protection');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    const userId = message.author.id;
    const guildId = message.guild.id;
    const settings = db.getGuildSettings(guildId);

    // ===== AFK =====
    const selfAfk = db.getAfk(userId, guildId);
    if (selfAfk) {
      db.removeAfk(userId, guildId);
      message.reply(`👋 Selamat datang kembali ${message.author}, status AFK kamu sudah dihapus.`)
        .then(msg => setTimeout(() => msg.delete().catch(() => {}), 5000))
        .catch(() => {});
    }

    if (message.mentions.users.size > 0) {
      for (const [, mentioned] of message.mentions.users) {
        if (mentioned.id === userId) continue;
        const afk = db.getAfk(mentioned.id, guildId);
        if (afk) {
          message.reply(`💤 ${mentioned.tag} sedang AFK: **${afk.reason}**`).catch(() => {});
        }
      }
    }

    // ===== FILTER KATA KASAR =====
    if (settings.badwordFilterEnabled) {
      const badwords = db.getBadwords(guildId);
      if (badwords.length > 0) {
        const lower = message.content.toLowerCase();
        const found = badwords.find(w => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(lower));
        if (found) {
          await message.delete().catch(() => {});
          const warning = await message.channel.send(`⚠️ ${message.author}, pesanmu mengandung kata yang tidak diperbolehkan dan telah dihapus.`);
          setTimeout(() => warning.delete().catch(() => {}), 5000);
          return; // jangan proses XP untuk pesan yang dihapus
        }
      }
    }

    // ===== ANTI-SPAM =====
    if (settings.antispamEnabled && !message.member.permissions.has('ManageMessages')) {
      const result = protection.checkSpam(guildId, userId, message.content, config);
      if (result.spam) {
        await message.delete().catch(() => {});

        const member = message.member;
        if (member.moderatable) {
          await member.timeout(config.antispam.muteMinutes * 60 * 1000, `Auto: spam terdeteksi (${result.type})`).catch(() => {});
          protection.resetUser(guildId, userId);

          const embed = new EmbedBuilder()
            .setColor(config.errorColor)
            .setDescription(`🚫 ${message.author} di-mute otomatis selama ${config.antispam.muteMinutes} menit karena terdeteksi spam (${result.type === 'flood' ? 'kirim pesan terlalu cepat' : 'pesan berulang'}).`);
          message.channel.send({ embeds: [embed] }).catch(() => {});

          if (settings.modLogChannelId) {
            const logChannel = message.guild.channels.cache.get(settings.modLogChannelId);
            logChannel?.send({ embeds: [embed] }).catch(() => {});
          }
        }
        return;
      }

      // cek mass mention dalam satu pesan
      if (message.mentions.users.size + message.mentions.roles.size > config.antispam.maxMentions) {
        await message.delete().catch(() => {});
        const member = message.member;
        if (member.moderatable) {
          await member.timeout(config.antispam.muteMinutes * 60 * 1000, 'Auto: mass mention terdeteksi').catch(() => {});
          message.channel.send(`🚫 ${message.author} di-mute otomatis karena mass-mention (mention berlebihan dalam satu pesan).`).catch(() => {});
        }
        return;
      }
    }

    // ===== LEVELING / XP =====
    const levelData = db.getLevel(userId, guildId);
    const cooldownMs = config.leveling.xpCooldownSeconds * 1000;
    if (Date.now() - levelData.lastMessage < cooldownMs) return;

    const { min, max } = config.leveling.xpPerMessage;
    const xpGain = Math.floor(Math.random() * (max - min + 1)) + min;

    db.addXp(userId, guildId, xpGain);
    db.setLastMessage(userId, guildId, Date.now());

    const updated = db.getLevel(userId, guildId);
    const xpNeeded = db.xpNeededForLevel(updated.level);

    if (updated.xp >= xpNeeded) {
      db.setLevel(userId, guildId, updated.level + 1);
      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setDescription(`🎉 Selamat ${message.author}, kamu naik ke **Level ${updated.level + 1}**!`);
      message.channel.send({ embeds: [embed] }).catch(() => {});
    }
  },
};
