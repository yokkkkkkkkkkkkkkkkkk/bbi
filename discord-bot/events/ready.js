const { ActivityType } = require('discord.js');

module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ Bot online sebagai ${client.user.tag}`);
    console.log(`📊 Melayani ${client.guilds.cache.size} server`);

    client.user.setPresence({
      activities: [{ name: `/help | ${client.guilds.cache.size} server`, type: ActivityType.Watching }],
      status: 'online',
    });
  },
};
