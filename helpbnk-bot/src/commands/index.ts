import type { Command } from '../types/command';
import { configCommand } from './config';
import { setupCommand } from './setup';
import { testWelcomeCommand } from './testwelcome';

/** Add a new command here and it is registered and routed automatically. */
export const commands: readonly Command[] = [setupCommand, configCommand, testWelcomeCommand];

export const commandsByName = new Map<string, Command>(
  commands.map((command) => [command.name, command]),
);
