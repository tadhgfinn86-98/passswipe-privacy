import SwiftUI

/// The small confirmation card iOS shows after an Action Button press or a
/// Shortcuts run. Same restraint as the Today screen: one number, one word.
struct DrinkCountSnippet: View {

    let count: Int
    let time: Date?
    let title: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text("\(count)")
                .font(.system(size: 64, weight: .semibold, design: .rounded))
                .monospacedDigit()

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .tracking(2)
                if let time {
                    Text(DayKey.timeLabel(for: time))
                        .font(.system(size: 13, weight: .regular, design: .rounded))
                        .foregroundStyle(.secondary)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(.vertical, 8)
    }
}
