const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Perintah leveling & XP')
    .addSubcommand(sub =>
      sub.setName('rank')
        .setDescription('Lihat level & XP kamu atau member lain')
        .addUserOption(o => o.setName('target').setDescription('Member yang dicek').setRequired(false)))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('Lihat papan peringkat level server'))
    .addSubcommand(sub =>
      sub.setName('setlevel')
        .setDescription('[Admin] Atur level member secara manual')
        .addUserOption(o => o.setName('target').setDescription('Member').setRequired(true))
        .addIntegerOption(o => o.setName('level').setDescription('Level baru').setRequired(true).setMinValue(0))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'rank') {
      const target = interaction.options.getUser('target') || interaction.user;
      const data = db.getLevel(target.id, guild.id);
      const needed = db.xpNeededForLevel(data.level);
      const nextLevelNeeded = db.xpNeededForLevel(data.level + 1);

      // hitung ranking
      const leaderboard = db.getLevelLeaderboard(guild.id, 10000);
      const rank = leaderboard.findIndex(u => u.userId === target.id) + 1;

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .setTitle(`Rank #${rank || '-'}`)
        .addFields(
          { name: 'Level', value: `${data.level}`, inline: true },
          { name: 'XP', value: `${data.xp} / ${nextLevelNeeded}`, inline: true },
        );

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'leaderboard') {
      const top = db.getLevelLeaderboard(guild.id, 10);
      if (top.length === 0) return interaction.reply('❌ Belum ada data level di server ini.');

      const lines = await Promise.all(top.map(async (u, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`;
        return `${medal} <@${u.userId}> — Level ${u.level} (${u.xp} XP)`;
      }));

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('🏆 Papan Peringkat Level')
        .setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'setlevel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Kamu butuh izin **Manage Server** untuk menggunakan perintah ini.', ephemeral: true });
      }
      const target = interaction.options.getUser('target');
      const level = interaction.options.getInteger('level');
      db.setLevel(target.id, guild.id, level);
      return interaction.reply(`✅ Level **${target.tag}** diatur ke **${level}**.`);
    }
  },
};
