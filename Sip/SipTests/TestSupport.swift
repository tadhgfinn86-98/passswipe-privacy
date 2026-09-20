import Foundation
import SwiftData
import XCTest
@testable import Sip

enum TestSupport {

    /// A calendar pinned to one zone so day-rollover assertions are stable
    /// wherever the tests run.
    static var calendar: Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Europe/Dublin") ?? .gmt
        return calendar
    }

    static func date(_ year: Int, _ month: Int, _ day: Int, _ hour: Int, _ minute: Int) -> Date {
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = day
        components.hour = hour
        components.minute = minute
        return calendar.date(from: components)!
    }

    static func inMemoryContainer() throws -> ModelContainer {
        let schema = Schema([Drink.self])
        let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
        return try ModelContainer(for: schema, configurations: configuration)
    }

    static func fileContainer(at url: URL) throws -> ModelContainer {
        let schema = Schema([Drink.self])
        let configuration = ModelConfiguration(schema: schema, url: url)
        return try ModelContainer(for: schema, configurations: configuration)
    }

    static func makeStore() throws -> (store: DrinkStore, container: ModelContainer) {
        let container = try inMemoryContainer()
        return (DrinkStore(context: ModelContext(container), calendar: calendar), container)
    }
}
