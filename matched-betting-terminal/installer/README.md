# Prebuilt Windows installer

`MatchedBettingTerminal-Setup-1.0.0.exe` — ready to run. Nothing to build, no
Node.js needed.

**Windows 10/11, 64-bit. 79 MB.**

SHA-256:

```
9a41c12827f3f3be04f744f2dc84098b7ccc69015d83b200b5bc6540f435de9b
```

## How to install

1. On the GitHub page for this file, click the **Download** button (top right of
   the file view). Your browser saves it to your **Downloads** folder.
2. **Double-click** the downloaded `MatchedBettingTerminal-Setup-1.0.0.exe`.
3. Windows SmartScreen shows a blue **"Windows protected your PC"** box. This
   appears because the app is not signed with a paid code-signing certificate —
   it is not a sign that anything is wrong. Click **More info**, then
   **Run anyway**.
4. Click **Install**, then **Finish**.

You now have a **Matched Betting Terminal** icon on your desktop and an entry in
the Start Menu. Double-click the desktop icon to use the app from now on — no
terminal, no browser, no commands.

To uninstall: Windows Settings → Apps → Matched Betting Terminal → Uninstall.
Your saved data is left in place in case you reinstall.

## Rebuilding this file

This installer was produced by `npm run dist` from the source in the folder
above. See the main [README](../README.md) if you want to change the app and
build your own.
