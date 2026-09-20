import Foundation
import SwiftData

/// One drink. Every property has a default value so that future schema
/// additions stay inside SwiftData's lightweight migration path.
@Model
final class Drink {

    var id: UUID = UUID()

    /// The exact moment the drink was counted.
    var timestamp: Date = Date()

    /// Local calendar date of `timestamp`, see `DayKey`.
    var dayKey: String = ""

    /// 1-based position of this drink within its day.
    var drinkNumber: Int = 1

    init(id: UUID = UUID(), timestamp: Date, dayKey: String, drinkNumber: Int) {
        self.id = id
        self.timestamp = timestamp
        self.dayKey = dayKey
        self.drinkNumber = drinkNumber
    }
}
