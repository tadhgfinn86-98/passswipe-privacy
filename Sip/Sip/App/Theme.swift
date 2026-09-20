import SwiftUI

/// Near-black, off-white, one restrained warm accent. Defined in the asset
/// catalogue so Light / Dark / System all resolve automatically.
extension Color {
    static let sipBackground = Color("Background")
    static let sipSurface = Color("Surface")
    static let sipPrimary = Color("PrimaryText")
    static let sipSecondary = Color("SecondaryText")
    static let sipAccent = Color("AccentColor")
}

extension Font {
    /// The tally itself.
    static func sipNumber(_ size: CGFloat) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }

    /// Small all-caps labels with tracking applied at the call site.
    static func sipLabel(_ size: CGFloat = 13) -> Font {
        .system(size: size, weight: .semibold, design: .rounded)
    }

    static func sipBody(_ size: CGFloat = 15) -> Font {
        .system(size: size, weight: .regular, design: .rounded)
    }
}
