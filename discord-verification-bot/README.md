# Discord Verification Bot

A member-verification gate for Discord servers. New members press one button, prove
they are human, and get a role that unlocks the rest of the server.

## What it does

- **Three verification modes** — a block-art **captcha** code (default), a **maths**
  question, or a plain **one-click** button.
- **Role gating** — grants a verified role, and optionally strips a holding
  "unverified" role that new joiners receive automatically.
- **Account-age gate** — refuses Discord accounts younger than N days, the cheapest
  defence against throwaway alts during a raid.
- **Attempt limits** — a configurable number of wrong answers, then a cooldown.
- **Audit log** — every pass, fail and block can be posted to a mod channel.
- **Survives restarts** — settings live in a JSON file, and the panel's button keeps
  working because it is not tied to a running process.

Everything is ephemeral to the member: the captcha, the result, the error messages.
Nobody has to watch the verification channel fill up with noise.

## Setup

### 1. Create the application

1. Go to the [Developer Portal](https://discord.com/developers/applications) → **New Application**.
2. **Bot** → **Reset Token** → copy the token.
3. On the same page, enable **Server Members Intent** under *Privileged Gateway Intents*.
   The bot cannot read roles or see joins without it.
4. **OAuth2 → URL Generator**: tick `bot` and `applications.commands`, then under bot
   permissions tick **Manage Roles**, **Send Messages** and **Embed Links**. Open the
   generated URL to invite the bot.

### 2. Run it

```bash
npm install
cp .env.example .env     # then fill in DISCORD_TOKEN, CLIENT_ID and (optionally) GUILD_ID
npm run deploy           # register the slash commands
npm start
```

Set `GUILD_ID` while you are testing — guild commands appear instantly, whereas global
ones can take up to an hour. Clear it and re-run `npm run deploy` when you go live.

### 3. Move the bot's role up

In **Server Settings → Roles**, drag the bot's own role **above** the verified role.
Discord will not let a bot assign a role that sits above its own — the bot tells you
this in plain language if you get it wrong, but it is easier to just do it first.

### 4. Configure the server

```
/verification setup channel:#verify role:@Verified mode:Captcha code
```

That posts the panel and stores the role. Then lock the rest of the server down:
deny **View Channel** for `@everyone` on your real channels and allow it for
`@Verified`, leaving `#verify` visible to everyone.

## Commands

All of them require **Manage Server**.

| Command | What it does |
| --- | --- |
| `/verification setup` | Posts the panel and sets the channel, role, mode and (optionally) custom panel text. Re-running it moves the panel and deletes the old one. |
| `/verification config` | Changes individual settings: `mode`, `log-channel`, `unverified-role`, `min-account-age`, `max-attempts`, `cooldown`. |
| `/verification status` | Shows the current configuration, lifetime totals, and a health check that flags a missing role or a bad role hierarchy. |
| `/verification reset` | Clears a member's failed attempts and cooldown. |

## Modes

| Mode | Member experience | Use it when |
| --- | --- | --- |
| `captcha` | Ephemeral card shows a 6-character code as block art; the member types it into a modal. | Default. Stops drive-by self-bots without annoying real people. |
| `math` | A modal opens with a question like "What is 7 x 4?". | You want the lightest possible friction with some proof of a human. |
| `button` | One press, role granted. | The gate exists for the rules screen, not for raid defence. |

The captcha alphabet leaves out `O/0` and `I/1/L`, and answers ignore case and spaces,
so nobody fails on a typo.

## Layout

```
src/
  index.js               Client bootstrap, command/event loading, shutdown
  deploy-commands.js     Registers slash commands (guild or global)
  commands/
    verification.js      /verification setup | config | status | reset
  events/
    ready.js             Presence and a startup log line
    guildMemberAdd.js    Applies the unverified holding role
    interactionCreate.js Buttons, modals and command dispatch
  lib/
    challenge.js         Captcha rendering and maths questions
    sessions.js          In-memory challenges, attempt counts, cooldowns
    store.js             Atomic JSON persistence for per-guild settings
    ui.js                Embeds, buttons and modals
    verification.js      Eligibility gates, role granting, audit logging
test/                    Flow tests that drive the handlers with fake interactions
```

## Tests

```bash
npm test
```

The suite drives `interactionCreate` with stand-in Discord objects, covering each
mode, the attempt lockout, the account-age gate, expired challenges, and the
role-hierarchy failure.

## Notes

- Challenges and cooldowns live in memory, so a restart clears any active lockout.
  Server settings and lifetime totals are on disk in `data/guilds.json`.
- The bot never needs `MESSAGE CONTENT` — it only uses slash commands and components.
- Per-guild settings mean one instance can serve any number of servers.
