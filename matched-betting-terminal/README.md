# Matched Betting Terminal

A Bloomberg-terminal-style desktop app for matched betting: calculator, offer
tracker, bet log and bankroll chart. Everything is stored locally on your own
PC — no cloud, no account, no internet connection needed once installed.

![Panels: calculator, offer tracker, bankroll/bet log, settings](docs/screenshot.png)

---

## Part 1 — Install Node.js (one time only)

Node.js is the toolkit that turns this source code into a Windows program. You
only need it to *build* the app; once the app is installed you never need it
again.

1. Go to **https://nodejs.org**
2. Download the big green button labelled **"LTS"** (long-term support). At the
   time of writing that is **Node.js 22 LTS**. Anything 20 LTS or newer works.
   Pick the **Windows Installer (.msi), 64-bit** version.
3. Run the downloaded file and click **Next** through every screen, then
   **Install**. The default options are correct — you do not need to tick
   anything extra.
4. Restart your PC if it asks.

**Check it worked.** Press the `Windows` key, type `powershell`, press Enter,
and in the blue window type:

```
node --version
```

You should see something like `v22.14.0`. If you see an error instead, Node.js
did not install correctly — reinstall it and restart your PC.

---

## Part 2 — Get to the project folder

Every command below is typed into that same PowerShell window.

**Command 1** — move into the app folder (change the path if you saved the
project somewhere else):

```
cd C:\Users\YourName\Downloads\passswipe-privacy\matched-betting-terminal
```

> Tip: open the `matched-betting-terminal` folder in File Explorer, click the
> address bar, copy the path, and paste it after `cd `.

**Command 2** — download the building blocks the app needs. This takes a few
minutes the first time and prints a lot of text. Warnings are normal; only stop
if it says `ERR!` and finishes early.

```
npm install
```

---

## Part 3 — Try it out first (dev mode)

**Command 3** — launch the terminal in development mode:

```
npm run dev
```

The app window opens in a few seconds. This is the real app — try the
calculator, add an offer, log a bet.

To close it: close the app window, then click on the PowerShell window and press
`Ctrl + C`.

> Dev mode is optional. If you just want the installer, skip to Part 4.

---

## Part 4 — Build the Windows installer

**Command 4** — build the app icon and the installer `.exe`:

```
npm run dist
```

This takes 2–5 minutes the first time because it downloads the Windows app
runtime. You will see a lot of scrolling text. When it finishes you'll be back
at a normal prompt.

---

## Part 5 — Install it

**Where the installer is:** inside the project folder, open the new **`release`**
folder. Inside you will find:

```
MatchedBettingTerminal-Setup-1.0.0.exe
```

1. **Double-click** that file.
2. Windows SmartScreen may show a blue "Windows protected your PC" box. This is
   only because the app is not signed with a paid certificate — it is your own
   app, built on your own machine. Click **More info**, then **Run anyway**.
3. Choose **Just for me** if it asks, then click **Install**.
4. Leave **Run Matched Betting Terminal** ticked and click **Finish**.

**What you get:** the installer automatically creates

- a **desktop shortcut** with the amber "MB" terminal icon, and
- a **Start Menu entry** under "Matched Betting Terminal".

---

## Part 6 — Using it from now on

**Double-click the "Matched Betting Terminal" icon on your desktop.** That's it.
No PowerShell, no browser, no commands, ever again. You can also pin it to the
taskbar (right-click the icon → Pin to taskbar).

To uninstall: Windows Settings → Apps → Matched Betting Terminal → Uninstall.
Your saved data is deliberately left behind in case you reinstall.

---

## Command summary

| # | Command | What it does |
|---|---------|--------------|
| 1 | `cd <project folder>` | Moves PowerShell into the app folder |
| 2 | `npm install` | Downloads the building blocks (once) |
| 3 | `npm run dev` | Opens the app in development mode (optional) |
| 4 | `npm run dist` | Builds `release\MatchedBettingTerminal-Setup-1.0.0.exe` |

---

## What the terminal does

**Calculator (F1)** — two modes:

- **Qualifying bet**: back stake, back odds, lay odds, commission → optimal lay
  stake, liability, and the profit/loss on each outcome. A small loss is
  expected and is shown as `QUALIFYING LOSS (LOCKED)`.
- **Free bet (SNR)**: free bet amount, back odds, lay odds, commission →
  optimal lay stake, liability, and the guaranteed profit whichever way the
  event lands, plus your free-bet retention percentage.

Results update as you type, inputs are validated, and **liability** is shown in
its own highlighted row. If the liability is more than your current bankroll a
red warning appears directly beneath it.

Formulas used (commission as a decimal, so 2% = 0.02):

```
Qualifying:  layStake = (backOdds × backStake) / (layOdds − commission)
Free bet:    layStake = ((backOdds − 1) × backStake) / (layOdds − commission)
liability    = layStake × (layOdds − 1)
```

**Offer tracker (F2)** — bookmaker, description, type, requirement, deadline,
expected profit, status and notes. Add, edit and delete rows; click any column
header to sort; click a status badge to advance it (amber `TO DO` → cyan
`IN PROGRESS` → green `DONE`). Deadlines inside 7 days turn amber, overdue ones
turn red.

**Bankroll / bet log (F3)** — log each completed bet with date, bookmaker,
event, stake, profit/loss and the offer it belongs to. The running bankroll and
profit update automatically and are plotted on a chart against your starting
bankroll.

**Position / settings / data (F4)** — starting bankroll (defaults to £50),
currency symbol, commission preset, plus **Export JSON** / **Import JSON**
backup buttons and a **Show file** button that opens the save file in Explorer.

### Keyboard shortcuts

Press `?` inside the app for the full key map.

| Key | Action |
|-----|--------|
| `F1` … `F4` | Jump to calculator / offers / bet log / settings |
| `Ctrl + M` | Swap between qualifying and free bet mode |
| `Ctrl + O` | Add a new offer |
| `Ctrl + E` / `Ctrl + I` | Export / import a JSON backup |
| `Esc` | Cancel the form you are editing |
| `?` | Show the key map |

---

## Where your data lives

```
C:\Users\<you>\AppData\Roaming\Matched Betting Terminal\terminal-data.json
```

One plain JSON file, saved automatically as you type. Use **Export JSON** to
make a backup copy somewhere safe, and **Import JSON** to restore it (importing
replaces everything currently in the terminal and asks you to confirm first).

---

## If something goes wrong

**`npm` is not recognised** — Node.js is not installed, or you did not restart
PowerShell after installing it. Close PowerShell, open it again, and retry.

**`npm install` fails** — check you are connected to the internet, and that you
ran `cd` into the `matched-betting-terminal` folder (the one containing
`package.json`), not the folder above it.

**`npm run dist` fails** — run `npm install` again first. If it still fails,
delete the `node_modules` folder and the `release` folder, then run
`npm install` followed by `npm run dist`.

**The app window is blank** — close it and run `npm run dist` again; the build
step may have been interrupted.

---

For managing legitimate matched betting offers only. 18+. Gamble responsibly —
[BeGambleAware.org](https://www.begambleaware.org).
