const {
  SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, ChannelType,
} = require('discord.js');
const config = require('../config.json');
const db = require('../database/db');

async function rebuildMenuMessage(guild, messageId) {
  const menu = db.getRoleMenu(messageId);
  if (!menu) return null;
  const channel = guild.channels.cache.get(menu.channelId);
  if (!channel) return null;
  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) return null;

  const options = db.getRoleMenuOptions(messageId);

  const embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle(menu.title || '🎭 Role Menu')
    .setDescription(
      (menu.description ? menu.description + '\n\n' : '') +
      (options.length ? options.map(o => `${o.emoji || '🔹'} <@&${o.roleId}> — ${o.label}`).join('\n') : '_Belum ada role, admin bisa tambah dengan /rolemenu addrole_')
    );

  const components = [];
  if (options.length > 0) {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`rolemenu_${messageId}`)
      .setPlaceholder('Pilih role yang kamu mau...')
      .setMinValues(0)
      .setMaxValues(options.length)
      .addOptions(options.map(o => ({
        label: o.label,
        value: o.roleId,
        emoji: o.emoji || undefined,
      })));
    components.push(new ActionRowBuilder().addComponents(select));
  }

  await message.edit({ embeds: [embed], components });
  return message;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rolemenu')
    .setDescription('Buat menu role yang bisa dipilih sendiri oleh member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Buat panel role menu baru di channel ini')
        .addStringOption(o => o.setName('judul').setDescription('Judul panel').setRequired(true))
        .addStringOption(o => o.setName('deskripsi').setDescription('Deskripsi panel').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('addrole')
        .setDescription('Tambah pilihan role ke panel yang sudah dibuat')
        .addStringOption(o => o.setName('message_id').setDescription('ID pesan panel role menu').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role yang ditambahkan').setRequired(true))
        .addStringOption(o => o.setName('label').setDescription('Nama tampilan di menu').setRequired(true))
        .addStringOption(o => o.setName('emoji').setDescription('Emoji (opsional)').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('removerole')
        .setDescription('Hapus pilihan role dari panel')
        .addStringOption(o => o.setName('message_id').setDescription('ID pesan panel role menu').setRequired(true))
        .addRoleOption(o => o.setName('role').setDescription('Role yang dihapus').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Hapus panel role menu sepenuhnya')
        .addStringOption(o => o.setName('message_id').setDescription('ID pesan panel role menu').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('Lihat semua panel role menu di server ini')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (sub === 'create') {
      const judul = interaction.options.getString('judul');
      const deskripsi = interaction.options.getString('deskripsi') || '';

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle(judul)
        .setDescription((deskripsi ? deskripsi + '\n\n' : '') + '_Belum ada role, admin bisa tambah dengan /rolemenu addrole_');

      const sent = await interaction.channel.send({ embeds: [embed] });
      db.createRoleMenu(sent.id, guild.id, interaction.channel.id, judul, deskripsi);

      return interaction.reply({ content: `✅ Panel role menu dibuat. ID pesan: \`${sent.id}\`\nGunakan ID ini untuk \`/rolemenu addrole\`.`, ephemeral: true });
    }

    if (sub === 'addrole') {
      const messageId = interaction.options.getString('message_id');
      const role = interaction.options.getRole('role');
      const label = interaction.options.getString('label');
      const emoji = interaction.options.getString('emoji');

      const menu = db.getRoleMenu(messageId);
      if (!menu) return interaction.reply({ content: '❌ Panel role menu dengan ID itu tidak ditemukan.', ephemeral: true });

      const existingOptions = db.getRoleMenuOptions(messageId);
      if (existingOptions.length >= 25) return interaction.reply({ content: '❌ Maksimal 25 role per panel (batasan Discord).', ephemeral: true });
      if (role.managed || role.id === guild.id) return interaction.reply({ content: '❌ Role ini tidak bisa dipakai.', ephemeral: true });

      const botMember = await guild.members.fetchMe();
      if (role.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: '❌ Role ini posisinya lebih tinggi dari role bot, saya tidak bisa memberikannya. Pindahkan role bot ke atas.', ephemeral: true });
      }

      db.addRoleMenuOption(messageId, role.id, label, emoji);
      const updated = await rebuildMenuMessage(guild, messageId);
      if (!updated) return interaction.reply({ content: '⚠️ Role ditambahkan ke database, tapi pesan panel tidak ditemukan (mungkin sudah dihapus).', ephemeral: true });

      return interaction.reply({ content: `✅ Role ${role} ditambahkan ke panel.`, ephemeral: true });
    }

    if (sub === 'removerole') {
      const messageId = interaction.options.getString('message_id');
      const role = interaction.options.getRole('role');

      const menu = db.getRoleMenu(messageId);
      if (!menu) return interaction.reply({ content: '❌ Panel role menu dengan ID itu tidak ditemukan.', ephemeral: true });

      db.removeRoleMenuOption(messageId, role.id);
      await rebuildMenuMessage(guild, messageId);

      return interaction.reply({ content: `✅ Role ${role} dihapus dari panel.`, ephemeral: true });
    }

    if (sub === 'delete') {
      const messageId = interaction.options.getString('message_id');
      const menu = db.getRoleMenu(messageId);
      if (!menu) return interaction.reply({ content: '❌ Panel role menu dengan ID itu tidak ditemukan.', ephemeral: true });

      const channel = guild.channels.cache.get(menu.channelId);
      if (channel) {
        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) await message.delete().catch(() => {});
      }
      db.deleteRoleMenu(messageId);
      return interaction.reply({ content: '✅ Panel role menu dihapus.', ephemeral: true });
    }

    if (sub === 'list') {
      const menus = db.getRoleMenusByGuild(guild.id);
      if (menus.length === 0) return interaction.reply({ content: '❌ Belum ada panel role menu di server ini.', ephemeral: true });

      const lines = menus.map(m => `**${m.title}** — <#${m.channelId}> — ID: \`${m.messageId}\``);
      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('📋 Daftar Role Menu')
        .setDescription(lines.join('\n'));
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  rebuildMenuMessage,
};
