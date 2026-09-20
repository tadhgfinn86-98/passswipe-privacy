import SwiftUI
import SwiftData
import Combine
import UIKit
import WidgetKit

/// Owns the current local date and hands it to the content view, which rebuilds
/// its `@Query` whenever the day rolls over.
struct TodayView: View {

    @State private var dayKey = DayKey.today()

    /// Held in @State so the subscription survives view rebuilds.
    @State private var tick = Timer.publish(every: 20, on: .main, in: .common).autoconnect()

    var body: some View {
        TodayContent(dayKey: dayKey)
            .onReceive(tick) { _ in refreshDay() }
            .onReceive(NotificationCenter.default.publisher(
                for: UIApplication.significantTimeChangeNotification)) { _ in refreshDay() }
            .onReceive(NotificationCenter.default.publisher(
                for: UIApplication.didBecomeActiveNotification)) { _ in refreshDay() }
    }

    private func refreshDay() {
        let key = DayKey.today()
        if key != dayKey {
            withAnimation(.snappy) { dayKey = key }
        }
    }
}

struct TodayContent: View {

    let dayKey: String

    @Environment(\.modelContext) private var modelContext
    @EnvironmentObject private var settings: SipSettings
    @Query private var drinks: [Drink]

    @State private var showUndo = false
    @State private var undoTimer: Task<Void, Never>?
    @State private var showCard = false
    @State private var showHoldOptions = false
    @State private var confirmReset = false
    @State private var pulse = false

    init(dayKey: String) {
        self.dayKey = dayKey
        let key = dayKey
        _drinks = Query(
            filter: #Predicate<Drink> { $0.dayKey == key },
            sort: \Drink.timestamp,
            order: .reverse
        )
    }

    private var count: Int { drinks.count }
    private var lastDrink: Drink? { drinks.first }
    private var store: DrinkStore { DrinkStore(context: modelContext) }

    var body: some View {
        ZStack {
            Color.sipBackground.ignoresSafeArea()

            VStack(spacing: 0) {
                header
                Spacer(minLength: 8)
                counter
                Spacer(minLength: 8)
                controls
            }
            .padding(.horizontal, 28)
            .padding(.bottom, 8)
        }
        .sheet(isPresented: $showCard) {
            DrinkCardSheet(number: max(count, 1), name: settings.cardName)
        }
        .confirmationDialog("Today", isPresented: $showHoldOptions, titleVisibility: .hidden) {
            Button("Undo last drink") { undo() }
                .disabled(count == 0)
            Button("Reset today's count", role: .destructive) { confirmReset = true }
            Button("Cancel", role: .cancel) { }
        }
        .alert("Reset today?", isPresented: $confirmReset) {
            Button("Cancel", role: .cancel) { }
            Button("Reset", role: .destructive) { resetToday() }
        } message: {
            Text("This removes all \(count) drinks counted today. Previous days are kept.")
        }
        .onDisappear { undoTimer?.cancel() }
    }

    // MARK: - Pieces

