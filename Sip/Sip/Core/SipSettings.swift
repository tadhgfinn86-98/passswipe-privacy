import Foundation
import SwiftUI

enum AppTheme: String, CaseIterable, Identifiable {
    case system, light, dark

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }

    var colorScheme: ColorScheme? {
        switch self {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }
}

/// Small, local, boring. Stored in the shared defaults suite so the widget can
/// read the user's name without touching the store.
final class SipSettings: ObservableObject {

    static let shared = SipSettings()

    private enum Key {
        static let name = "sip.name"
        static let haptics = "sip.hapticsEnabled"
        static let theme = "sip.theme"
        static let onboardingCompleted = "sip.onboardingCompleted"
    }

    private let defaults: UserDefaults

    @Published var name: String {
        didSet { defaults.set(name, forKey: Key.name) }
    }

    @Published var hapticsEnabled: Bool {
        didSet { defaults.set(hapticsEnabled, forKey: Key.haptics) }
    }

    @Published var theme: AppTheme {
        didSet { defaults.set(theme.rawValue, forKey: Key.theme) }
    }

    @Published var onboardingCompleted: Bool {
        didSet { defaults.set(onboardingCompleted, forKey: Key.onboardingCompleted) }
    }

    init(defaults: UserDefaults = SipShared.defaults) {
        self.defaults = defaults
        self.name = defaults.string(forKey: Key.name) ?? ""
        self.hapticsEnabled = defaults.object(forKey: Key.haptics) as? Bool ?? true
        self.theme = AppTheme(rawValue: defaults.string(forKey: Key.theme) ?? "") ?? .system
        self.onboardingCompleted = defaults.bool(forKey: Key.onboardingCompleted)
    }

    /// Uppercased first name for the drink card, with a neutral fallback.
    var cardName: String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "—" : trimmed.uppercased(with: .current)
    }

    func resetEverything() {
        name = ""
        hapticsEnabled = true
        theme = .system
        onboardingCompleted = false
    }
}
