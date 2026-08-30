const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Perintah moderasi server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(sub =>
      sub.setName('kick')
        .setDescription('Kick member dari server')
        .addUserOption(o => o.setName('target').setDescription('Member yang di-kick').setRequired(true))
        .addStringOption(o => o.setName('alasan').setDescription('Alasan kick').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('ban')
        .setDescription('Ban member dari server')
        .addUserOption(o => o.setName('target').setDescription('Member yang di-ban').setRequired(true))
        .addStringOption(o => o.setName('alasan').setDescription('Alasan ban').setRequired(false))
        .addIntegerOption(o => o.setName('hapus_pesan_hari').setDescription('Hapus pesan berapa hari terakhir (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('unban')
        .setDescription('Unban user berdasarkan ID')
        .addStringOption(o => o.setName('user_id').setDescription('ID user yang di-unban').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('mute')
        .setDescription('Timeout (mute) member')
        .addUserOption(o => o.setName('target').setDescription('Member yang di-mute').setRequired(true))
        .addIntegerOption(o => o.setName('menit').setDescription('Durasi mute dalam menit').setRequired(true).setMinValue(1).setMaxValue(40320))
        .addStringOption(o => o.setName('alasan').setDescription('Alasan mute').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('unmute')
        .setDescription('Hapus timeout dari member')
        .addUserOption(o => o.setName('target').setDescription('Member yang di-unmute').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('warn')
        .setDescription('Beri warning ke member')
        .addUserOption(o => o.setName('target').setDescription('Member yang diberi warning').setRequired(true))
        .addStringOption(o => o.setName('alasan').setDescription('Alasan warning').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('warnings')
        .setDescription('Lihat daftar warning member')
        .addUserOption(o => o.setName('target').setDescription('Member yang dicek').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('clearwarnings')
        .setDescription('Hapus semua warning member')
        .addUserOption(o => o.setName('target').setDescription('Member yang di-clear warning-nya').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('softban')
        .setDescription('Ban lalu langsung unban member (hapus pesan tanpa ban permanen)')
        .addUserOption(o => o.setName('target').setDescription('Member yang di-softban').setRequired(true))
        .addStringOption(o => o.setName('alasan').setDescription('Alasan softban').setRequired(false))
        .addIntegerOption(o => o.setName('hapus_pesan_hari').setDescription('Hapus pesan berapa hari terakhir (0-7)').setMinValue(0).setMaxValue(7).setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('purge')
        .setDescription('Hapus sejumlah pesan terbaru di channel ini')
        .addIntegerOption(o => o.setName('jumlah').setDescription('Jumlah pesan (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(o => o.setName('target').setDescription('Hanya hapus pesan dari member ini').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('slowmode')
        .setDescription('Atur slowmode channel ini')
        .addIntegerOption(o => o.setName('detik').setDescription('Durasi slowmode dalam detik (0 = matikan)').setRequired(true).setMinValue(0).setMaxValue(21600)))
    .addSubcommandGroup(group =>
      group.setName('role')
        .setDescription('Beri atau cabut role dari member')
        .addSubcommand(sub =>
          sub.setName('add')
            .setDescription('Beri role ke member')
            .addUserOption(o => o.setName('target').setDescription('Member yang diberi role').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('Role yang diberikan').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('Cabut role dari member')
            .addUserOption(o => o.setName('target').setDescription('Member yang dicabut role-nya').setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('Role yang dicabut').setRequired(true)))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'kick') {
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';
      const member = await guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ Member tidak ditemukan di server ini.', ephemeral: true });
      if (!member.kickable) return interaction.reply({ content: '❌ Saya tidak punya izin untuk kick member ini (cek posisi role).', ephemeral: true });

      await member.kick(reason);
      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setDescription(`👢 **${target.tag}** berhasil di-kick.\n**Alasan:** ${reason}`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'ban') {
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';
      const deleteDays = interaction.options.getInteger('hapus_pesan_hari') || 0;
      const member = await guild.members.fetch(target.id).catch(() => null);

      if (member && !member.bannable) return interaction.reply({ content: '❌ Saya tidak punya izin untuk ban member ini.', ephemeral: true });

      await guild.members.ban(target.id, { deleteMessageSeconds: deleteDays * 86400, reason });
      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setDescription(`🔨 **${target.tag}** berhasil di-ban.\n**Alasan:** ${reason}`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'unban') {
      const userId = interaction.options.getString('user_id');
      try {
        await guild.members.unban(userId);
        return interaction.reply({ content: `✅ User dengan ID \`${userId}\` berhasil di-unban.` });
      } catch (err) {
        return interaction.reply({ content: '❌ Gagal unban. Pastikan ID benar dan user memang di-ban.', ephemeral: true });
      }
    }

    if (sub === 'mute') {
      const target = interaction.options.getUser('target');
      const minutes = interaction.options.getInteger('menit');
      const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';
      const member = await guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ Member tidak ditemukan di server ini.', ephemeral: true });
      if (!member.moderatable) return interaction.reply({ content: '❌ Saya tidak punya izin untuk mute member ini.', ephemeral: true });

      await member.timeout(minutes * 60 * 1000, reason);
      const embed = new EmbedBuilder()
        .setColor(config.warnColor)
        .setDescription(`🔇 **${target.tag}** di-mute selama **${minutes} menit**.\n**Alasan:** ${reason}`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'unmute') {
      const target = interaction.options.getUser('target');
      const member = await guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ Member tidak ditemukan di server ini.', ephemeral: true });

      await member.timeout(null);
      return interaction.reply({ content: `🔊 **${target.tag}** berhasil di-unmute.` });
    }

    if (sub === 'warn') {
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('alasan');

      db.addWarning(target.id, guild.id, interaction.user.id, reason);
      const total = db.getWarnings(target.id, guild.id).length;

      const embed = new EmbedBuilder()
        .setColor(config.warnColor)
        .setDescription(`⚠️ **${target.tag}** diberi warning.\n**Alasan:** ${reason}\n**Total warning:** ${total}`);
      await interaction.reply({ embeds: [embed] });

      // Auto-mute jika warning melebihi batas
      if (total >= config.moderation.maxWarningsBeforeAutoMute) {
        const member = await guild.members.fetch(target.id).catch(() => null);
        if (member && member.moderatable) {
          await member.timeout(config.moderation.autoMuteDurationMinutes * 60 * 1000, 'Auto-mute: terlalu banyak warning');
          await interaction.followUp({ content: `🔇 **${target.tag}** otomatis di-mute selama ${config.moderation.autoMuteDurationMinutes} menit karena mencapai ${total} warning.` });
        }
      }
      return;
    }

    if (sub === 'warnings') {
      const target = interaction.options.getUser('target');
      const warnings = db.getWarnings(target.id, guild.id);

      if (warnings.length === 0) return interaction.reply({ content: `✅ **${target.tag}** tidak punya warning.` });

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`Warning untuk ${target.tag}`)
        .setDescription(
          warnings.map((w, i) => `**${i + 1}.** ${w.reason}\n<t:${Math.floor(w.timestamp / 1000)}:R> oleh <@${w.moderatorId}>`).join('\n\n')
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'clearwarnings') {
      const target = interaction.options.getUser('target');
      db.clearWarnings(target.id, guild.id);
      return interaction.reply({ content: `✅ Semua warning **${target.tag}** telah dihapus.` });
    }

    if (sub === 'softban') {
      const target = interaction.options.getUser('target');
      const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';
      const deleteDays = interaction.options.getInteger('hapus_pesan_hari') || 1;
      const member = await guild.members.fetch(target.id).catch(() => null);

      if (member && !member.bannable) return interaction.reply({ content: '❌ Saya tidak punya izin untuk softban member ini.', ephemeral: true });

      await guild.members.ban(target.id, { deleteMessageSeconds: deleteDays * 86400, reason: `Softban: ${reason}` });
      await guild.members.unban(target.id, 'Softban: auto-unban').catch(() => {});

      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setDescription(`🔨 **${target.tag}** berhasil di-softban (pesan dihapus, tidak di-ban permanen).\n**Alasan:** ${reason}`);
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'purge') {
      const amount = interaction.options.getInteger('jumlah');
      const target = interaction.options.getUser('target');

      await interaction.deferReply({ ephemeral: true });
      const messages = await interaction.channel.messages.fetch({ limit: amount });
      const toDelete = target ? messages.filter(m => m.author.id === target.id) : messages;

      const deleted = await interaction.channel.bulkDelete(toDelete, true).catch(() => null);
      if (!deleted) return interaction.editReply('❌ Gagal menghapus pesan (pesan mungkin lebih tua dari 14 hari).');

      return interaction.editReply(`🧹 Berhasil menghapus **${deleted.size}** pesan${target ? ` dari ${target.tag}` : ''}.`);
    }

    if (sub === 'slowmode') {
      const seconds = interaction.options.getInteger('detik');
      await interaction.channel.setRateLimitPerUser(seconds).catch(() => null);

      if (seconds === 0) return interaction.reply(`🐇 Slowmode dimatikan di ${interaction.channel}.`);
      return interaction.reply(`🐌 Slowmode diatur ke **${seconds} detik** di ${interaction.channel}.`);
    }

    // ===== ROLE ADD/REMOVE (subcommand group) =====
    const group = interaction.options.getSubcommandGroup(false);
    if (group === 'role') {
      const target = interaction.options.getUser('target');
      const role = interaction.options.getRole('role');
      const member = await guild.members.fetch(target.id).catch(() => null);

      if (!member) return interaction.reply({ content: '❌ Member tidak ditemukan di server ini.', ephemeral: true });
      if (role.position >= guild.members.me.roles.highest.position) {
        return interaction.reply({ content: '❌ Saya tidak bisa mengatur role ini (posisi role lebih tinggi dari saya).', ephemeral: true });
      }

      if (sub === 'add') {
        if (member.roles.cache.has(role.id)) return interaction.reply({ content: `❌ **${target.tag}** sudah punya role ${role}.`, ephemeral: true });
        await member.roles.add(role);
        return interaction.reply(`✅ Role ${role} berhasil diberikan ke **${target.tag}**.`);
      }

      if (sub === 'remove') {
        if (!member.roles.cache.has(role.id)) return interaction.reply({ content: `❌ **${target.tag}** tidak punya role ${role}.`, ephemeral: true });
        await member.roles.remove(role);
        return interaction.reply(`✅ Role ${role} berhasil dicabut dari **${target.tag}**.`);
      }
    }
  },
};
