import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "#ffffff",
          backgroundImage:
            "radial-gradient(circle at 20% -10%, rgba(79,70,229,0.16), transparent 55%), radial-gradient(circle at 95% 110%, rgba(14,165,233,0.14), transparent 50%)",
          color: "#0a0a0b",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(135deg,#4f46e5,#0ea5e9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: "#ffffff",
              }}
            />
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {site.name}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
              maxWidth: 900,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>Meet your AI agent.</span>
            <span style={{ color: "#4f46e5" }}>Streamline your workflow.</span>
          </div>
          <div style={{ fontSize: 28, color: "#62666d", maxWidth: 760 }}>
            An intelligent assistant that handles repetitive work, connects your tools,
            and keeps your team moving.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "#8b9096",
          }}
        >
          <div
            style={{
              padding: "10px 20px",
              borderRadius: 999,
              background: "#4f46e5",
              color: "#ffffff",
              fontSize: 22,
              fontWeight: 500,
            }}
          >
            Try for free
          </div>
          <div>No credit card required · Cancel anytime</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
