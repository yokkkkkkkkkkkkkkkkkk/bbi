const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');
const { buildWelcomeText } = require('../commands/welcome');
const protection = require('../utils/protection');

module.exports = {
  name: 'guildMemberAdd',
  async execute(member) {
    const guild = member.guild;
    const settings = db.getGuildSettings(guild.id);

    db.logMemberJoin(guild.id, member.id);

    // ===== ANTI-RAID =====
    if (settings.raidProtectionEnabled) {
      const isRaid = protection.checkRaid(guild.id, config);
      if (isRaid && !settings.raidLockdownUntil) {
        const until = Date.now() + config.raid.lockdownMinutes * 60 * 1000;
        db.updateGuildSettings(guild.id, { raidLockdownUntil: until });

        const alertEmbed = new EmbedBuilder()
          .setColor(config.errorColor)
          .setTitle('🚨 Kemungkinan Raid Terdeteksi!')
          .setDescription(`Banyak member baru join dalam waktu singkat. Lockdown otomatis diaktifkan selama **${config.raid.lockdownMinutes} menit** (akun baru < ${config.raid.newAccountDays} hari akan otomatis di-kick).`);

        const logChannel = settings.modLogChannelId ? guild.channels.cache.get(settings.modLogChannelId) : guild.systemChannel;
        logChannel?.send({ embeds: [alertEmbed] }).catch(() => {});
      }
    }

    // Cek apakah lockdown sedang aktif -> kick akun yang terlalu baru
    const currentSettings = db.getGuildSettings(guild.id);
    if (currentSettings.raidLockdownUntil > Date.now()) {
      const accountAgeDays = (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24);
      if (accountAgeDays < config.raid.newAccountDays) {
        await member.kick('Auto: lockdown mode aktif, akun terlalu baru').catch(() => {});
        return; // jangan proses welcome/autorole untuk yang di-kick
      }
    }

    // ===== WELCOME MESSAGE =====
    if (settings.welcomeChannelId) {
      const channel = guild.channels.cache.get(settings.welcomeChannelId);
      if (channel) {
        const text = buildWelcomeText(settings.welcomeMessage, member, guild);
        const embed = new EmbedBuilder()
          .setColor(config.successColor)
          .setDescription(text)
          .setThumbnail(member.user.displayAvatarURL());
        channel.send({ embeds: [embed] }).catch(() => {});
      }
    }

    // ===== AUTO-ROLE =====
    if (settings.autoRoleId) {
      const role = guild.roles.cache.get(settings.autoRoleId);
      if (role) {
        member.roles.add(role).catch(err => console.error('Gagal memberi auto-role:', err.message));
      }
    }
  },
};
