import { Events, MessageFlags, type Client, type Interaction } from 'discord.js';
import { commandsByName } from '../commands';
import { logger } from '../utils/logger';

async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commandsByName.get(interaction.commandName);
  if (!command) {
    logger.warn(`Received an unknown command: /${interaction.commandName}`);
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    logger.error(`/${interaction.commandName} failed`, error);

    const message = {
      content: 'Something went wrong running that command. The error has been logged.',
      flags: MessageFlags.Ephemeral,
    } as const;

    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(message);
      } else {
        await interaction.reply(message);
      }
    } catch {
      // The interaction token expired or the reply already failed — nothing
      // useful left to say to the user.
      logger.debug('Could not deliver the command error reply');
    }
  }
}

export function register(client: Client): void {
  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction).catch((error: unknown) => {
      logger.error('Unhandled error in the interaction handler', error);
    });
  });
}
