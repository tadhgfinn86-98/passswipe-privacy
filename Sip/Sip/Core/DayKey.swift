import Foundation

/// A day in the user's local calendar, encoded as `yyyy-MM-dd`.
///
/// The string form sorts lexicographically in chronological order, which keeps
/// grouping and fetching cheap without storing a second normalised `Date`.
/// A "day" is always the local calendar date of the drink's timestamp, so the
/// count resets at local midnight.
enum DayKey {

    static func key(for date: Date, calendar: Calendar = .current) -> String {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    static func date(from key: String, calendar: Calendar = .current) -> Date? {
        let numbers = key.split(separator: "-").compactMap { Int($0) }
        guard numbers.count == 3 else { return nil }
        var components = DateComponents()
        components.year = numbers[0]
        components.month = numbers[1]
        components.day = numbers[2]
        return calendar.date(from: components)
    }

    static func today(_ calendar: Calendar = .current) -> String {
        key(for: Date(), calendar: calendar)
    }
}

extension DayKey {

    /// "SATURDAY"
    static func weekdayTitle(for key: String, calendar: Calendar = .current) -> String {
        guard let date = date(from: key, calendar: calendar) else { return "" }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("EEEE")
        return formatter.string(from: date).uppercased(with: .current)
    }

    /// "20 SEPTEMBER"
    static func dateTitle(for key: String, calendar: Calendar = .current) -> String {
        guard let date = date(from: key, calendar: calendar) else { return "" }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("dMMMM")
        return formatter.string(from: date).uppercased(with: .current)
    }

    /// "23:41"
    static func timeLabel(for date: Date) -> String {
        let formatter = DateFormatter()
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("jmm")
        return formatter.string(from: date)
    }

    /// "Saturday, 20 September" — used where the all-caps treatment is wrong.
    static func longLabel(for key: String, calendar: Calendar = .current) -> String {
        guard let date = date(from: key, calendar: calendar) else { return key }
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.locale = .current
        formatter.setLocalizedDateFormatFromTemplate("EEEEdMMMM")
        return formatter.string(from: date)
    }

    static func isToday(_ key: String, calendar: Calendar = .current) -> Bool {
        key == today(calendar)
    }
}
