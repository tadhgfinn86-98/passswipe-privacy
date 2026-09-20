import Foundation
import SwiftData

/// The single SwiftData stack for the app process.
///
/// The App Intent, the UI and any background launch all go through this, so
/// there is exactly one writer and `@Query` views stay in sync automatically.
@MainActor
final class SipEnvironment {

    private static var stack: SipEnvironment?

    static var shared: SipEnvironment {
        get {
            if let stack { return stack }
            let created = SipEnvironment()
            stack = created
            return created
        }
        set { stack = newValue }
    }

    /// Swaps in a throwaway in-memory stack. Tests only.
    static func useInMemoryStoreForTesting() {
        shared = SipEnvironment(inMemory: true)
    }

    let container: ModelContainer

    /// True when the on-disk store could not be opened and Sip fell back to
    /// memory. Surfaced in Settings rather than crashing on a night out.
    private(set) var isUsingFallbackStore = false

    var store: DrinkStore { DrinkStore(context: container.mainContext) }

    init(inMemory: Bool = false, url: URL? = nil) {
        let schema = Schema([Drink.self])

        func makeContainer() throws -> ModelContainer {
            if inMemory {
                let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
                return try ModelContainer(for: schema, configurations: configuration)
            }
            let configuration = ModelConfiguration(schema: schema, url: url ?? SipShared.storeURL)
            return try ModelContainer(for: schema, configurations: configuration)
        }

        do {
            container = try makeContainer()
        } catch {
            // Last resort: never take the app down because of a bad store file.
            let configuration = ModelConfiguration(schema: schema, isStoredInMemoryOnly: true)
            container = try! ModelContainer(for: schema, configurations: configuration)
            isUsingFallbackStore = !inMemory
        }
    }
}
