const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Perintah music player')
    .addSubcommand(sub =>
      sub.setName('play')
        .setDescription('Putar lagu dari YouTube/Spotify/SoundCloud (URL atau judul lagu)')
        .addStringOption(o => o.setName('lagu').setDescription('URL atau judul lagu').setRequired(true)))
    .addSubcommand(sub => sub.setName('skip').setDescription('Skip lagu yang sedang diputar'))
    .addSubcommand(sub => sub.setName('stop').setDescription('Hentikan musik dan keluar dari voice channel'))
    .addSubcommand(sub => sub.setName('pause').setDescription('Pause lagu yang sedang diputar'))
    .addSubcommand(sub => sub.setName('resume').setDescription('Lanjutkan lagu yang di-pause'))
    .addSubcommand(sub => sub.setName('queue').setDescription('Lihat antrian lagu'))
    .addSubcommand(sub =>
      sub.setName('volume')
        .setDescription('Atur volume musik (0-100)')
        .addIntegerOption(o => o.setName('persen').setDescription('Volume dalam persen').setRequired(true).setMinValue(0).setMaxValue(100)))
    .addSubcommand(sub => sub.setName('nowplaying').setDescription('Lihat lagu yang sedang diputar'))
    .addSubcommand(sub => sub.setName('autoplay').setDescription('Nyalakan/matikan autoplay lagu mirip saat antrian habis'))
    .addSubcommand(sub =>
      sub.setName('loop')
        .setDescription('Ulang lagu saat ini / seluruh antrian / matikan')
        .addStringOption(o =>
          o.setName('mode')
            .setDescription('Mode repeat')
            .setRequired(true)
            .addChoices(
              { name: 'Matikan', value: 'off' },
              { name: 'Ulang lagu ini', value: 'song' },
              { name: 'Ulang seluruh antrian', value: 'queue' },
            )))
    .addSubcommand(sub =>
      sub.setName('lyrics')
        .setDescription('Cari lirik lagu')
        .addStringOption(o => o.setName('judul').setDescription('Format: artis - judul (kosongkan untuk lagu yang sedang diputar)').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const { member, guild, client } = interaction;
    const distube = client.distube;

    const voiceChannel = member.voice.channel;

    if (sub === 'play') {
      if (!voiceChannel) return interaction.reply({ content: '❌ Kamu harus join voice channel dulu.', ephemeral: true });

      await interaction.deferReply();
      const query = interaction.options.getString('lagu');

      try {
        await distube.play(voiceChannel, query, {
          member,
          textChannel: interaction.channel,
        });
        await interaction.editReply(`🔎 Mencari & menambahkan **${query}** ke antrian...`);
      } catch (err) {
        console.error(err);
        await interaction.editReply('❌ Gagal memutar lagu. Coba judul/URL lain.');
      }
      return;
    }

    const queue = distube.getQueue(guild.id);

    if (sub === 'skip') {
      if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
      try {
        const song = await queue.skip();
        return interaction.reply(`⏭️ Skip! Sekarang memutar: **${song.name}**`);
      } catch (err) {
        return interaction.reply({ content: '❌ Tidak ada lagu selanjutnya di antrian.', ephemeral: true });
      }
    }

    if (sub === 'stop') {
      if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
      queue.stop();
      return interaction.reply('⏹️ Musik dihentikan, keluar dari voice channel.');
    }

    if (sub === 'pause') {
      if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
      queue.pause();
      return interaction.reply('⏸️ Musik di-pause.');
    }

    if (sub === 'resume') {
      if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
      queue.resume();
      return interaction.reply('▶️ Musik dilanjutkan.');
    }

    if (sub === 'queue') {
      if (!queue || queue.songs.length === 0) return interaction.reply({ content: '❌ Antrian kosong.', ephemeral: true });

      const list = queue.songs
        .slice(0, 10)
        .map((song, i) => `${i === 0 ? '▶️' : `${i}.`} **${song.name}** - \`${song.formattedDuration}\``)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('🎵 Antrian Musik')
        .setDescription(list)
        .setFooter({ text: `Total: ${queue.songs.length} lagu` });

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'volume') {
      if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
      const percent = interaction.options.getInteger('persen');
      queue.setVolume(percent);
      return interaction.reply(`🔊 Volume diatur ke **${percent}%**.`);
    }

    if (sub === 'nowplaying') {
      if (!queue || !queue.songs[0]) return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
      const song = queue.songs[0];

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('🎶 Sedang Diputar')
        .setDescription(`**${song.name}**`)
        .addFields(
          { name: 'Durasi', value: song.formattedDuration, inline: true },
          { name: 'Diminta oleh', value: `${song.user}`, inline: true },
          { name: 'Volume', value: `${queue.volume}%`, inline: true },
        )
        .setThumbnail(song.thumbnail);

      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'autoplay') {
      if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
      const enabled = queue.toggleAutoplay();
      return interaction.reply(enabled ? '🔁 Autoplay **dinyalakan** (lagu mirip akan diputar otomatis saat antrian habis).' : '⏹️ Autoplay **dimatikan**.');
    }

    if (sub === 'loop') {
      if (!queue) return interaction.reply({ content: '❌ Tidak ada lagu yang sedang diputar.', ephemeral: true });
      const mode = interaction.options.getString('mode');
      const modeMap = { off: 0, song: 1, queue: 2 };
      queue.setRepeatMode(modeMap[mode]);

      const label = { off: '⏹️ Repeat dimatikan.', song: '🔂 Mengulang lagu saat ini.', queue: '🔁 Mengulang seluruh antrian.' };
      return interaction.reply(label[mode]);
    }

    if (sub === 'lyrics') {
      const input = interaction.options.getString('judul');
      let query = input;

      if (!query) {
        if (!queue || !queue.songs[0]) return interaction.reply({ content: '❌ Tidak ada lagu diputar, sebutkan judulnya: `artis - judul`.', ephemeral: true });
        query = queue.songs[0].name;
      }

      await interaction.deferReply();

      let artist = '';
      let title = query;
      if (query.includes(' - ')) {
        [artist, title] = query.split(' - ').map(s => s.trim());
      }

      try {
        const url = artist
          ? `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
          : `https://api.lyrics.ovh/v1/${encodeURIComponent(title)}/${encodeURIComponent(title)}`;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.lyrics) return interaction.editReply(`❌ Lirik untuk **${query}** tidak ditemukan. Coba format \`artis - judul\`.`);

        const lyrics = data.lyrics.length > 4000 ? data.lyrics.slice(0, 4000) + '\n...(dipotong)' : data.lyrics;
        const embed = new EmbedBuilder()
          .setColor(config.embedColor)
          .setTitle(`📜 Lirik: ${query}`)
          .setDescription(lyrics);
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error(err);
        return interaction.editReply('❌ Gagal mengambil lirik. Coba format `artis - judul`.');
      }
    }
  },
};
