import SwiftUI
import SwiftData

@main
struct SipApp: App {

    @StateObject private var settings = SipSettings.shared

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(settings)
        }
        .modelContainer(SipEnvironment.shared.container)
    }
}
