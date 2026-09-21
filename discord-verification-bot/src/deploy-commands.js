'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error('DISCORD_TOKEN and CLIENT_ID are both required. Check your .env file.');
  process.exit(1);
}

const commandsDir = path.join(__dirname, 'commands');
const body = fs
  .readdirSync(commandsDir)
  .filter((file) => file.endsWith('.js'))
  .map((file) => require(path.join(commandsDir, file)).data.toJSON());

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    const data = await rest.put(route, { body });
    console.log(
      `Registered ${data.length} command(s) ${GUILD_ID ? `in guild ${GUILD_ID}` : 'globally (may take up to an hour to appear)'}.`,
    );
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exit(1);
  }
})();
