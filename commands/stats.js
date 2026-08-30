const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

async function updateStatsChannels(guild) {
  const settings = db.getGuildSettings(guild.id);
  if (!settings.statsTotalChannelId) return;

  await guild.members.fetch().catch(() => {});
  const total = guild.memberCount;
  const bots = guild.members.cache.filter(m => m.user.bot).size;
  const humans = total - bots;

  const totalChannel = guild.channels.cache.get(settings.statsTotalChannelId);
  const humanChannel = guild.channels.cache.get(settings.statsHumanChannelId);
  const botChannel = guild.channels.cache.get(settings.statsBotChannelId);

  if (totalChannel) await totalChannel.setName(`👥 Total: ${total}`).catch(() => {});
  if (humanChannel) await humanChannel.setName(`🧑 Member: ${humans}`).catch(() => {});
  if (botChannel) await botChannel.setName(`🤖 Bot: ${bots}`).catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Statistik & analitik server')
    .addSubcommand(sub => sub.setName('overview').setDescription('Lihat ringkasan statistik server'))
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('[Admin] Buat voice channel yang menampilkan statistik server otomatis'))
    .addSubcommand(sub =>
      sub.setName('disable')
        .setDescription('[Admin] Hapus voice channel statistik otomatis')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'overview') {
      await interaction.deferReply();
      await guild.members.fetch().catch(() => {});

      const total = guild.memberCount;
      const bots = guild.members.cache.filter(m => m.user.bot).size;
      const humans = total - bots;
      const online = guild.members.cache.filter(m => m.presence && m.presence.status !== 'offline').size;

      const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
      const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
      const roleCount = guild.roles.cache.size;

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const joins24h = db.countJoinsSince(guild.id, oneDayAgo);
      const joins7d = db.countJoinsSince(guild.id, sevenDaysAgo);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`📊 Statistik ${guild.name}`)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: '👥 Total Member', value: `${total}`, inline: true },
          { name: '🧑 Manusia', value: `${humans}`, inline: true },
          { name: '🤖 Bot', value: `${bots}`, inline: true },
          { name: '🟢 Online (terdeteksi)', value: `${online}`, inline: true },
          { name: '💬 Text Channel', value: `${textChannels}`, inline: true },
          { name: '🔊 Voice Channel', value: `${voiceChannels}`, inline: true },
          { name: '🎭 Jumlah Role', value: `${roleCount}`, inline: true },
          { name: '💎 Boost', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
          { name: '📅 Server Dibuat', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '📈 Join 24 Jam Terakhir', value: `${joins24h}`, inline: true },
          { name: '📈 Join 7 Hari Terakhir', value: `${joins7d}`, inline: true },
        );

      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Kamu butuh izin **Manage Server** untuk menggunakan perintah ini.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });

      const category = await guild.channels.create({
        name: config.stats.categoryName,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: ['Connect'] },
        ],
      });

      const totalChannel = await guild.channels.create({ name: '👥 Total: -', type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ['Connect'] }] });
      const humanChannel = await guild.channels.create({ name: '🧑 Member: -', type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ['Connect'] }] });
      const botChannel = await guild.channels.create({ name: '🤖 Bot: -', type: ChannelType.GuildVoice, parent: category.id, permissionOverwrites: [{ id: guild.roles.everyone.id, deny: ['Connect'] }] });

      db.updateGuildSettings(guild.id, {
        statsCategoryId: category.id,
        statsTotalChannelId: totalChannel.id,
        statsHumanChannelId: humanChannel.id,
        statsBotChannelId: botChannel.id,
      });

      await updateStatsChannels(guild);

      return interaction.editReply(`✅ Channel statistik otomatis dibuat! Update tiap ${config.stats.updateIntervalMinutes} menit (dibatasi rate-limit Discord).`);
    }

    if (sub === 'disable') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Kamu butuh izin **Manage Server** untuk menggunakan perintah ini.', ephemeral: true });
      }
      const settings = db.getGuildSettings(guild.id);
      const ids = [settings.statsTotalChannelId, settings.statsHumanChannelId, settings.statsBotChannelId, settings.statsCategoryId];

      for (const id of ids) {
        if (!id) continue;
        const ch = guild.channels.cache.get(id);
        if (ch) await ch.delete().catch(() => {});
      }

      db.updateGuildSettings(guild.id, { statsCategoryId: null, statsTotalChannelId: null, statsHumanChannelId: null, statsBotChannelId: null });
      return interaction.reply({ content: '✅ Channel statistik otomatis dihapus.', ephemeral: true });
    }
  },

  updateStatsChannels,
};
