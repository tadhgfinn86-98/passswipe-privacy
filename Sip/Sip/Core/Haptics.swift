import Foundation
#if canImport(UIKit)
import UIKit
#endif

/// Restrained, physical feedback. Silent when the user turns haptics off, and a
/// no-op anywhere the generators are unavailable.
enum Haptics {

    static func drinkAdded(enabled: Bool = SipSettings.shared.hapticsEnabled) {
        #if canImport(UIKit) && !os(watchOS)
        guard enabled else { return }
        let generator = UIImpactFeedbackGenerator(style: .soft)
        generator.prepare()
        generator.impactOccurred(intensity: 0.9)
        #endif
    }

    static func undone(enabled: Bool = SipSettings.shared.hapticsEnabled) {
        #if canImport(UIKit) && !os(watchOS)
        guard enabled else { return }
        UIImpactFeedbackGenerator(style: .rigid).impactOccurred(intensity: 0.6)
        #endif
    }

    static func warning(enabled: Bool = SipSettings.shared.hapticsEnabled) {
        #if canImport(UIKit) && !os(watchOS)
        guard enabled else { return }
        UINotificationFeedbackGenerator().notificationOccurred(.warning)
        #endif
    }
}
