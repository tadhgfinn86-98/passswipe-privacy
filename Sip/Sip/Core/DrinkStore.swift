import Foundation
import SwiftData

/// A day of drinking, summarised for the history list.
struct DaySummary: Identifiable, Hashable {
    let dayKey: String
    let count: Int
    let lastDrink: Date?

    var id: String { dayKey }
    var date: Date? { DayKey.date(from: dayKey) }
}

/// All reads and writes to the drink log.
///
/// Deliberately a plain value type over a `ModelContext` so that the intents,
/// the UI and the tests can all drive exactly the same code path.
struct DrinkStore {

    let context: ModelContext
    var calendar: Calendar = .current

    init(context: ModelContext, calendar: Calendar = .current) {
        self.context = context
        self.calendar = calendar
    }

    // MARK: - Writing

    /// Counts one drink and returns it. The drink number continues the day's
    /// sequence, so the first drink after local midnight is `#1` again.
    @discardableResult
    func addDrink(at date: Date = Date()) throws -> Drink {
        let key = DayKey.key(for: date, calendar: calendar)
        let drink = Drink(timestamp: date,
                          dayKey: key,
                          drinkNumber: try highestDrinkNumber(forDay: key) + 1)
        context.insert(drink)
        try context.save()
        return drink
    }

    /// Removes the most recent drink anywhere in the log. Returns it, or `nil`
    /// when there was nothing to undo.
    @discardableResult
    func undoLastDrink() throws -> Drink? {
        guard let last = try mostRecentDrink() else { return nil }
        context.delete(last)
        try context.save()
        return last
    }

    func deleteDay(_ key: String) throws {
        for drink in try drinks(forDay: key) {
            context.delete(drink)
        }
        try context.save()
    }

    func deleteAll() throws {
        try context.delete(model: Drink.self)
        try context.save()
    }

    // MARK: - Reading

    func count(forDay key: String) throws -> Int {
        try context.fetchCount(FetchDescriptor<Drink>(predicate: #Predicate<Drink> { $0.dayKey == key }))
    }

    func countToday() throws -> Int {
        try count(forDay: DayKey.today(calendar))
    }

    /// Newest first.
    func drinks(forDay key: String) throws -> [Drink] {
        let descriptor = FetchDescriptor<Drink>(
            predicate: #Predicate<Drink> { $0.dayKey == key },
            sortBy: [SortDescriptor(\Drink.timestamp, order: .reverse)]
        )
        return try context.fetch(descriptor)
    }

    func mostRecentDrink() throws -> Drink? {
        var descriptor = FetchDescriptor<Drink>(
            sortBy: [SortDescriptor(\Drink.timestamp, order: .reverse)]
        )
        descriptor.fetchLimit = 1
        return try context.fetch(descriptor).first
    }

    func lastDrink(forDay key: String) throws -> Drink? {
        var descriptor = FetchDescriptor<Drink>(
            predicate: #Predicate<Drink> { $0.dayKey == key },
            sortBy: [SortDescriptor(\Drink.timestamp, order: .reverse)]
        )
        descriptor.fetchLimit = 1
        return try context.fetch(descriptor).first
    }

    func highestDrinkNumber(forDay key: String) throws -> Int {
        var descriptor = FetchDescriptor<Drink>(
            predicate: #Predicate<Drink> { $0.dayKey == key },
            sortBy: [SortDescriptor(\Drink.drinkNumber, order: .reverse)]
        )
        descriptor.fetchLimit = 1
        return try context.fetch(descriptor).first?.drinkNumber ?? 0
    }

    func allDrinks() throws -> [Drink] {
        try context.fetch(FetchDescriptor<Drink>(sortBy: [SortDescriptor(\Drink.timestamp, order: .reverse)]))
    }

    /// Most recent day first.
    func daySummaries() throws -> [DaySummary] {
        DrinkStore.summarise(try allDrinks())
    }

    /// Pure grouping step, split out so it can be exercised without a store.
    static func summarise(_ drinks: [Drink]) -> [DaySummary] {
        var order: [String] = []
        var counts: [String: Int] = [:]
        var latest: [String: Date] = [:]

        for drink in drinks.sorted(by: { $0.timestamp > $1.timestamp }) {
            if counts[drink.dayKey] == nil {
                order.append(drink.dayKey)
                latest[drink.dayKey] = drink.timestamp
            }
            counts[drink.dayKey, default: 0] += 1
        }

        return order.map { DaySummary(dayKey: $0, count: counts[$0] ?? 0, lastDrink: latest[$0]) }
    }
}
