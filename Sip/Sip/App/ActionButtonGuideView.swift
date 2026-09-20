import SwiftUI

/// Plain instructions, no pretending. iOS does not let an app claim the Action
/// Button for itself — it exposes an App Shortcut that the user assigns.
struct ActionButtonGuideView: View {

    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            Color.sipBackground.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 26) {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("ONE BUTTON. ONE DRINK.")
                            .font(.sipLabel(14))
                            .tracking(3)
                            .foregroundStyle(Color.sipPrimary)
                        Text("On iPhone 15 Pro and later you can assign Sip's Add Drink shortcut to the Action Button.")
                            .font(.sipBody())
                            .foregroundStyle(Color.sipSecondary)
                    }

                    VStack(alignment: .leading, spacing: 18) {
                        step(1, "Open Settings on your iPhone.")
                        step(2, "Tap Action Button.")
                        step(3, "Swipe to Shortcut.")
                        step(4, "Tap Choose a Shortcut.")
                        step(5, "Pick Sip, then Add Drink.")
                    }

                    Divider().overlay(Color.sipSecondary.opacity(0.25))

                    VStack(alignment: .leading, spacing: 8) {
                        Text("NO ACTION BUTTON?")
                            .font(.sipLabel(12))
                            .tracking(2.5)
                            .foregroundStyle(Color.sipPrimary)
                        Text("Add Drink also works from the Shortcuts app, Siri (\u{201C}Add a drink in Sip\u{201D}), the Control Centre shortcut control, Spotlight, and the Back Tap accessibility gesture.")
                            .font(.sipBody())
                            .foregroundStyle(Color.sipSecondary)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("WHEN THE PHONE IS LOCKED")
                            .font(.sipLabel(12))
                            .tracking(2.5)
                            .foregroundStyle(Color.sipPrimary)
                        Text("Add Drink runs without unlocking. iOS wakes Sip in the background, counts the drink, and shows its own confirmation. The app never opens.")
                            .font(.sipBody())
                            .foregroundStyle(Color.sipSecondary)
                    }

                    Button {
                        if let url = URL(string: "shortcuts://") { openURL(url) }
                    } label: {
                        Text("OPEN SHORTCUTS")
                            .font(.sipLabel(15))
                            .tracking(2.5)
                            .foregroundStyle(Color.sipBackground)
                            .frame(maxWidth: .infinity)
                            .frame(height: 56)
                            .background(Color.sipPrimary,
                                        in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                    }
                    .padding(.top, 4)
                }
                .padding(.horizontal, 28)
                .padding(.vertical, 24)
            }
        }
        .navigationTitle("Action Button")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text("\(number)")
                .font(.sipNumber(17))
                .monospacedDigit()
                .foregroundStyle(Color.sipAccent)
                .frame(width: 20, alignment: .leading)
            Text(text)
                .font(.sipBody(16))
                .foregroundStyle(Color.sipPrimary)
        }
    }
}
