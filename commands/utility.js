const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('utility')
    .setDescription('Perintah utilitas')
    .addSubcommand(sub =>
      sub.setName('avatar')
        .setDescription('Tampilkan avatar member')
        .addUserOption(o => o.setName('target').setDescription('Member yang dicek').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('userinfo')
        .setDescription('Tampilkan info member')
        .addUserOption(o => o.setName('target').setDescription('Member yang dicek').setRequired(false)))
    .addSubcommand(sub => sub.setName('serverinfo').setDescription('Tampilkan info & statistik server'))
    .addSubcommand(sub =>
      sub.setName('afk')
        .setDescription('Set status AFK kamu')
        .addStringOption(o => o.setName('alasan').setDescription('Alasan AFK').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'avatar') {
      const target = interaction.options.getUser('target') || interaction.user;
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`🖼️ Avatar ${target.tag}`)
        .setImage(target.displayAvatarURL({ size: 1024, dynamic: true }));
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'userinfo') {
      const target = interaction.options.getUser('target') || interaction.user;
      const member = await guild.members.fetch(target.id).catch(() => null);
      if (!member) return interaction.reply({ content: '❌ Member tidak ditemukan di server ini.', ephemeral: true });

      const roles = member.roles.cache
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(r => `${r}`)
        .slice(0, 15);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`👤 Info ${target.tag}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: 'ID', value: target.id, inline: true },
          { name: 'Nickname', value: member.nickname || '-', inline: true },
          { name: 'Bot?', value: target.bot ? 'Ya' : 'Tidak', inline: true },
          { name: 'Akun dibuat', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
          { name: 'Join server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`, inline: true },
          { name: `Roles (${roles.length})`, value: roles.length > 0 ? roles.join(', ') : '-', inline: false },
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'serverinfo') {
      const owner = await guild.fetchOwner().catch(() => null);
      const members = await guild.members.fetch().catch(() => guild.members.cache);
      const humanCount = members.filter(m => !m.user.bot).size;
      const botCount = members.filter(m => m.user.bot).size;

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`📊 Info Server: ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }))
        .addFields(
          { name: 'Owner', value: owner ? `${owner.user.tag}` : 'Tidak diketahui', inline: true },
          { name: 'ID Server', value: guild.id, inline: true },
          { name: 'Dibuat', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: 'Total Member', value: `${guild.memberCount} (👤 ${humanCount} · 🤖 ${botCount})`, inline: true },
          { name: 'Total Channel', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Total Role', value: `${guild.roles.cache.size}`, inline: true },
          { name: 'Boost Level', value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} boost)`, inline: true },
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'afk') {
      const reason = interaction.options.getString('alasan') || 'Tidak ada alasan';
      db.setAfk(interaction.user.id, guild.id, reason);
      return interaction.reply(`💤 ${interaction.user}, kamu sekarang AFK: **${reason}**`);
    }
  },
};
