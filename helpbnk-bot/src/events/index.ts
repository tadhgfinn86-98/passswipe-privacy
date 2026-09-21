import type { Client } from 'discord.js';
import * as guildMemberAdd from './guildMemberAdd';
import * as guildMemberRemove from './guildMemberRemove';
import * as interactionCreate from './interactionCreate';
import * as ready from './ready';

export type EventRegistrar = (client: Client) => void;

/** Add a new event file here and it is wired up on the next start. */
export const eventRegistrars: readonly EventRegistrar[] = [
  ready.register,
  interactionCreate.register,
  guildMemberAdd.register,
  guildMemberRemove.register,
];
