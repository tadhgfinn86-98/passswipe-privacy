import SwiftUI
import SwiftData
import WidgetKit

struct SettingsView: View {

    @EnvironmentObject private var settings: SipSettings
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Drink.timestamp, order: .reverse) private var allDrinks: [Drink]

    @State private var exportURLs: (csv: URL, json: URL)?
    @State private var confirmDelete = false

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "1.0"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
        return "\(version) (\(build))"
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sipBackground.ignoresSafeArea()

                Form {
                    Section("Name") {
                        TextField("First name", text: $settings.name)
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                        Text("Used on your drink card.")
                            .font(.sipBody(13))
                            .foregroundStyle(Color.sipSecondary)
                    }
                    .listRowBackground(Color.sipSurface)

                    Section("Counting") {
                        NavigationLink {
                            ActionButtonGuideView()
                        } label: {
                            Label("Action Button setup", systemImage: "hand.tap")
                        }
                        Toggle(isOn: $settings.hapticsEnabled) {
                            Label("Haptics", systemImage: "iphone.radiowaves.left.and.right")
                        }
                    }
                    .listRowBackground(Color.sipSurface)

                    Section {
                        Picker(selection: $settings.theme) {
                            ForEach(AppTheme.allCases) { theme in
                                Text(theme.label).tag(theme)
                            }
                        } label: {
                            Label("Theme", systemImage: "circle.lefthalf.filled")
                        }
                        .pickerStyle(.menu)
                    } header: {
                        Text("Appearance")
                    }
                    .listRowBackground(Color.sipSurface)

                    Section {
                        HStack {
                            Label("Notifications", systemImage: "bell.slash")
                            Spacer()
                            Text("Off").foregroundStyle(Color.sipSecondary)
                        }
                        Text("Sip doesn't send notifications. It has nothing to remind you about.")
                            .font(.sipBody(13))
                            .foregroundStyle(Color.sipSecondary)
                    } header: {
                        Text("Notifications")
                    }
                    .listRowBackground(Color.sipSurface)

                    Section {
                        if let exportURLs {
                            ShareLink(item: exportURLs.csv) {
                                Label("Export as CSV", systemImage: "square.and.arrow.up")
                            }
                            ShareLink(item: exportURLs.json) {
                                Label("Export as JSON", systemImage: "curlybraces")
                            }
                        } else {
                            Label("Nothing to export yet", systemImage: "square.and.arrow.up")
                                .foregroundStyle(Color.sipSecondary)
                        }

                        Button(role: .destructive) {
                            confirmDelete = true
                        } label: {
                            Label("Delete all data", systemImage: "trash")
                        }
                    } header: {
                        Text("Data")
                    } footer: {
                        Text("\(allDrinks.count) drinks stored on this iPhone.")
                    }
                    .listRowBackground(Color.sipSurface)

                    Section("Privacy") {
                        Text("Your drink count stays on your iPhone.\nSip doesn't require an account.")
                            .font(.sipBody(15))
                            .foregroundStyle(Color.sipPrimary)
                        Text("No analytics, no tracking, no servers.")
                            .font(.sipBody(13))
                            .foregroundStyle(Color.sipSecondary)
                    }
                    .listRowBackground(Color.sipSurface)

                    Section {
                        HStack {
                            Text("Version")
                            Spacer()
                            Text(appVersion).foregroundStyle(Color.sipSecondary)
                        }
                        Text("One button. One drink. That's it.")
                            .font(.sipBody(13))
                            .foregroundStyle(Color.sipSecondary)
                    } header: {
                        Text("About")
                    }
                    .listRowBackground(Color.sipSurface)
                }
                .scrollContentBackground(.hidden)
                .tint(.sipAccent)
            }
            .navigationTitle("Settings")
            .alert("Delete all data?", isPresented: $confirmDelete) {
                Button("Cancel", role: .cancel) { }
                Button("Delete", role: .destructive) { deleteAll() }
            } message: {
                Text("Every drink and every day is removed from this iPhone. This can't be undone.")
            }
            .onChange(of: allDrinks.count, initial: true) { _, _ in refreshExport() }
        }
    }

    private func refreshExport() {
        guard !allDrinks.isEmpty else {
            exportURLs = nil
            return
        }
        exportURLs = try? DataExport.writeFiles(for: allDrinks)
    }

    private func deleteAll() {
        try? DrinkStore(context: modelContext).deleteAll()
        exportURLs = nil
        Haptics.warning(enabled: settings.hapticsEnabled)
        WidgetCenter.shared.reloadAllTimelines()
    }
}
