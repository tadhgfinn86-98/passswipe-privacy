# HelpBnk Welcome Bot

A welcome bot for **HelpBnk** — the community where entrepreneurs, creators and builders
connect, share ideas and help each other.

Someone joins → the bot gives them the `@Member` role → posts a branded welcome →
points them at the channels that matter.

Everything is configured from inside Discord with `/setup`. You never edit code to change
a channel.

---

## Requirements

- **Node.js 20 or newer** (`node --version` to check)
- A Discord account with **Manage Server** permission on your server
- A free application in the [Discord Developer Portal](https://discord.com/developers/applications)

---

## Quick start

```bash
npm install
cp .env.example .env     # then fill in the three values
npm run deploy-commands  # registers /setup, /config, /testwelcome
npm run dev              # starts the bot
```

Then in Discord: run `/setup welcome-channel`, `/setup member-role`, and the rest, and
finish with `/testwelcome`.

---

## 1. Create the Discord application

1. Go to <https://discord.com/developers/applications> and click **New Application**.
   Name it `HelpBnk Bot`.
2. Open **General Information** and copy the **Application ID** — this is your `CLIENT_ID`.
3. Open the **Bot** tab. (On newer applications the bot user already exists; if there is an
   **Add Bot** button, click it.)
4. Click **Reset Token**, then **Copy**. This is your `DISCORD_TOKEN`.
   You only see it once — if you lose it, reset it again.
   **Never commit this token or paste it anywhere public.**

### Enable the required intents

Still on the **Bot** tab, scroll to **Privileged Gateway Intents** and turn on:

| Intent | Needed for |
| --- | --- |
| **SERVER MEMBERS INTENT** | Detecting when members join and leave. **Required.** |
| Presence Intent | Not needed — leave it off. |
| Message Content Intent | Not needed — leave it off. |

Click **Save Changes**. Without the Server Members Intent the bot logs in but never sees
anyone join, and `client.login` fails with a `disallowed intents` error.

The bot uses exactly two gateway intents in code: `Guilds` and `GuildMembers`.

---

## 2. Invite the bot to your server

Go to **OAuth2 → URL Generator** and tick:

**Scopes**
- `bot`
- `applications.commands`

**Bot permissions** (the minimum this bot needs — do **not** grant Administrator)
- View Channels
- Send Messages
- Embed Links
- Manage Roles

Copy the generated URL at the bottom, open it, pick your server and authorise.

Or build the URL yourself — replace `YOUR_CLIENT_ID`:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268454912&scope=bot%20applications.commands
```

`268454912` is exactly View Channels + Send Messages + Embed Links + Manage Roles.

### One thing people always miss: role position

Discord will not let a bot assign a role that sits **above** its own role.

After inviting, go to **Server Settings → Roles** and drag the bot's role (`HelpBnk Bot`)
**above** your `@Member` role. `/setup member-role` warns you if you forget.

---

## 3. Configure the environment

Copy the example file and fill it in:

```bash
cp .env.example .env
```

```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_application_id
GUILD_ID=your_server_id
```

- `DISCORD_TOKEN` — Developer Portal → Bot → Reset Token
- `CLIENT_ID` — Developer Portal → General Information → Application ID
- `GUILD_ID` — in Discord, enable **User Settings → Advanced → Developer Mode**, then
  right-click your server icon → **Copy Server ID**

`GUILD_ID` is optional but strongly recommended: with it, slash commands register in your
server **instantly**. Without it they register globally and can take up to an hour to show up.

`.env` is already in `.gitignore`. Secrets are never hard-coded — the bot validates all
three values at startup and tells you exactly which one is wrong.

---

## 4. Install and run

```bash
npm install
```

Register the slash commands (run this once, and again whenever a command changes):

```bash
npm run deploy-commands
```

Development — restarts on every file change:

```bash
npm run dev
```

Production:

```bash
npm run build
npm start
```

All scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Run from TypeScript with hot reload (tsx) |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm start` | Run the compiled bot |
| `npm run deploy-commands` | Register slash commands with Discord |
| `npm run typecheck` | Type-check without emitting |
| `npm run lint` / `npm run lint:fix` | ESLint |
| `npm run format` / `npm run format:check` | Prettier |

---

## 5. Set it up in Discord

The bot starts fine with no configuration — it logs what is missing and waits.
All commands are **Administrator only**.

```
/setup welcome-channel        #welcome
/setup member-role            @Member
/setup rules-channel          #rules
/setup introductions-channel  #introductions
/setup general-channel        #general
/setup log-channel            #logs      (optional — goodbyes go here)
/setup goodbye                true/false (optional)
/setup welcome-messages       true/false (optional master switch)
```

Every `/setup` reply is private and tells you what is still left to configure, so you can
just work down the list.

Then:

```
/config        Show the current configuration
/testwelcome   Post a test welcome in the welcome channel (never assigns a role)
```

Configuration is stored in `data/config.json`, keyed by server id. The folder is created
automatically on first run and is git-ignored, so your channel ids never end up in a
commit. If the file is ever corrupted, the bot moves it aside and carries on with defaults
rather than crashing.

---

## What a member sees

**Message**

> Welcome to HelpBnk, @newmember! 🚀

**Embed**

> **Welcome to HelpBnk 🚀**
>
> **newmember** just joined — you're member **#1337**.
> A community for entrepreneurs, creators and builders.
>
> **Start here**
> 📜 Read the rules → #rules
> 💬 Introduce yourself → #introductions
> 🤝 Meet the community → #general
>
> Glad to have you here. Build something great.
>
> *HelpBnk • Build. Connect. Grow.*

Channels are real Discord mentions (`<#id>`), so they stay correct even if you rename a
channel. Any channel you haven't configured is simply left out of the list.

When someone leaves (if goodbye messages are on):

> 👋 **newmember** has left HelpBnk.
> We had 1337 members before they left.

---

## Project structure

```
helpbnk-bot/
├── src/
│   ├── commands/
│   │   ├── setup.ts           /setup — configure everything from Discord
│   │   ├── config.ts          /config — show the current configuration
│   │   ├── testwelcome.ts     /testwelcome — preview the welcome message
│   │   └── index.ts           command registry (add new commands here)
│   ├── events/
│   │   ├── ready.ts           startup logging and presence
│   │   ├── guildMemberAdd.ts  role assignment + welcome message
│   │   ├── guildMemberRemove.ts goodbye message
│   │   ├── interactionCreate.ts slash command routing
│   │   └── index.ts           event registry (add new events here)
│   ├── utils/
│   │   ├── config.ts          data/config.json loading and atomic saving
│   │   ├── embeds.ts          all branding and copy
│   │   ├── logger.ts          [INFO] / [WARN] / [ERROR] logging
│   │   ├── permissions.ts     permission and role-hierarchy checks
│   │   └── env.ts             environment variable validation
│   ├── types/
│   │   ├── config.ts          BotConfig
│   │   └── command.ts         Command contract
│   ├── deploy-commands.ts     slash command registration
│   └── index.ts               entry point
├── data/                      created at runtime, git-ignored
├── .env.example
├── eslint.config.js
├── tsconfig.json
└── package.json
```

### Adding a feature later

The architecture is deliberately boring so it is easy to extend:

- **New slash command** → add a file in `src/commands/`, export a `Command`, add one line
  to `src/commands/index.ts`, run `npm run deploy-commands`.
- **New Discord event** (verification, reaction roles, moderation, XP, tickets, analytics)
  → add a file in `src/events/` exporting `register(client)`, add one line to
  `src/events/index.ts`.
- **New setting** → add the field to `BotConfig` in `src/types/config.ts` (it is normalised
  with a default automatically), add a `/setup` subcommand, show it in `/config`.
- **New branding or copy** → everything lives in `src/utils/embeds.ts`.

Nothing else reads the raw config file, so swapping `data/config.json` for a real database
later means rewriting one module.

---

## How it handles things going wrong

The bot is built so a Discord permission problem is a log line, never a crash.

| Situation | What happens |
| --- | --- |
| No configuration at all | Boots, logs what to configure, waits for `/setup` |
| Member role not configured | Member is still welcomed; `[WARN] Member role is not configured` |
| Bot missing Manage Roles | `[ERROR] Unable to assign member role: …missing the Manage Roles permission`; welcome still sent |
| Member role above the bot's role | Clear error naming the fix; welcome still sent |
| Welcome channel deleted | `[WARN] No welcome message sent — channel … no longer exists` |
| Missing Send Messages / Embed Links | Logged by name, nothing crashes |
| Member leaves mid-join | Treated as a skip, not an error |
| Invalid token / missing intent | One clear line telling you what to fix in the portal |
| Rate limits | discord.js queues and retries; the wait is logged |
| Corrupt `data/config.json` | Moved aside, bot continues with defaults |
| Any unhandled rejection | Logged, process stays alive |

Set `LOG_LEVEL=debug` in `.env` for extra detail while troubleshooting.

---

## Troubleshooting

**Slash commands don't appear** — run `npm run deploy-commands`. Check `GUILD_ID` is set
(global commands take up to an hour). Make sure the bot was invited with the
`applications.commands` scope.

**Bot is online but says nothing when someone joins** — the Server Members Intent is off,
or no welcome channel is set. Run `/config`.

**"Unable to assign member role"** — drag the bot's role above `@Member` in
Server Settings → Roles, and confirm the bot has Manage Roles.

**"An invalid token was provided"** — reset the token in the Developer Portal and update
`.env`. The token is not the Application ID or the client secret.
