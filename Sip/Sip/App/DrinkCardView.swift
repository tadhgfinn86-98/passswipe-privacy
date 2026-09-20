import SwiftUI

/// A modern reading of the paper drink card you get handed at the door.
/// Fixed colours on purpose — it is rendered to an image and shared, so it must
/// look the same wherever it lands.
struct DrinkCard: View {

    let number: Int
    let name: String

    static let size = CGSize(width: 340, height: 520)

    private let paper = Color(red: 0.957, green: 0.945, blue: 0.918)
    private let ink = Color(red: 0.086, green: 0.086, blue: 0.098)
    private let faded = Color(red: 0.42, green: 0.40, blue: 0.36)

    var body: some View {
        VStack(spacing: 0) {
            Text("SIP")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .tracking(6)
                .foregroundStyle(faded)
                .padding(.top, 32)

            Spacer()

            VStack(spacing: 10) {
                caption("MY NAME IS")

                Text(name)
                    .font(.system(size: 42, weight: .semibold, design: .rounded))
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
                    .foregroundStyle(ink)
                    .padding(.horizontal, 24)

                rule

                caption("AND THIS IS")

                Text("DRINK")
                    .font(.system(size: 20, weight: .semibold, design: .rounded))
                    .tracking(5)
                    .foregroundStyle(ink)

                Text("#\(number)")
                    .font(.system(size: 92, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
                    .foregroundStyle(ink)
            }

            Spacer()

            Text(DayKey.longLabel(for: DayKey.today()).uppercased(with: .current))
                .font(.system(size: 11, weight: .medium, design: .rounded))
                .tracking(2)
                .foregroundStyle(faded)
                .padding(.bottom, 30)
        }
        .frame(width: Self.size.width, height: Self.size.height)
        .background(paper)
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .strokeBorder(ink.opacity(0.12), lineWidth: 1)
        )
    }

    private func caption(_ text: String) -> some View {
        Text(text)
            .font(.system(size: 12, weight: .medium, design: .rounded))
            .tracking(3)
            .foregroundStyle(faded)
    }

    private var rule: some View {
        Rectangle()
            .fill(ink.opacity(0.15))
            .frame(width: 140, height: 1)
            .padding(.vertical, 6)
    }
}

struct DrinkCardSheet: View {

    let number: Int
    let name: String

    @Environment(\.dismiss) private var dismiss
    @State private var shareImage: Image?

    var body: some View {
        NavigationStack {
            ZStack {
                Color.sipBackground.ignoresSafeArea()

                VStack(spacing: 28) {
                    Spacer()
                    DrinkCard(number: number, name: name)
                        .shadow(color: .black.opacity(0.25), radius: 24, y: 12)
                    Spacer()

                    if let shareImage {
                        ShareLink(item: shareImage,
                                  preview: SharePreview("Drink #\(number)", image: shareImage)) {
                            Text("SHARE CARD")
                                .font(.sipLabel(15))
                                .tracking(2.5)
                                .foregroundStyle(Color.sipBackground)
                                .frame(maxWidth: .infinity)
                                .frame(height: 56)
                                .background(Color.sipPrimary,
                                            in: RoundedRectangle(cornerRadius: 20, style: .continuous))
                        }
                    }
                }
                .padding(.horizontal, 28)
                .padding(.bottom, 24)
            }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear { shareImage = render() }
        }
    }

    @MainActor
    private func render() -> Image? {
        let renderer = ImageRenderer(content: DrinkCard(number: number, name: name))
        renderer.scale = 3
        guard let image = renderer.uiImage else { return nil }
        return Image(uiImage: image)
    }
}
