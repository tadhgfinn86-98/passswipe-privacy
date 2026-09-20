import SwiftUI

struct RootView: View {

    private enum Tab: Hashable { case today, history, settings }

    @EnvironmentObject private var settings: SipSettings
    @State private var tab: Tab = .today
    @State private var showOnboarding = false

    var body: some View {
        TabView(selection: $tab) {
            TodayView()
                .tabItem { Label("Today", systemImage: "number") }
                .tag(Tab.today)

            HistoryView()
                .tabItem { Label("History", systemImage: "list.bullet") }
                .tag(Tab.history)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(Tab.settings)
        }
        .tint(.sipAccent)
        .preferredColorScheme(settings.theme.colorScheme)
        .onAppear { showOnboarding = !settings.onboardingCompleted }
        .onOpenURL { url in
            // sip://today — the widget's tap target.
            if url.scheme == "sip" { tab = .today }
        }
        .fullScreenCover(isPresented: $showOnboarding) {
            OnboardingView {
                settings.onboardingCompleted = true
                showOnboarding = false
            }
        }
    }
}
