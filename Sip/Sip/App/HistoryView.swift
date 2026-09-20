import SwiftUI
import SwiftData

struct HistoryView: View {

    @Query(sort: \Drink.timestamp, order: .reverse) private var allDrinks: [Drink]

    private var summaries: [DaySummary] { DrinkStore.summarise(allDrinks) }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sipBackground.ignoresSafeArea()

                if summaries.isEmpty {
                    emptyState
                } else {
                    List {
                        ForEach(summaries) { summary in
                            NavigationLink(value: summary.dayKey) {
                                DayRow(summary: summary)
                            }
                            .listRowBackground(Color.sipBackground)
                            .listRowSeparatorTint(Color.sipSecondary.opacity(0.25))
                        }
                    }
                    .listStyle(.plain)
                    .scrollContentBackground(.hidden)
                }
            }
            .navigationTitle("History")
            .navigationDestination(for: String.self) { DayDetailView(dayKey: $0) }
        }
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Text("NOTHING YET")
                .font(.sipLabel(14))
                .tracking(4)
                .foregroundStyle(Color.sipPrimary)
            Text("Counted drinks show up here, one night at a time.")
                .font(.sipBody())
                .foregroundStyle(Color.sipSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 48)
    }
}

private struct DayRow: View {

    let summary: DaySummary

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 3) {
                Text(DayKey.weekdayTitle(for: summary.dayKey))
                    .font(.sipLabel())
                    .tracking(3)
                    .foregroundStyle(Color.sipPrimary)
                Text(DayKey.dateTitle(for: summary.dayKey))
                    .font(.sipBody(13))
                    .tracking(1.5)
                    .foregroundStyle(Color.sipSecondary)
            }

            Spacer()

            Text("\(summary.count)")
                .font(.sipNumber(30))
                .monospacedDigit()
                .foregroundStyle(DayKey.isToday(summary.dayKey) ? Color.sipAccent : Color.sipPrimary)
        }
        .padding(.vertical, 10)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(DayKey.longLabel(for: summary.dayKey)), \(summary.count) drinks")
    }
}

struct DayDetailView: View {

    let dayKey: String

    @Environment(\.modelContext) private var modelContext
    @Query private var drinks: [Drink]

    init(dayKey: String) {
        self.dayKey = dayKey
        let key = dayKey
        _drinks = Query(
            filter: #Predicate<Drink> { $0.dayKey == key },
            sort: \Drink.timestamp,
            order: .reverse
        )
    }

    var body: some View {
        ZStack {
            Color.sipBackground.ignoresSafeArea()

            List {
                Section {
                    ForEach(drinks) { drink in
                        HStack {
                            Text("#\(drink.drinkNumber)")
                                .font(.sipNumber(18))
                                .monospacedDigit()
                                .foregroundStyle(Color.sipPrimary)
                                .frame(minWidth: 56, alignment: .leading)

                            Spacer()

                            Text(DayKey.timeLabel(for: drink.timestamp))
                                .font(.sipBody(16))
                                .monospacedDigit()
                                .foregroundStyle(Color.sipSecondary)
                        }
                        .padding(.vertical, 4)
                        .listRowBackground(Color.sipBackground)
                        .listRowSeparatorTint(Color.sipSecondary.opacity(0.2))
                    }
                    .onDelete(perform: delete)
                } header: {
                    Text(drinks.count == 1 ? "1 DRINK" : "\(drinks.count) DRINKS")
                        .font(.sipLabel(12))
                        .tracking(3)
                        .foregroundStyle(Color.sipSecondary)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
        .navigationTitle(DayKey.longLabel(for: dayKey))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { EditButton() }
    }

    private func delete(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(drinks[index])
        }
        try? modelContext.save()
    }
}