    private var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 3) {
                Text(DayKey.weekdayTitle(for: dayKey))
                    .foregroundStyle(Color.sipPrimary)
                Text(DayKey.dateTitle(for: dayKey))
                    .foregroundStyle(Color.sipSecondary)
            }
            .font(.sipLabel())
            .tracking(3)

            Spacer()

            Button {
                showCard = true
            } label: {
                Image(systemName: "rectangle.on.rectangle")
                    .font(.system(size: 17, weight: .medium))
                    .foregroundStyle(Color.sipSecondary)
                    .frame(width: 44, height: 44, alignment: .topTrailing)
            }
            .accessibilityLabel("Drink card")
        }
        .padding(.top, 12)
    }

    private var counter: some View {
        VStack(spacing: 0) {
            Text("\(count)")
                .font(.sipNumber(168))
                .monospacedDigit()
                .lineLimit(1)
                .minimumScaleFactor(0.35)
                .foregroundStyle(Color.sipPrimary)
                .contentTransition(.numericText(value: Double(count)))
                .scaleEffect(pulse ? 1.035 : 1)
                .animation(.snappy(duration: 0.28), value: count)
                .animation(.spring(response: 0.3, dampingFraction: 0.55), value: pulse)

            Text(count == 1 ? "DRINK" : "DRINKS")
                .font(.sipLabel(14))
                .tracking(7)
                .foregroundStyle(Color.sipSecondary)
                .padding(.top, 6)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(countAccessibilityLabel)
    }

    private var countAccessibilityLabel: String {
        count == 1 ? "1 drink today" : "\(count) drinks today"
    }

    private var controls: some View {
        VStack(spacing: 18) {
            AddDrinkButton(onTap: addDrink, onHold: { showHoldOptions = true })

            ZStack {
                // Reserve the row so the layout never jumps when Undo appears.
                Color.clear.frame(height: 22)

                if showUndo {
                    Button("Undo", action: undo)
                        .font(.sipBody(15))
                        .foregroundStyle(Color.sipAccent)
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.2), value: showUndo)

            VStack(spacing: 4) {
                if let lastDrink {
                    Text("Last drink")
                        .foregroundStyle(Color.sipSecondary)
                    Text(DayKey.timeLabel(for: lastDrink.timestamp))
                        .foregroundStyle(Color.sipPrimary)
                        .monospacedDigit()
                } else {
                    Text("No drinks counted yet")
                        .foregroundStyle(Color.sipSecondary)
                }
            }
            .font(.sipBody(15))

            Text("Press the Action Button to add a drink")
                .font(.sipBody(13))
                .foregroundStyle(Color.sipSecondary.opacity(0.7))
                .multilineTextAlignment(.center)
                .padding(.bottom, 4)
        }
    }

    // MARK: - Actions

    private func addDrink() {
        do {
            try store.addDrink()
            Haptics.drinkAdded(enabled: settings.hapticsEnabled)
            bumpPulse()
            revealUndo()
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            Haptics.warning(enabled: settings.hapticsEnabled)
        }
    }

    private func undo() {
        do {
            guard try store.undoLastDrink() != nil else { return }
            Haptics.undone(enabled: settings.hapticsEnabled)
            withAnimation(.easeInOut(duration: 0.2)) { showUndo = false }
            undoTimer?.cancel()
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            Haptics.warning(enabled: settings.hapticsEnabled)
        }
    }

    private func resetToday() {
        try? store.deleteDay(dayKey)
        Haptics.undone(enabled: settings.hapticsEnabled)
        showUndo = false
        WidgetCenter.shared.reloadAllTimelines()
    }

    private func bumpPulse() {
        pulse = true
        Task { @MainActor in
            try? await Task.sleep(for: .milliseconds(160))
            pulse = false
        }
    }

    private func revealUndo() {
        showUndo = true
        undoTimer?.cancel()
        undoTimer = Task { @MainActor in
            try? await Task.sleep(for: .seconds(6))
            guard !Task.isCancelled else { return }
            withAnimation(.easeInOut(duration: 0.25)) { showUndo = false }
        }
    }
}

/// Tap counts a drink; touch-and-hold opens the undo / reset options.
/// `ExclusiveGesture` keeps a hold from also registering as a tap.
struct AddDrinkButton: View {

    let onTap: () -> Void
    let onHold: () -> Void

    @State private var isPressed = false

    var body: some View {
        Text("+  ADD DRINK")
            .font(.sipLabel(17))
            .tracking(2.5)
            .foregroundStyle(Color.sipBackground)
            .frame(maxWidth: .infinity)
            .frame(height: 66)
            .background(Color.sipPrimary, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .scaleEffect(isPressed ? 0.975 : 1)
            .opacity(isPressed ? 0.92 : 1)
            .animation(.spring(response: 0.22, dampingFraction: 0.8), value: isPressed)
            .contentShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .gesture(
                ExclusiveGesture(
                    LongPressGesture(minimumDuration: 0.55)
                        .onEnded { _ in
                            isPressed = false
                            onHold()
                        },
                    TapGesture()
                        .onEnded {
                            isPressed = false
                            onTap()
                        }
                )
            )
            .simultaneousGesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { _ in isPressed = true }
                    .onEnded { _ in isPressed = false }
            )
            .accessibilityElement(children: .ignore)
            .accessibilityAddTraits(.isButton)
            .accessibilityLabel("Add drink")
            .accessibilityHint("Counts one drink. Touch and hold for undo and reset.")
            .accessibilityAction { onTap() }
    }
}
