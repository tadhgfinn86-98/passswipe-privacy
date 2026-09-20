import XCTest
import AppIntents
@testable import Sip

/// The critical path: the Action Button runs `AddDrinkIntent` in the background.
/// These drive the exact same entry point the system does.
@MainActor
final class AddDrinkIntentTests: XCTestCase {

    override func setUp() async throws {
        try await super.setUp()
        SipEnvironment.useInMemoryStoreForTesting()
        try SipEnvironment.shared.store.deleteAll()
    }

    private var store: DrinkStore { SipEnvironment.shared.store }

    // 8. App Intent execution
    func testAddDrinkIntentCountsOneDrink() async throws {
        _ = try await AddDrinkIntent().perform()

        XCTAssertEqual(try store.countToday(), 1)
        XCTAssertEqual(try store.mostRecentDrink()?.drinkNumber, 1)
    }

    func testRepeatedPressesKeepCounting() async throws {
        for _ in 0..<5 {
            _ = try await AddDrinkIntent().perform()
        }

        XCTAssertEqual(try store.countToday(), 5)
        XCTAssertEqual(try store.highestDrinkNumber(forDay: DayKey.today()), 5)
    }

    func testIntentWritesToTheSameStoreTheUIReads() async throws {
        try store.addDrink()
        _ = try await AddDrinkIntent().perform()

        XCTAssertEqual(try store.countToday(), 2,
                       "The intent and the app must share one SwiftData stack")
    }

    func testUndoIntentRemovesTheLastDrink() async throws {
        _ = try await AddDrinkIntent().perform()
        _ = try await AddDrinkIntent().perform()

        _ = try await UndoDrinkIntent().perform()

        XCTAssertEqual(try store.countToday(), 1)
    }

    func testUndoIntentOnAnEmptyLogDoesNotThrow() async throws {
        _ = try await UndoDrinkIntent().perform()
        XCTAssertEqual(try store.countToday(), 0)
    }

    func testCountIntentRuns() async throws {
        _ = try await AddDrinkIntent().perform()
        _ = try await AddDrinkIntent().perform()
        _ = try await AddDrinkIntent().perform()

        _ = try await DrinkCountIntent().perform()

        XCTAssertEqual(try store.countToday(), 3)
    }

    /// The app must never come to the front — that is the whole product.
    func testIntentsNeverOpenTheApp() {
        XCTAssertFalse(AddDrinkIntent.openAppWhenRun)
        XCTAssertFalse(UndoDrinkIntent.openAppWhenRun)
        XCTAssertFalse(DrinkCountIntent.openAppWhenRun)
    }
}
