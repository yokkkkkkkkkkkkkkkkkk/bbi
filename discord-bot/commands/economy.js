const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

const { currencyName, currencySymbol } = config.economy;

function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts = [];
  if (h) parts.push(`${h}j`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}d`);
  return parts.join(' ');
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('eco')
    .setDescription('Perintah ekonomi virtual')
    .addSubcommand(sub =>
      sub.setName('balance')
        .setDescription('Lihat saldo kamu atau member lain')
        .addUserOption(o => o.setName('target').setDescription('Member yang dicek').setRequired(false)))
    .addSubcommand(sub => sub.setName('daily').setDescription('Klaim hadiah harian'))
    .addSubcommand(sub => sub.setName('work').setDescription('Kerja untuk dapat koin'))
    .addSubcommand(sub =>
      sub.setName('pay')
        .setDescription('Transfer koin ke member lain')
        .addUserOption(o => o.setName('target').setDescription('Penerima').setRequired(true))
        .addIntegerOption(o => o.setName('jumlah').setDescription('Jumlah koin').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('deposit')
        .setDescription('Simpan koin ke bank (aman dari robbery/dsb)')
        .addIntegerOption(o => o.setName('jumlah').setDescription('Jumlah koin, atau -1 untuk semua').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('withdraw')
        .setDescription('Tarik koin dari bank')
        .addIntegerOption(o => o.setName('jumlah').setDescription('Jumlah koin, atau -1 untuk semua').setRequired(true)))
    .addSubcommand(sub => sub.setName('leaderboard').setDescription('Lihat papan peringkat terkaya')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const userId = interaction.user.id;

    if (sub === 'balance') {
      const target = interaction.options.getUser('target') || interaction.user;
      const data = db.getEconomy(target.id, guild.id);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
        .addFields(
          { name: 'Dompet', value: `${currencySymbol} ${data.balance}`, inline: true },
          { name: 'Bank', value: `${currencySymbol} ${data.bank}`, inline: true },
          { name: 'Total', value: `${currencySymbol} ${data.balance + data.bank}`, inline: true },
        );
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'daily') {
      const data = db.getEconomy(userId, guild.id);
      const cooldownMs = config.economy.dailyCooldownHours * 60 * 60 * 1000;
      const elapsed = Date.now() - data.lastDaily;

      if (elapsed < cooldownMs) {
        return interaction.reply({ content: `⏳ Kamu sudah klaim harian. Coba lagi dalam **${formatMs(cooldownMs - elapsed)}**.`, ephemeral: true });
      }

      db.updateBalance(userId, guild.id, config.economy.dailyAmount);
      db.setLastDaily(userId, guild.id, Date.now());
      return interaction.reply(`🎁 Kamu mengklaim hadiah harian: **${currencySymbol} ${config.economy.dailyAmount}**!`);
    }

    if (sub === 'work') {
      const data = db.getEconomy(userId, guild.id);
      const cooldownMs = config.economy.workCooldownHours * 60 * 60 * 1000;
      const elapsed = Date.now() - data.lastWork;

      if (elapsed < cooldownMs) {
        return interaction.reply({ content: `⏳ Kamu sedang lelah. Kerja lagi dalam **${formatMs(cooldownMs - elapsed)}**.`, ephemeral: true });
      }

      const { workMin, workMax } = config.economy;
      const amount = Math.floor(Math.random() * (workMax - workMin + 1)) + workMin;

      const jobs = [
        'menjadi kurir', 'ngoding bug fix', 'jualan kopi', 'jadi content creator',
        'nyuci motor tetangga', 'jadi tukang parkir', 'live streaming game',
      ];
      const job = jobs[Math.floor(Math.random() * jobs.length)];

      db.updateBalance(userId, guild.id, amount);
      db.setLastWork(userId, guild.id, Date.now());
      return interaction.reply(`💼 Kamu ${job} dan mendapatkan **${currencySymbol} ${amount}**!`);
    }

    if (sub === 'pay') {
      const target = interaction.options.getUser('target');
      const amount = interaction.options.getInteger('jumlah');

      if (target.id === userId) return interaction.reply({ content: '❌ Tidak bisa transfer ke diri sendiri.', ephemeral: true });
      if (target.bot) return interaction.reply({ content: '❌ Tidak bisa transfer ke bot.', ephemeral: true });

      const data = db.getEconomy(userId, guild.id);
      if (data.balance < amount) return interaction.reply({ content: `❌ Saldo dompet kamu tidak cukup. Saldo: ${currencySymbol} ${data.balance}`, ephemeral: true });

      db.updateBalance(userId, guild.id, -amount);
      db.updateBalance(target.id, guild.id, amount);
      return interaction.reply(`💸 Kamu mengirim **${currencySymbol} ${amount}** ke **${target.tag}**.`);
    }

    if (sub === 'deposit') {
      let amount = interaction.options.getInteger('jumlah');
      const data = db.getEconomy(userId, guild.id);

      if (amount === -1) amount = data.balance;
      if (amount <= 0) return interaction.reply({ content: '❌ Jumlah tidak valid.', ephemeral: true });
      if (data.balance < amount) return interaction.reply({ content: `❌ Saldo dompet tidak cukup. Saldo: ${currencySymbol} ${data.balance}`, ephemeral: true });

      db.updateBalance(userId, guild.id, -amount);
      db.updateBank(userId, guild.id, amount);
      return interaction.reply(`🏦 Kamu menyimpan **${currencySymbol} ${amount}** ke bank.`);
    }

    if (sub === 'withdraw') {
      let amount = interaction.options.getInteger('jumlah');
      const data = db.getEconomy(userId, guild.id);

      if (amount === -1) amount = data.bank;
      if (amount <= 0) return interaction.reply({ content: '❌ Jumlah tidak valid.', ephemeral: true });
      if (data.bank < amount) return interaction.reply({ content: `❌ Saldo bank tidak cukup. Saldo bank: ${currencySymbol} ${data.bank}`, ephemeral: true });

      db.updateBank(userId, guild.id, -amount);
      db.updateBalance(userId, guild.id, amount);
      return interaction.reply(`💵 Kamu menarik **${currencySymbol} ${amount}** dari bank.`);
    }

    if (sub === 'leaderboard') {
      const top = db.getEconomyLeaderboard(guild.id, 10);
      if (top.length === 0) return interaction.reply('❌ Belum ada data ekonomi di server ini.');

      const lines = top.map((u, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`;
        return `${medal} <@${u.userId}> — ${currencySymbol} ${u.balance + u.bank}`;
      });

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(`💰 Papan Peringkat ${currencyName} Terkaya`)
        .setDescription(lines.join('\n'));

      return interaction.reply({ embeds: [embed] });
    }
  },
};
