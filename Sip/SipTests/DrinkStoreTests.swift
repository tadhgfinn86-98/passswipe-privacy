import XCTest
import SwiftData
@testable import Sip

final class DrinkStoreTests: XCTestCase {

    private var container: ModelContainer!
    private var store: DrinkStore!

    override func setUpWithError() throws {
        let made = try TestSupport.makeStore()
        container = made.container
        store = made.store
    }

    override func tearDownWithError() throws {
        store = nil
        container = nil
    }

    // 1. Adding a drink
    func testAddingADrink() throws {
        let night = TestSupport.date(2026, 9, 20, 22, 31)
        let drink = try store.addDrink(at: night)

        XCTAssertEqual(drink.drinkNumber, 1)
        XCTAssertEqual(drink.dayKey, "2026-09-20")
        XCTAssertEqual(drink.timestamp, night)
        XCTAssertEqual(try store.count(forDay: "2026-09-20"), 1)
    }

    // 2. Adding multiple drinks
    func testAddingMultipleDrinks() throws {
        for minute in 0..<5 {
            try store.addDrink(at: TestSupport.date(2026, 9, 20, 21, minute))
        }

        XCTAssertEqual(try store.count(forDay: "2026-09-20"), 5)
        XCTAssertEqual(try store.drinks(forDay: "2026-09-20").count, 5)
    }

    // 3. Undo
    func testUndoRemovesTheMostRecentDrink() throws {
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 22, 0))
        let last = try store.addDrink(at: TestSupport.date(2026, 9, 20, 23, 41))

        let removed = try store.undoLastDrink()

        XCTAssertEqual(removed?.id, last.id)
        XCTAssertEqual(try store.count(forDay: "2026-09-20"), 1)
        XCTAssertEqual(try store.lastDrink(forDay: "2026-09-20")?.drinkNumber, 1)
    }

    func testUndoOnAnEmptyLogIsHarmless() throws {
        XCTAssertNil(try store.undoLastDrink())
        XCTAssertEqual(try store.countToday(), 0)
    }

    func testUndoThenAddReusesTheNumber() throws {
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 20, 0))
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 21, 0))
        try store.undoLastDrink()

        let replacement = try store.addDrink(at: TestSupport.date(2026, 9, 20, 21, 30))

        XCTAssertEqual(replacement.drinkNumber, 2)
        XCTAssertEqual(try store.count(forDay: "2026-09-20"), 2)
    }

    // 4. Correct drink numbering
    func testDrinkNumbersRunInSequenceWithinADay() throws {
        var numbers: [Int] = []
        for minute in 0..<23 {
            numbers.append(try store.addDrink(at: TestSupport.date(2026, 9, 20, 20, minute)).drinkNumber)
        }

        XCTAssertEqual(numbers, Array(1...23))
    }

    // 5. Midnight rollover
    func testCountResetsAfterLocalMidnight() throws {
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 23, 41))
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 23, 59))
        let afterMidnight = try store.addDrink(at: TestSupport.date(2026, 9, 21, 0, 12))

        XCTAssertEqual(afterMidnight.dayKey, "2026-09-21")
        XCTAssertEqual(afterMidnight.drinkNumber, 1, "The first drink after midnight starts a new tally")
        XCTAssertEqual(try store.count(forDay: "2026-09-20"), 2, "Yesterday is preserved")
        XCTAssertEqual(try store.count(forDay: "2026-09-21"), 1)
    }

    // 6. Historical dates
    func testHistoryGroupsDaysNewestFirst() throws {
        for minute in 0..<4 { try store.addDrink(at: TestSupport.date(2026, 9, 18, 21, minute)) }
        for minute in 0..<8 { try store.addDrink(at: TestSupport.date(2026, 9, 19, 21, minute)) }
        for minute in 0..<23 { try store.addDrink(at: TestSupport.date(2026, 9, 20, 21, minute)) }

        let summaries = try store.daySummaries()

        XCTAssertEqual(summaries.map(\.dayKey), ["2026-09-20", "2026-09-19", "2026-09-18"])
        XCTAssertEqual(summaries.map(\.count), [23, 8, 4])
    }

    func testDayDetailIsOrderedNewestFirst() throws {
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 22, 2))
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 22, 31))
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 23, 41))

        let drinks = try store.drinks(forDay: "2026-09-20")

        XCTAssertEqual(drinks.map(\.drinkNumber), [3, 2, 1])
    }

    // 9. Empty history
    func testEmptyHistory() throws {
        XCTAssertTrue(try store.daySummaries().isEmpty)
        XCTAssertEqual(try store.countToday(), 0)
        XCTAssertNil(try store.mostRecentDrink())
    }

    // 10. Deleting data
    func testDeleteDayKeepsOtherDays() throws {
        try store.addDrink(at: TestSupport.date(2026, 9, 19, 21, 0))
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 21, 0))

        try store.deleteDay("2026-09-20")

        XCTAssertEqual(try store.count(forDay: "2026-09-20"), 0)
        XCTAssertEqual(try store.count(forDay: "2026-09-19"), 1)
    }

    func testDeleteAllClearsEverything() throws {
        for day in 18...20 {
            try store.addDrink(at: TestSupport.date(2026, 9, day, 21, 0))
        }

        try store.deleteAll()

        XCTAssertTrue(try store.allDrinks().isEmpty)
        XCTAssertTrue(try store.daySummaries().isEmpty)
    }

    // 7. Persistence across app restarts
    func testDataSurvivesAStoreReopen() throws {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("SipTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: folder) }

        let url = folder.appendingPathComponent("Sip.store")

        do {
            let container = try TestSupport.fileContainer(at: url)
            let store = DrinkStore(context: ModelContext(container), calendar: TestSupport.calendar)
            for minute in 0..<3 {
                try store.addDrink(at: TestSupport.date(2026, 9, 20, 22, minute))
            }
        }

        // A fresh container stands in for the next app launch.
        let reopened = try TestSupport.fileContainer(at: url)
        let store = DrinkStore(context: ModelContext(reopened), calendar: TestSupport.calendar)

        XCTAssertEqual(try store.count(forDay: "2026-09-20"), 3)
        XCTAssertEqual(try store.highestDrinkNumber(forDay: "2026-09-20"), 3)
        XCTAssertEqual(try store.addDrink(at: TestSupport.date(2026, 9, 20, 22, 30)).drinkNumber, 4)
    }

    // Export
    func testCSVExportContainsEveryDrink() throws {
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 22, 0))
        try store.addDrink(at: TestSupport.date(2026, 9, 20, 23, 0))

        let csv = DataExport.csv(from: try store.allDrinks())
        let lines = csv.split(separator: "\n")

        XCTAssertEqual(lines.count, 3, "header + two drinks")
        XCTAssertTrue(lines[0].hasPrefix("local_date,drink_number"))
        XCTAssertTrue(lines[1].hasPrefix("2026-09-20,1,"))
        XCTAssertTrue(lines[2].hasPrefix("2026-09-20,2,"))
    }
}
