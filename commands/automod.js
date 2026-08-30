const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Pengaturan proteksi otomatis (anti-spam, anti-raid, filter kata kasar)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('antispam')
        .setDescription('Aktif/nonaktifkan proteksi anti-spam')
        .addBooleanOption(o => o.setName('aktif').setDescription('true = aktif, false = nonaktif').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('antiraid')
        .setDescription('Aktif/nonaktifkan proteksi anti-raid')
        .addBooleanOption(o => o.setName('aktif').setDescription('true = aktif, false = nonaktif').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('lockdown')
        .setDescription('Nyalakan mode lockdown manual (auto-kick akun baru yang join) selama beberapa menit')
        .addIntegerOption(o => o.setName('menit').setDescription('Durasi lockdown (default 10 menit)').setRequired(false)))
    .addSubcommand(sub => sub.setName('unlock').setDescription('Matikan mode lockdown sekarang'))
    .addSubcommand(sub =>
      sub.setName('badword-filter')
        .setDescription('Aktif/nonaktifkan filter kata kasar')
        .addBooleanOption(o => o.setName('aktif').setDescription('true = aktif, false = nonaktif').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('badword-add')
        .setDescription('Tambah kata ke filter kata kasar')
        .addStringOption(o => o.setName('kata').setDescription('Kata yang mau diblokir').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('badword-remove')
        .setDescription('Hapus kata dari filter kata kasar')
        .addStringOption(o => o.setName('kata').setDescription('Kata yang mau dihapus').setRequired(true)))
    .addSubcommand(sub => sub.setName('badword-loaddefault').setDescription('Muat daftar kata kasar default ke filter'))
    .addSubcommand(sub => sub.setName('badword-list').setDescription('Lihat daftar kata yang difilter'))
    .addSubcommand(sub => sub.setName('status').setDescription('Lihat status semua proteksi otomatis')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'antispam') {
      const aktif = interaction.options.getBoolean('aktif');
      db.updateGuildSettings(guild.id, { antispamEnabled: aktif ? 1 : 0 });
      return interaction.reply(`✅ Anti-spam ${aktif ? 'diaktifkan' : 'dinonaktifkan'}.`);
    }

    if (sub === 'antiraid') {
      const aktif = interaction.options.getBoolean('aktif');
      db.updateGuildSettings(guild.id, { raidProtectionEnabled: aktif ? 1 : 0 });
      return interaction.reply(`✅ Anti-raid ${aktif ? 'diaktifkan' : 'dinonaktifkan'}.`);
    }

    if (sub === 'lockdown') {
      const minutes = interaction.options.getInteger('menit') || config.raid.lockdownMinutes;
      const until = Date.now() + minutes * 60 * 1000;
      db.updateGuildSettings(guild.id, { raidLockdownUntil: until });
      return interaction.reply(`🔒 Mode lockdown aktif selama **${minutes} menit**. Akun baru (< ${config.raid.newAccountDays} hari) yang join akan otomatis di-kick.`);
    }

    if (sub === 'unlock') {
      db.updateGuildSettings(guild.id, { raidLockdownUntil: 0 });
      return interaction.reply('🔓 Mode lockdown dimatikan.');
    }

    if (sub === 'badword-filter') {
      const aktif = interaction.options.getBoolean('aktif');
      db.updateGuildSettings(guild.id, { badwordFilterEnabled: aktif ? 1 : 0 });
      return interaction.reply(`✅ Filter kata kasar ${aktif ? 'diaktifkan' : 'dinonaktifkan'}.`);
    }

    if (sub === 'badword-add') {
      const kata = interaction.options.getString('kata');
      const added = db.addBadword(guild.id, kata);
      return interaction.reply(added ? `✅ Kata **${kata}** ditambahkan ke filter.` : `⚠️ Kata itu sudah ada di filter.`);
    }

    if (sub === 'badword-remove') {
      const kata = interaction.options.getString('kata');
      db.removeBadword(guild.id, kata);
      return interaction.reply(`✅ Kata **${kata}** dihapus dari filter.`);
    }

    if (sub === 'badword-loaddefault') {
      let count = 0;
      for (const word of config.defaultBadwords) {
        if (db.addBadword(guild.id, word)) count++;
      }
      db.updateGuildSettings(guild.id, { badwordFilterEnabled: 1 });
      return interaction.reply(`✅ ${count} kata default ditambahkan ke filter. Filter otomatis diaktifkan.`);
    }

    if (sub === 'badword-list') {
      const words = db.getBadwords(guild.id);
      if (words.length === 0) return interaction.reply({ content: '❌ Belum ada kata di filter. Pakai `/automod badword-loaddefault` atau `/automod badword-add`.', ephemeral: true });
      return interaction.reply({ content: `📝 Kata yang difilter (${words.length}): ||${words.join(', ')}||`, ephemeral: true });
    }

    if (sub === 'status') {
      const settings = db.getGuildSettings(guild.id);
      const badwordCount = db.getBadwords(guild.id).length;
      const lockdownActive = settings.raidLockdownUntil > Date.now();

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('🛡️ Status Auto-Moderasi')
        .addFields(
          { name: 'Anti-spam', value: settings.antispamEnabled ? '🟢 Aktif' : '🔴 Nonaktif', inline: true },
          { name: 'Anti-raid', value: settings.raidProtectionEnabled ? '🟢 Aktif' : '🔴 Nonaktif', inline: true },
          { name: 'Lockdown', value: lockdownActive ? `🔒 Aktif sampai <t:${Math.floor(settings.raidLockdownUntil / 1000)}:T>` : '🔓 Tidak aktif', inline: true },
          { name: 'Filter kata kasar', value: settings.badwordFilterEnabled ? '🟢 Aktif' : '🔴 Nonaktif', inline: true },
          { name: 'Jumlah kata difilter', value: `${badwordCount}`, inline: true },
        );
      return interaction.reply({ embeds: [embed] });
    }
  },
};
