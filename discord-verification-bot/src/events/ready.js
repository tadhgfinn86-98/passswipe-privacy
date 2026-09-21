'use strict';

const { ActivityType, Events } = require('discord.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    client.user.setPresence({
      activities: [{ name: 'for new members', type: ActivityType.Watching }],
      status: 'online',
    });
    console.log(`[ready] logged in as ${client.user.tag} in ${client.guilds.cache.size} server(s)`);
  },
};
