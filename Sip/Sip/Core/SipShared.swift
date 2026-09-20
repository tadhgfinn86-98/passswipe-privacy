import Foundation

/// Where Sip keeps its data, and whether the widget can reach it.
///
/// The App Group capability is *optional*: enable it on both targets and the
/// Lock Screen / Home Screen widget reads the live count. Leave it off and the
/// app still works perfectly — it just falls back to its own sandbox, which the
/// widget process cannot read. See README, "Enabling the widget".
enum SipShared {

    static let appGroupIdentifier = "group.com.tadhgfinn.sip"

    static let storeFilename = "Sip.store"

    static var sharedContainerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
    }

    /// True when the App Group capability is configured on this target.
    static var isSharedContainerAvailable: Bool { sharedContainerURL != nil }

    static var storeURL: URL {
        if let shared = sharedContainerURL {
            return shared.appendingPathComponent(storeFilename)
        }
        return localFallbackURL
    }

    static var localFallbackURL: URL {
        let fileManager = FileManager.default
        let directory = (try? fileManager.url(for: .applicationSupportDirectory,
                                              in: .userDomainMask,
                                              appropriateFor: nil,
                                              create: true))
            ?? URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)
        return directory.appendingPathComponent(storeFilename)
    }

    /// Settings live alongside the store so the widget can read the user's name.
    static var defaults: UserDefaults {
        UserDefaults(suiteName: appGroupIdentifier) ?? .standard
    }
}
