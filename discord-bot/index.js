require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const config = require('./config.json');
const db = require('./database/db');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
});

// ================= LOAD COMMANDS =================
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
  }
}

// ================= LOAD EVENTS =================
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

// ================= SETUP MUSIC (DisTube) =================
client.distube = new DisTube(client, {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: [
    new SpotifyPlugin(),
    new SoundCloudPlugin(),
    new YtDlpPlugin(),
  ],
});

client.distube
  .on('playSong', (queue, song) => {
    queue.textChannel?.send(`🎶 Sekarang memutar: **${song.name}** - \`${song.formattedDuration}\` — diminta oleh ${song.user}`);
  })
  .on('addSong', (queue, song) => {
    queue.textChannel?.send(`✅ Ditambahkan ke antrian: **${song.name}** - \`${song.formattedDuration}\``);
  })
  .on('error', (textChannel, err) => {
    console.error('DisTube error:', err);
    textChannel?.send('❌ Terjadi kesalahan pada music player.').catch(() => {});
  })
  .on('finish', queue => {
    queue.textChannel?.send('✅ Antrian musik selesai.');
  })
  .on('empty', queue => {
    queue.textChannel?.send('👋 Voice channel kosong, keluar dari voice channel.');
  });

// ================= BACKGROUND TASKS =================

// Sweep polling yang sudah lewat waktu -> tutup otomatis
setInterval(async () => {
  const { buildPollEmbed, buildPollButtons } = require('./commands/poll');
  const expired = db.getActiveExpiredPolls();

  for (const poll of expired) {
    db.closePoll(poll.id);
    const guild = client.guilds.cache.get(poll.guildId);
    if (!guild) continue;

    const channel = guild.channels.cache.get(poll.channelId);
    if (!channel || !poll.messageId) continue;

    const message = await channel.messages.fetch(poll.messageId).catch(() => null);
    if (!message) continue;

    const votes = db.getPollVotes(poll.id);
    const closedPoll = { ...poll, status: 'closed' };

    await message.edit({
      embeds: [buildPollEmbed(closedPoll, votes)],
      components: buildPollButtons(poll.id, poll.options.length, true),
    }).catch(() => {});
  }
}, 30_000);

// Update voice channel statistik server secara berkala
setInterval(async () => {
  const { updateStatsChannels } = require('./commands/stats');
  for (const guild of client.guilds.cache.values()) {
    await updateStatsChannels(guild).catch(() => {});
  }
}, config.stats.updateIntervalMinutes * 60 * 1000);

// Lepas lockdown otomatis setelah waktunya habis (dicek tiap menit)
setInterval(() => {
  for (const guild of client.guilds.cache.values()) {
    const settings = db.getGuildSettings(guild.id);
    if (settings.raidLockdownUntil && settings.raidLockdownUntil <= Date.now()) {
      db.updateGuildSettings(guild.id, { raidLockdownUntil: 0 });
    }
  }
}, 60_000);

client.login(process.env.DISCORD_TOKEN);
