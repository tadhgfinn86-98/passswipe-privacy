import Foundation

/// Everything Sip knows about you, in two plain files you can read yourself.
enum DataExport {

    struct Payload: Codable {
        struct Row: Codable {
            let id: UUID
            let timestamp: Date
            let localDate: String
            let drinkNumber: Int
        }
        let app: String
        let exportedAt: Date
        let drinks: [Row]
    }

    static func rows(from drinks: [Drink]) -> [Payload.Row] {
        drinks
            .sorted { $0.timestamp < $1.timestamp }
            .map { Payload.Row(id: $0.id,
                               timestamp: $0.timestamp,
                               localDate: $0.dayKey,
                               drinkNumber: $0.drinkNumber) }
    }

    static func csv(from drinks: [Drink]) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        var lines = ["local_date,drink_number,timestamp,id"]
        for row in rows(from: drinks) {
            lines.append("\(row.localDate),\(row.drinkNumber),\(formatter.string(from: row.timestamp)),\(row.id.uuidString)")
        }
        return lines.joined(separator: "\n") + "\n"
    }

    static func json(from drinks: [Drink]) throws -> Data {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .iso8601
        let payload = Payload(app: "Sip", exportedAt: Date(), drinks: rows(from: drinks))
        return try encoder.encode(payload)
    }

    /// Writes both files into a fresh temporary folder and returns their URLs.
    static func writeFiles(for drinks: [Drink]) throws -> (csv: URL, json: URL) {
        let folder = FileManager.default.temporaryDirectory
            .appendingPathComponent("SipExport-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

        let stamp = DayKey.today()
        let csvURL = folder.appendingPathComponent("Sip-\(stamp).csv")
        let jsonURL = folder.appendingPathComponent("Sip-\(stamp).json")

        try csv(from: drinks).write(to: csvURL, atomically: true, encoding: .utf8)
        try json(from: drinks).write(to: jsonURL, options: .atomic)

        return (csvURL, jsonURL)
    }
}
