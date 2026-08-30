const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
} = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Sistem saran/masukan untuk server')
    .addSubcommand(sub =>
      sub.setName('submit')
        .setDescription('Kirim saran untuk server ini')
        .addStringOption(o => o.setName('saran').setDescription('Isi saran kamu').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('set-channel')
        .setDescription('[Admin] Atur channel untuk menampilkan saran')
        .addChannelOption(o => o.setName('channel').setDescription('Channel saran').addChannelTypes(ChannelType.GuildText).setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'set-channel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Kamu butuh izin **Manage Server** untuk menggunakan perintah ini.', ephemeral: true });
      }
      const channel = interaction.options.getChannel('channel');
      db.updateGuildSettings(guild.id, { suggestionChannelId: channel.id });
      return interaction.reply(`✅ Channel saran diatur ke ${channel}.`);
    }

    if (sub === 'submit') {
      const settings = db.getGuildSettings(guild.id);
      if (!settings.suggestionChannelId) {
        return interaction.reply({ content: '❌ Channel saran belum diatur admin. Gunakan `/suggest set-channel` dulu.', ephemeral: true });
      }
      const channel = guild.channels.cache.get(settings.suggestionChannelId);
      if (!channel) return interaction.reply({ content: '❌ Channel saran tidak ditemukan (mungkin sudah dihapus).', ephemeral: true });

      const content = interaction.options.getString('saran');
      const id = db.createSuggestion(guild.id, channel.id, interaction.user.id, content);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setTitle(`💡 Saran #${id}`)
        .setDescription(content)
        .setFooter({ text: 'Status: ⏳ Menunggu review' });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`suggest_approve_${id}`).setLabel('Setuju').setStyle(ButtonStyle.Success).setEmoji('✅'),
        new ButtonBuilder().setCustomId(`suggest_deny_${id}`).setLabel('Tolak').setStyle(ButtonStyle.Danger).setEmoji('❌'),
      );

      const sent = await channel.send({ embeds: [embed], components: [row] });
      await sent.react('👍').catch(() => {});
      await sent.react('👎').catch(() => {});
      db.setSuggestionMessage(id, sent.id);

      return interaction.reply({ content: `✅ Saran kamu (#${id}) sudah dikirim ke ${channel}!`, ephemeral: true });
    }
  },
};
