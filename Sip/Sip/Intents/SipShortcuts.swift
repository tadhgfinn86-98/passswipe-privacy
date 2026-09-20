import AppIntents

/// Publishes the intents to Spotlight, Siri and — importantly — the Action
/// Button picker, which lists App Shortcuts under the app's name.
struct SipShortcuts: AppShortcutsProvider {

    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AddDrinkIntent(),
            phrases: [
                "Add a drink in \(.applicationName)",
                "Count a drink in \(.applicationName)",
                "\(.applicationName) another one"
            ],
            shortTitle: "Add Drink",
            systemImageName: "plus"
        )
        AppShortcut(
            intent: UndoDrinkIntent(),
            phrases: [
                "Undo a drink in \(.applicationName)",
                "Remove a drink in \(.applicationName)"
            ],
            shortTitle: "Undo Last Drink",
            systemImageName: "arrow.uturn.backward"
        )
        AppShortcut(
            intent: DrinkCountIntent(),
            phrases: [
                "How many drinks in \(.applicationName)",
                "\(.applicationName) count"
            ],
            shortTitle: "Today's Count",
            systemImageName: "number"
        )
    }
}
