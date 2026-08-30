const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Buat & kirim custom embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Buat dan kirim embed custom')
        .addStringOption(o => o.setName('judul').setDescription('Judul embed').setRequired(false))
        .addStringOption(o => o.setName('deskripsi').setDescription('Isi/deskripsi embed (bisa pakai \\n untuk baris baru)').setRequired(false))
        .addStringOption(o => o.setName('warna').setDescription('Warna hex, contoh #5865F2').setRequired(false))
        .addStringOption(o => o.setName('gambar').setDescription('URL gambar besar').setRequired(false))
        .addStringOption(o => o.setName('thumbnail').setDescription('URL gambar kecil (pojok kanan atas)').setRequired(false))
        .addStringOption(o => o.setName('footer').setDescription('Teks footer').setRequired(false))
        .addStringOption(o => o.setName('author').setDescription('Nama author (muncul di atas judul)').setRequired(false))
        .addChannelOption(o => o.setName('channel').setDescription('Channel tujuan (default: channel ini)').addChannelTypes(ChannelType.GuildText).setRequired(false))
        .addBooleanOption(o => o.setName('timestamp').setDescription('Tampilkan waktu sekarang di footer').setRequired(false))),

  async execute(interaction) {
    const judul = interaction.options.getString('judul');
    const deskripsi = interaction.options.getString('deskripsi');
    const warna = interaction.options.getString('warna') || config.embedColor;
    const gambar = interaction.options.getString('gambar');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');
    const author = interaction.options.getString('author');
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const useTimestamp = interaction.options.getBoolean('timestamp');

    if (!judul && !deskripsi && !gambar) {
      return interaction.reply({ content: '❌ Minimal isi judul, deskripsi, atau gambar.', ephemeral: true });
    }

    const hexPattern = /^#?[0-9A-Fa-f]{6}$/;
    if (warna && !hexPattern.test(warna)) {
      return interaction.reply({ content: '❌ Format warna tidak valid. Contoh yang benar: `#5865F2`.', ephemeral: true });
    }

    const embed = new EmbedBuilder().setColor(warna.startsWith('#') ? warna : `#${warna}`);

    if (judul) embed.setTitle(judul);
    if (deskripsi) embed.setDescription(deskripsi.replaceAll('\\n', '\n'));
    if (gambar) embed.setImage(gambar);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (footer) embed.setFooter({ text: footer });
    if (author) embed.setAuthor({ name: author });
    if (useTimestamp) embed.setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
      return interaction.reply({ content: `✅ Embed berhasil dikirim ke ${channel}.`, ephemeral: true });
    } catch (err) {
      return interaction.reply({ content: '❌ Gagal mengirim embed. Cek kembali URL gambar/format yang dimasukkan.', ephemeral: true });
    }
  },
};
