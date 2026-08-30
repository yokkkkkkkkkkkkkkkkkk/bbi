require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data) commands.push(command.data.toJSON());
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🚀 Mendaftarkan ${commands.length} slash command...`);

    if (process.env.GUILD_ID) {
      // Deploy ke satu server saja (instan, cocok untuk development)
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands },
      );
      console.log(`✅ Command berhasil didaftarkan ke server dengan ID ${process.env.GUILD_ID}`);
    } else {
      // Deploy global (butuh waktu hingga ~1 jam untuk update di semua server)
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands },
      );
      console.log('✅ Command berhasil didaftarkan secara global.');
    }
  } catch (error) {
    console.error('❌ Gagal mendaftarkan command:', error);
  }
})();
