import WidgetKit
import SwiftUI
import SwiftData

struct DrinkEntry: TimelineEntry {
    let date: Date
    let count: Int
    let lastDrink: Date?
    /// False when the App Group isn't configured, so the widget can say so
    /// instead of confidently showing a wrong zero. See README.
    let isReadable: Bool
}

struct SipProvider: TimelineProvider {

    func placeholder(in context: Context) -> DrinkEntry {
        DrinkEntry(date: Date(), count: 7, lastDrink: Date(), isReadable: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (DrinkEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : readEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DrinkEntry>) -> Void) {
        let entry = readEntry()
        // Wake just after local midnight so the count visibly resets.
        let nextMidnight = Calendar.current.nextDate(
            after: Date(),
            matching: DateComponents(hour: 0, minute: 0, second: 10),
            matchingPolicy: .nextTime
        ) ?? Date().addingTimeInterval(3600)
        completion(Timeline(entries: [entry], policy: .after(nextMidnight)))
    }

    /// The widget only ever reads. The app process is the single writer, which
    /// keeps the two SwiftData stacks from fighting over the same file.
    private func readEntry() -> DrinkEntry {
        guard SipShared.isSharedContainerAvailable else {
            return DrinkEntry(date: Date(), count: 0, lastDrink: nil, isReadable: false)
        }
        do {
            let schema = Schema([Drink.self])
            let configuration = ModelConfiguration(schema: schema, url: SipShared.storeURL)
            let container = try ModelContainer(for: schema, configurations: configuration)
            let store = DrinkStore(context: ModelContext(container))
            let key = DayKey.today()
            return DrinkEntry(date: Date(),
                              count: try store.count(forDay: key),
                              lastDrink: try store.lastDrink(forDay: key)?.timestamp,
                              isReadable: true)
        } catch {
            return DrinkEntry(date: Date(), count: 0, lastDrink: nil, isReadable: false)
        }
    }
}

struct SipWidgetView: View {

    @Environment(\.widgetFamily) private var family
    let entry: DrinkEntry

    var body: some View {
        content
            .widgetURL(URL(string: "sip://today"))
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .accessoryCircular:
            ZStack {
                AccessoryWidgetBackground()
                Text(countText)
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.5)
            }
            .containerBackground(Color.clear, for: .widget)

        case .accessoryInline:
            Text("\(countText) drinks")

        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 1) {
                Text(countText)
                    .font(.system(size: 30, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                Text("DRINKS")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .tracking(2)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .containerBackground(Color.clear, for: .widget)

        default:
            VStack(alignment: .leading, spacing: 0) {
                Text(countText)
                    .font(.system(size: 58, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
                Text("DRINKS")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .tracking(3)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 6)
                Text(footnote)
                    .font(.system(size: 11, weight: .regular, design: .rounded))
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            .containerBackground(Color("WidgetBackground"), for: .widget)
        }
    }

    private var countText: String {
        entry.isReadable ? "\(entry.count)" : "—"
    }

    private var footnote: String {
        guard entry.isReadable else { return "Open Sip" }
        guard let last = entry.lastDrink else { return "Nothing yet" }
        return "Last \(DayKey.timeLabel(for: last))"
    }
}

struct SipWidget: Widget {

    let kind: String = "SipWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: SipProvider()) { entry in
            SipWidgetView(entry: entry)
        }
        .configurationDisplayName("Drinks")
        .description("Tonight's count, on your Lock Screen.")
        .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
