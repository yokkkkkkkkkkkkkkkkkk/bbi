const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
} = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Sistem ticket support')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Kirim panel pembuatan ticket ke channel ini')
        .addStringOption(o => o.setName('judul').setDescription('Judul panel').setRequired(false))
        .addStringOption(o => o.setName('deskripsi').setDescription('Deskripsi panel').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('set-log-channel')
        .setDescription('Atur channel log untuk ticket')
        .addChannelOption(o => o.setName('channel').setDescription('Channel log').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Tambah member ke ticket ini')
        .addUserOption(o => o.setName('target').setDescription('Member yang ditambahkan').setRequired(true)))
    .addSubcommand(sub => sub.setName('close').setDescription('Tutup ticket ini')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'setup') {
      const judul = interaction.options.getString('judul') || '🎫 Butuh Bantuan?';
      const deskripsi = interaction.options.getString('deskripsi') || 'Klik tombol di bawah untuk membuka ticket support. Tim kami akan segera membantu kamu.';

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(judul)
        .setDescription(deskripsi);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_create').setLabel('Buat Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫')
      );

      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ Panel ticket berhasil dikirim.', ephemeral: true });
    }

    if (sub === 'set-log-channel') {
      const channel = interaction.options.getChannel('channel');
      db.updateGuildSettings(guild.id, { ticketLogChannelId: channel.id });
      return interaction.reply(`✅ Channel log ticket diatur ke ${channel}.`);
    }

    if (sub === 'add') {
      const ticket = db.getTicket(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: '❌ Perintah ini hanya bisa dipakai di dalam channel ticket.', ephemeral: true });

      const target = interaction.options.getUser('target');
      await interaction.channel.permissionOverwrites.edit(target.id, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      });
      return interaction.reply(`✅ ${target} ditambahkan ke ticket ini.`);
    }

    if (sub === 'close') {
      const ticket = db.getTicket(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: '❌ Perintah ini hanya bisa dipakai di dalam channel ticket.', ephemeral: true });

      await interaction.reply('🔒 Ticket akan ditutup dalam 5 detik...');
      db.closeTicket(interaction.channel.id);

      const settings = db.getGuildSettings(guild.id);
      if (settings.ticketLogChannelId) {
        const logChannel = guild.channels.cache.get(settings.ticketLogChannelId);
        if (logChannel) {
          const embed = new EmbedBuilder()
            .setColor(config.errorColor)
            .setTitle('Ticket Ditutup')
            .addFields(
              { name: 'Channel', value: interaction.channel.name, inline: true },
              { name: 'Pembuat', value: `<@${ticket.userId}>`, inline: true },
              { name: 'Ditutup oleh', value: `${interaction.user}`, inline: true },
            )
            .setTimestamp();
          await logChannel.send({ embeds: [embed] });
        }
      }

      setTimeout(() => {
        interaction.channel.delete().catch(() => {});
      }, 5000);
    }
  },
};
