import AppIntents
import SwiftUI
import WidgetKit

/// The product, in one struct.
///
/// Assigned to the Action Button (Settings › Action Button › Shortcut › Sip ›
/// Add Drink) this runs without ever showing Sip's UI: iOS launches the app in
/// the background, `perform()` writes one row, and the system shows its own
/// confirmation banner.
struct AddDrinkIntent: AppIntent {

    static var title: LocalizedStringResource = "Add Drink"

    static var description = IntentDescription(
        "Counts one drink. Assign it to the Action Button to count without opening Sip.",
        categoryName: "Counting"
    )

    /// The whole point — never take over the screen.
    static var openAppWhenRun: Bool = false

    /// Runs on a locked device: no passcode or Face ID prompt in the way.
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let store = SipEnvironment.shared.store
        let drink = try store.addDrink()
        let total = try store.count(forDay: drink.dayKey)

        Haptics.drinkAdded()
        WidgetCenter.shared.reloadAllTimelines()

        return .result(
            dialog: IntentDialog("Drink #\(total)"),
            view: DrinkCountSnippet(count: total, time: drink.timestamp, title: "DRINK")
        )
    }
}

/// Removes the most recent drink — the Shortcuts-side twin of the Undo button.
struct UndoDrinkIntent: AppIntent {

    static var title: LocalizedStringResource = "Undo Last Drink"

    static var description = IntentDescription(
        "Removes the most recently counted drink.",
        categoryName: "Counting"
    )

    static var openAppWhenRun: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog & ShowsSnippetView {
        let store = SipEnvironment.shared.store
        let removed = try store.undoLastDrink()
        let total = try store.countToday()

        Haptics.undone()
        WidgetCenter.shared.reloadAllTimelines()

        let dialog: IntentDialog = removed == nil
            ? IntentDialog("Nothing to undo")
            : IntentDialog("Back to \(total)")

        return .result(
            dialog: dialog,
            view: DrinkCountSnippet(count: total, time: nil, title: "DRINKS")
        )
    }
}

/// Lets Shortcuts and Siri read the count back without opening the app.
struct DrinkCountIntent: AppIntent {

    static var title: LocalizedStringResource = "Get Today's Drink Count"

    static var description = IntentDescription(
        "Returns how many drinks have been counted today.",
        categoryName: "Counting"
    )

    static var openAppWhenRun: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed

    @MainActor
    func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog & ShowsSnippetView {
        let total = try SipEnvironment.shared.store.countToday()
        return .result(
            value: total,
            dialog: IntentDialog("\(total) so far today"),
            view: DrinkCountSnippet(count: total, time: nil, title: "DRINKS")
        )
    }
}
