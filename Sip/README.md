# Sip

**One button. One drink. That's it.**

Sip counts your drinks without you opening an app. Assign it to your iPhone's
Action Button, press it when you get a drink, and carry on with your night. The
app itself is the receipt.

```
PHONE LOCKED  →  PRESS ACTION BUTTON  →  DRINK COUNT +1  →  DONE
```

Everything stays on the phone. No account, no server, no analytics.

---

## Requirements

| | |
|---|---|
| Xcode | 16 or later |
| iOS | 17.0 or later |
| Devices | iPhone (portrait). Action Button needs iPhone 15 Pro or later |
| Dependencies | none — SwiftUI, SwiftData, App Intents, WidgetKit |

## Open and run

```sh
open Sip/Sip.xcodeproj
```

Select the **Sip** scheme, pick a simulator or your iPhone, and run. In
*Signing & Capabilities* set your own team; the bundle identifier
`com.tadhgfinn.sip` is a placeholder, change it to something you own.

No entitlements are required, so it builds and runs on a free personal team.

## Setting up the Action Button

On the iPhone, after installing Sip once:

1. **Settings**
2. **Action Button**
3. Swipe to **Shortcut**
4. **Choose a Shortcut**
5. Pick **Sip → Add Drink**

That's it. The same instructions are in the app under
*Settings → Action Button setup*.

### What actually happens when you press it

iOS runs `AddDrinkIntent` in Sip's background process. The intent writes one row
to the local store and returns; iOS shows its own confirmation banner with the
new count. **Sip's UI never opens.**

The intent declares:

```swift
static var openAppWhenRun: Bool = false
static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
```

`alwaysAllowed` is what lets it run on a locked phone without a Face ID or
passcode prompt.

### Platform limits, stated plainly

* **An app cannot claim the Action Button.** There is no API for it — not for
  Sip, not for anything on the App Store. iOS only lets an app publish an App
  Shortcut that the *user* assigns in Settings. Sip uses that supported path,
  and nothing else. Any app that claims otherwise is describing the same
  mechanism in different words.
* **The first press after a reboot is slower.** iOS has to cold-launch Sip's
  process before the intent runs. Subsequent presses are immediate.
* **Haptics on a locked phone come from iOS, not from Sip.** A background
  process can't reliably drive the Taptic Engine, so `UIImpactFeedbackGenerator`
  is best-effort there. The system's own Action Button feedback fires either
  way. In-app taps get Sip's haptics properly.
* **Sip must be installed and launched once** before its shortcut appears in the
  Action Button picker. That's how App Shortcuts are indexed.

### Other ways to count a drink

Add Drink is a normal App Shortcut, so it also works from the Shortcuts app,
Siri ("Add a drink in Sip"), Spotlight, a Control Centre control, and the Back
Tap accessibility gesture. `Undo Last Drink` and `Get Today's Drink Count` are
exposed the same way.

---

## The app

Three screens.

**Today** — the day, one enormous number, `+ ADD DRINK`, the time of your last
drink, and a line reminding you that you don't need to be here. Touch and hold
the button for undo and reset. An *Undo* link appears for six seconds after each
drink.

**History** — every previous day with its total. Tap one for the timeline
(`#23  23:41`). Swipe to delete a single drink.

**Settings** — your name, Action Button setup, haptics, theme, export, delete,
privacy.

**Drink card** — the small card icon on Today opens a shareable card, a modern
take on the paper one you get handed at the door:

```
MY NAME IS
TADHG
AND THIS IS
DRINK #23
```

### Day boundaries

A day is the **local calendar date** of the drink's timestamp, so the count
resets at local midnight and yesterday is kept forever. If you'd rather a night
out ran until 4am, `DayKey.key(for:calendar:)` is the single place to change it.

---

## Enabling the widget (optional)

The Lock Screen and Home Screen widgets read the count from an App Group, which
needs a paid developer team. Sip works fine without it — the widget just shows
`—` instead of a wrong `0`.

To turn it on:

1. Select the **Sip** target → *Signing & Capabilities* → **+ Capability** →
   **App Groups** → add `group.com.tadhgfinn.sip`.
2. Do the same for the **SipWidgetExtension** target.
3. If you changed the bundle identifier, update `SipShared.appGroupIdentifier`
   in `Sip/Core/SipShared.swift` to match.

`SipShared.storeURL` falls back to the app's own Application Support directory
whenever the group isn't available, so nothing breaks either way.

The widget only ever **reads**. The app process is the single writer, which
keeps two SwiftData stacks from fighting over one file and means `@Query` views
update the moment an intent runs.

---

## Project layout

```
Sip/
├── Sip.xcodeproj
├── Sip/
│   ├── Core/            shared with the widget target
│   │   ├── DayKey.swift          local-calendar day keys
│   │   ├── Drink.swift           the @Model
│   │   ├── DrinkStore.swift      every read and write
│   │   ├── SipShared.swift       store location, App Group fallback
│   │   ├── SipSettings.swift     name, haptics, theme
│   │   ├── SipEnvironment.swift  the one SwiftData stack
│   │   └── Haptics.swift
│   ├── Intents/
│   │   ├── AddDrinkIntent.swift  ← the product
│   │   ├── DrinkCountSnippet.swift
│   │   └── SipShortcuts.swift    AppShortcutsProvider
│   ├── App/             SwiftUI screens
│   └── Assets.xcassets
├── SipWidget/           display-only widget
├── SipTests/
└── Tools/               project generator + checks
```

### Data model

```swift
@Model final class Drink {
    var id: UUID
    var timestamp: Date   // exact moment
    var dayKey: String    // "2026-09-20", local calendar date
    var drinkNumber: Int  // 1-based within the day
}
```

Settings live in `UserDefaults` (the shared suite when available).

---

## Tests

```sh
xcodebuild test -project Sip/Sip.xcodeproj -scheme Sip \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro'
```

`SipTests` covers adding one drink, adding many, undo, undo-then-add renumbering,
drink numbering, midnight rollover, historical days, persistence across a store
reopen, empty history, deleting a day, deleting everything, CSV export, and
`AddDrinkIntent` / `UndoDrinkIntent` / `DrinkCountIntent` execution — including
that all three have `openAppWhenRun == false`.

The intent tests drive the same `perform()` the Action Button calls, against an
in-memory stack (`SipEnvironment.useInMemoryStoreForTesting()`).

**The one thing a unit test can't do** is press a physical Action Button on a
locked phone. Check that by hand once:

1. Install and launch Sip, assign the shortcut (above).
2. Lock the phone.
3. Press the Action Button five times.
4. Unlock, open Sip — the count is up by five, with five timestamps.
5. Force-quit Sip, press the button again, reopen — still counting.

## Regenerating the project

`Sip.xcodeproj/project.pbxproj` is generated, so adding a file means editing one
list instead of fighting a merge conflict:

```sh
python3 Tools/generate_project.py   # rewrite project.pbxproj + shared scheme
python3 Tools/verify_project.py     # parse it back, check every reference
python3 Tools/check_sources.py      # brackets + per-target type availability
python3 Tools/make_icon.py          # redraw the app icon
```

`Tools/verify_project.py` parses the project with its own OpenStep reader rather
than importing the generator, so a bug in one shows up in the other.

## Privacy

Your drink count stays on your iPhone. Sip doesn't require an account, doesn't
talk to a server, and contains no analytics or tracking. Export gives you the
whole database as CSV or JSON; delete removes it.

Sip sends no notifications — there's nothing to remind you about.
