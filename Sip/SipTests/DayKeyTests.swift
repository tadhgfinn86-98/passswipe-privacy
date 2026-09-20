import XCTest
@testable import Sip

final class DayKeyTests: XCTestCase {

    func testKeyUsesTheLocalCalendarDate() {
        let lateNight = TestSupport.date(2026, 9, 20, 23, 41)
        XCTAssertEqual(DayKey.key(for: lateNight, calendar: TestSupport.calendar), "2026-09-20")

        let justAfterMidnight = TestSupport.date(2026, 9, 21, 0, 3)
        XCTAssertEqual(DayKey.key(for: justAfterMidnight, calendar: TestSupport.calendar), "2026-09-21")
    }

    func testKeysSortChronologically() {
        let keys = ["2026-09-21", "2026-10-01", "2026-09-09", "2025-12-31"]
        XCTAssertEqual(keys.sorted(), ["2025-12-31", "2026-09-09", "2026-09-21", "2026-10-01"])
    }

    func testKeyRoundTripsToADate() throws {
        let key = "2026-09-20"
        let date = try XCTUnwrap(DayKey.date(from: key, calendar: TestSupport.calendar))
        XCTAssertEqual(DayKey.key(for: date, calendar: TestSupport.calendar), key)
    }

    func testMalformedKeysReturnNil() {
        XCTAssertNil(DayKey.date(from: "not-a-day"))
        XCTAssertNil(DayKey.date(from: "2026-09"))
    }

    func testSingleDigitMonthsAndDaysArePadded() {
        let earlyYear = TestSupport.date(2026, 1, 5, 12, 0)
        XCTAssertEqual(DayKey.key(for: earlyYear, calendar: TestSupport.calendar), "2026-01-05")
    }

    func testTodayMatchesTheCurrentDate() {
        XCTAssertEqual(DayKey.today(), DayKey.key(for: Date()))
        XCTAssertTrue(DayKey.isToday(DayKey.today()))
    }
}
