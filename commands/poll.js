const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

function buildResultsBar(count, total, barLength = 15) {
  if (total === 0) return '░'.repeat(barLength) + ' 0%';
  const percent = Math.round((count / total) * 100);
  const filled = Math.round((count / total) * barLength);
  return '█'.repeat(filled) + '░'.repeat(barLength - filled) + ` ${percent}% (${count})`;
}

function buildPollEmbed(poll, votes) {
  const total = votes.length;
  const counts = new Array(poll.options.length).fill(0);
  for (const v of votes) counts[v.optionIndex]++;

  const desc = poll.options.map((opt, i) =>
    `${NUMBER_EMOJIS[i]} **${opt}**\n${buildResultsBar(counts[i], total)}`
  ).join('\n\n');

  const isActive = poll.status === 'active' && poll.endsAt > Date.now();

  return new EmbedBuilder()
    .setColor(isActive ? config.embedColor : config.errorColor)
    .setTitle(`📊 ${poll.question}`)
    .setDescription(desc)
    .setFooter({ text: isActive ? `Total suara: ${total} • Berakhir` : `Poll ditutup • Total suara: ${total}` })
    .setTimestamp(isActive ? poll.endsAt : null);
}

function buildPollButtons(pollId, optionCount, disabled = false) {
  const row = new ActionRowBuilder();
  for (let i = 0; i < optionCount; i++) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_vote_${pollId}_${i}`)
        .setLabel(`${i + 1}`)
        .setEmoji(NUMBER_EMOJIS[i])
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    );
  }
  return [row];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Buat polling interaktif dengan tombol vote')
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Buat polling baru')
        .addStringOption(o => o.setName('pertanyaan').setDescription('Pertanyaan polling').setRequired(true))
        .addStringOption(o => o.setName('opsi1').setDescription('Pilihan 1').setRequired(true))
        .addStringOption(o => o.setName('opsi2').setDescription('Pilihan 2').setRequired(true))
        .addStringOption(o => o.setName('opsi3').setDescription('Pilihan 3').setRequired(false))
        .addStringOption(o => o.setName('opsi4').setDescription('Pilihan 4').setRequired(false))
        .addStringOption(o => o.setName('opsi5').setDescription('Pilihan 5').setRequired(false))
        .addIntegerOption(o => o.setName('durasi_menit').setDescription('Durasi polling dalam menit (default 60)').setRequired(false).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('[Admin] Akhiri polling lebih awal')
        .addIntegerOption(o => o.setName('poll_id').setDescription('ID polling').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'create') {
      const question = interaction.options.getString('pertanyaan');
      const options = [1, 2, 3, 4, 5]
        .map(i => interaction.options.getString(`opsi${i}`))
        .filter(Boolean);
      const durationMin = interaction.options.getInteger('durasi_menit') || 60;
      const endsAt = Date.now() + durationMin * 60 * 1000;

      const pollId = db.createPoll(guild.id, interaction.channel.id, question, options, endsAt);
      const poll = db.getPoll(pollId);

      const embed = buildPollEmbed(poll, []);
      const components = buildPollButtons(pollId, options.length);

      const sent = await interaction.reply({ embeds: [embed], components, fetchReply: true });
      db.setPollMessage(pollId, sent.id);
      return;
    }

    if (sub === 'end') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Kamu butuh izin **Manage Server** untuk menggunakan perintah ini.', ephemeral: true });
      }
      const pollId = interaction.options.getInteger('poll_id');
      const poll = db.getPoll(pollId);
      if (!poll || poll.guildId !== guild.id) return interaction.reply({ content: '❌ Polling tidak ditemukan.', ephemeral: true });
      if (poll.status !== 'active') return interaction.reply({ content: '❌ Polling sudah ditutup.', ephemeral: true });

      db.closePoll(pollId);
      const votes = db.getPollVotes(pollId);
      const closedPoll = { ...poll, status: 'closed' };

      const channel = guild.channels.cache.get(poll.channelId);
      if (channel && poll.messageId) {
        const msg = await channel.messages.fetch(poll.messageId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [buildPollEmbed(closedPoll, votes)],
            components: buildPollButtons(pollId, poll.options.length, true),
          }).catch(() => {});
        }
      }

      return interaction.reply({ content: `✅ Polling #${pollId} ditutup.`, ephemeral: true });
    }
  },

  buildPollEmbed,
  buildPollButtons,
};
