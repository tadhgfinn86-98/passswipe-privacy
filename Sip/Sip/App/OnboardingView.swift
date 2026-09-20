import SwiftUI

/// One screen. Name, a word about the Action Button, done.
struct OnboardingView: View {

    let onFinish: () -> Void

    @EnvironmentObject private var settings: SipSettings
    @State private var name: String = ""
    @State private var showGuide = false
    @FocusState private var nameFocused: Bool

    var body: some View {
        ZStack {
            Color.sipBackground.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                Spacer(minLength: 24)

                Text("SIP")
                    .font(.sipNumber(64))
                    .tracking(8)
                    .foregroundStyle(Color.sipPrimary)

                Text("Count your drinks\nwithout opening the app.")
                    .font(.sipBody(17))
                    .foregroundStyle(Color.sipSecondary)
                    .padding(.top, 10)

                Spacer(minLength: 32)

                Text("WHAT'S YOUR NAME?")
                    .font(.sipLabel(12))
                    .tracking(3)
                    .foregroundStyle(Color.sipSecondary)

                TextField("", text: $name, prompt: Text("First name").foregroundStyle(Color.sipSecondary.opacity(0.6)))
                    .font(.sipNumber(28))
                    .foregroundStyle(Color.sipPrimary)
                    .textInputAutocapitalization(.words)
                    .autocorrectionDisabled()
                    .submitLabel(.done)
                    .focused($nameFocused)
                    .padding(.vertical, 12)
                    .overlay(alignment: .bottom) {
                        Rectangle()
                            .fill(Color.sipSecondary.opacity(0.35))
                            .frame(height: 1)
                    }
                    .padding(.top, 8)

                Text("Only used on your drink card. It stays on this iPhone.")
                    .font(.sipBody(13))
                    .foregroundStyle(Color.sipSecondary.opacity(0.8))
                    .padding(.top, 10)

                Spacer(minLength: 24)

                Button {
                    showGuide = true
                } label: {
                    Text("SET UP ACTION BUTTON")
                        .font(.sipLabel(14))
                        .tracking(2.5)
                        .foregroundStyle(Color.sipPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: 56)
                        .overlay(
                            RoundedRectangle(cornerRadius: 20, style: .continuous)
                                .strokeBorder(Color.sipSecondary.opacity(0.5), lineWidth: 1)
                        )
                }

                Button(action: finish) {
                    Text("CONTINUE")
                        .font(.sipLabel(15))
                        .tracking(2.5)
                        .foregroundStyle(Color.sipBackground)
                        .frame(maxWidth: .infinity)
                        .frame(height: 60)
                        .background(Color.sipPrimary,
                                    in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                }
                .padding(.top, 12)
                .padding(.bottom, 16)
            }
            .padding(.horizontal, 28)
        }
        .sheet(isPresented: $showGuide) {
            NavigationStack { ActionButtonGuideView() }
        }
        .onAppear { name = settings.name }
    }

    private func finish() {
        settings.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        nameFocused = false
        onFinish()
    }
}
