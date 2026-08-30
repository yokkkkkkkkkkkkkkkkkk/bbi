const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Pengaturan welcome message & auto-role')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('set-channel')
        .setDescription('Atur channel untuk welcome message')
        .addChannelOption(o => o.setName('channel').setDescription('Channel welcome').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('set-message')
        .setDescription('Atur teks welcome message. Gunakan {user}, {username}, {server}, {membercount}')
        .addStringOption(o => o.setName('teks').setDescription('Contoh: Selamat datang {user} di {server}!').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('set-autorole')
        .setDescription('Atur role otomatis untuk member baru')
        .addRoleOption(o => o.setName('role').setDescription('Role yang diberikan otomatis').setRequired(true)))
    .addSubcommand(sub => sub.setName('disable-autorole').setDescription('Matikan auto-role'))
    .addSubcommand(sub => sub.setName('test').setDescription('Uji coba welcome message sekarang'))
    .addSubcommand(sub => sub.setName('status').setDescription('Lihat pengaturan welcome saat ini')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'set-channel') {
      const channel = interaction.options.getChannel('channel');
      db.updateGuildSettings(guild.id, { welcomeChannelId: channel.id });
      return interaction.reply(`✅ Channel welcome diatur ke ${channel}.`);
    }

    if (sub === 'set-message') {
      const teks = interaction.options.getString('teks');
      db.updateGuildSettings(guild.id, { welcomeMessage: teks });
      return interaction.reply(`✅ Pesan welcome diatur ke:\n> ${teks}`);
    }

    if (sub === 'set-autorole') {
      const role = interaction.options.getRole('role');
      if (role.managed || role.id === guild.id) {
        return interaction.reply({ content: '❌ Role ini tidak bisa dipakai sebagai auto-role.', ephemeral: true });
      }
      db.updateGuildSettings(guild.id, { autoRoleId: role.id });
      return interaction.reply(`✅ Auto-role diatur ke ${role}.`);
    }

    if (sub === 'disable-autorole') {
      db.updateGuildSettings(guild.id, { autoRoleId: null });
      return interaction.reply('✅ Auto-role dimatikan.');
    }

    if (sub === 'test') {
      const settings = db.getGuildSettings(guild.id);
      if (!settings.welcomeChannelId) return interaction.reply({ content: '❌ Channel welcome belum diatur.', ephemeral: true });

      const channel = guild.channels.cache.get(settings.welcomeChannelId);
      if (!channel) return interaction.reply({ content: '❌ Channel welcome tidak ditemukan (mungkin sudah dihapus).', ephemeral: true });

      const text = buildWelcomeText(settings.welcomeMessage, interaction.member, guild);
      const embed = new EmbedBuilder()
        .setColor(config.successColor)
        .setDescription(text)
        .setThumbnail(interaction.user.displayAvatarURL());

      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: `✅ Test welcome message dikirim ke ${channel}.`, ephemeral: true });
    }

    if (sub === 'status') {
      const settings = db.getGuildSettings(guild.id);
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('⚙️ Pengaturan Welcome')
        .addFields(
          { name: 'Channel', value: settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : 'Belum diatur' },
          { name: 'Pesan', value: settings.welcomeMessage || '(pakai pesan default)' },
          { name: 'Auto-role', value: settings.autoRoleId ? `<@&${settings.autoRoleId}>` : 'Tidak aktif' },
        );
      return interaction.reply({ embeds: [embed] });
    }
  },
};

function buildWelcomeText(template, member, guild) {
  const fallback = 'Selamat datang {user} di **{server}**! Kamu member ke-{membercount}. 🎉';
  const text = template || fallback;
  return text
    .replaceAll('{user}', `${member}`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', guild.name)
    .replaceAll('{membercount}', `${guild.memberCount}`);
}

module.exports.buildWelcomeText = buildWelcomeText;
