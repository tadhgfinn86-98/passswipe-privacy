'use strict';

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, GatewayIntentBits } = require('discord.js');

const store = require('./lib/store');

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN is missing. Copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // Privileged: enable "Server Members Intent" in the Developer Portal.
    // Needed to read member roles and to react when someone joins.
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

function loadDir(dir, onFile) {
  const full = path.join(__dirname, dir);
  for (const file of fs.readdirSync(full).filter((name) => name.endsWith('.js'))) {
    onFile(require(path.join(full, file)), file);
  }
}

loadDir('commands', (command, file) => {
  if (!command?.data || typeof command.execute !== 'function') {
    console.warn(`[load] skipping commands/${file}: missing "data" or "execute"`);
    return;
  }
  client.commands.set(command.data.name, command);
});

loadDir('events', (event, file) => {
  if (!event?.name || typeof event.execute !== 'function') {
    console.warn(`[load] skipping events/${file}: missing "name" or "execute"`);
    return;
  }
  const handler = (...args) => event.execute(...args);
  if (event.once) client.once(event.name, handler);
  else client.on(event.name, handler);
});

client.on('error', (err) => console.error('[client] error:', err));
process.on('unhandledRejection', (err) => console.error('[process] unhandled rejection:', err));

async function shutdown(signal) {
  console.log(`[process] ${signal} received, shutting down`);
  await store.flush().catch(() => {});
  await client.destroy();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error('[login] could not connect:', err.message);
  if (/disallowed intents/i.test(err.message)) {
    console.error(
      '[login] enable "Server Members Intent" under Bot -> Privileged Gateway Intents in the Developer Portal.',
    );
  } else {
    console.error('[login] check that DISCORD_TOKEN in .env is a current bot token.');
  }
  process.exit(1);
});
