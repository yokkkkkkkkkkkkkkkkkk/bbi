const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ChannelType, PermissionFlagsBits,
} = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');
const { buildPollEmbed, buildPollButtons } = require('../commands/poll');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    // ===== SLASH COMMANDS =====
    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction);
      } catch (err) {
        console.error(`Error menjalankan command ${interaction.commandName}:`, err);
        const errorMsg = { content: '❌ Terjadi kesalahan saat menjalankan perintah ini.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMsg).catch(() => {});
        } else {
          await interaction.reply(errorMsg).catch(() => {});
        }
      }
      return;
    }

    // ===== SELECT MENU: ROLE MENU =====
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('rolemenu_')) {
      await interaction.deferReply({ ephemeral: true });
      const messageId = interaction.customId.replace('rolemenu_', '');
      const options = db.getRoleMenuOptions(messageId);
      const selectedRoleIds = interaction.values;

      const member = interaction.member;
      const added = [];
      const removed = [];

      for (const opt of options) {
        const hasRole = member.roles.cache.has(opt.roleId);
        const isSelected = selectedRoleIds.includes(opt.roleId);

        if (isSelected && !hasRole) {
          await member.roles.add(opt.roleId).catch(() => {});
          added.push(opt.label);
        } else if (!isSelected && hasRole) {
          await member.roles.remove(opt.roleId).catch(() => {});
          removed.push(opt.label);
        }
      }

      let msg = '';
      if (added.length) msg += `✅ Role ditambahkan: ${added.join(', ')}\n`;
      if (removed.length) msg += `❌ Role dihapus: ${removed.join(', ')}`;
      if (!msg) msg = 'Tidak ada perubahan role.';

      return interaction.editReply(msg);
    }

    // ===== BUTTON: POLL VOTE =====
    if (interaction.isButton() && interaction.customId.startsWith('poll_vote_')) {
      const [, , pollId, optionIndex] = interaction.customId.split('_');
      const poll = db.getPoll(Number(pollId));

      if (!poll || poll.status !== 'active') {
        return interaction.reply({ content: '❌ Polling ini sudah ditutup.', ephemeral: true });
      }
      if (poll.endsAt <= Date.now()) {
        return interaction.reply({ content: '❌ Waktu polling sudah habis.', ephemeral: true });
      }

      db.castVote(Number(pollId), interaction.user.id, Number(optionIndex));
      const votes = db.getPollVotes(Number(pollId));

      await interaction.update({
        embeds: [buildPollEmbed(poll, votes)],
        components: buildPollButtons(Number(pollId), poll.options.length),
      });
      return;
    }

    // ===== BUTTON: SUGGESTION APPROVE/DENY =====
    if (interaction.isButton() && (interaction.customId.startsWith('suggest_approve_') || interaction.customId.startsWith('suggest_deny_'))) {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return interaction.reply({ content: '❌ Kamu tidak punya izin untuk review saran.', ephemeral: true });
      }

      const isApprove = interaction.customId.startsWith('suggest_approve_');
      const id = Number(interaction.customId.split('_')[2]);
      const suggestion = db.getSuggestion(id);
      if (!suggestion) return interaction.reply({ content: '❌ Saran tidak ditemukan.', ephemeral: true });

      db.updateSuggestionStatus(id, isApprove ? 'approved' : 'denied', null);

      const embed = EmbedBuilder.from(interaction.message.embeds[0])
        .setColor(isApprove ? config.successColor : config.errorColor)
        .setFooter({ text: `Status: ${isApprove ? '✅ Disetujui' : '❌ Ditolak'} oleh ${interaction.user.tag}` });

      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(interaction.message.components[0].components[0]).setDisabled(true),
        ButtonBuilder.from(interaction.message.components[0].components[1]).setDisabled(true),
      );

      await interaction.update({ embeds: [embed], components: [disabledRow] });
      return;
    }

    // ===== BUTTON: BUAT TICKET =====
    if (interaction.isButton() && interaction.customId === 'ticket_create') {
      const guild = interaction.guild;
      const existing = db.getOpenTicketByUser(guild.id, interaction.user.id);

      if (existing) {
        const channel = guild.channels.cache.get(existing.channelId);
        if (channel) {
          return interaction.reply({ content: `❌ Kamu sudah punya ticket terbuka di ${channel}.`, ephemeral: true });
        }
      }

      await interaction.deferReply({ ephemeral: true });

      const settings = db.getGuildSettings(guild.id);
      let category = settings.ticketCategoryId ? guild.channels.cache.get(settings.ticketCategoryId) : null;

      if (!category) {
        category = await guild.channels.create({
          name: config.ticket.categoryName,
          type: ChannelType.GuildCategory,
        });
        db.updateGuildSettings(guild.id, { ticketCategoryId: category.id });
      }

      const ticketChannel = await guild.channels.create({
        name: `ticket-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
        ],
      });

      db.createTicket(ticketChannel.id, guild.id, interaction.user.id);

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('🎫 Ticket Support')
        .setDescription(`Halo ${interaction.user}, terima kasih sudah membuat ticket.\nSilakan jelaskan masalah/pertanyaan kamu, tim kami akan segera membantu.`);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_close').setLabel('Tutup Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒')
      );

      await ticketChannel.send({ content: `${interaction.user}`, embeds: [embed], components: [row] });
      await interaction.editReply(`✅ Ticket kamu dibuat: ${ticketChannel}`);
      return;
    }

    // ===== BUTTON: TUTUP TICKET =====
    if (interaction.isButton() && interaction.customId === 'ticket_close') {
      const ticket = db.getTicket(interaction.channel.id);
      if (!ticket) return interaction.reply({ content: '❌ Ini bukan channel ticket.', ephemeral: true });

      await interaction.reply('🔒 Ticket akan ditutup dalam 5 detik...');
      db.closeTicket(interaction.channel.id);

      const settings = db.getGuildSettings(interaction.guild.id);
      if (settings.ticketLogChannelId) {
        const logChannel = interaction.guild.channels.cache.get(settings.ticketLogChannelId);
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
