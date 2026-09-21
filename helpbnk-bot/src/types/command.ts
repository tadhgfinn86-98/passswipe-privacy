import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

/**
 * Contract every slash command file exports.
 *
 * Add a new command by creating a file in `src/commands` and listing it in
 * `src/commands/index.ts` — nothing else needs to change.
 */
export interface Command {
  /** Builder output, registered with Discord by `npm run deploy-commands`. */
  toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody;
  /** Command name, used for the interaction lookup at runtime. */
  readonly name: string;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
