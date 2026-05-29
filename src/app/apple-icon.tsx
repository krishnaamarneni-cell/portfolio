import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon — iOS home-screen needs PNG at 180×180. Same K-glyph,
 *  slightly different padding so it doesn't get clipped by iOS's mask. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(135deg, #ff6b00 0%, #ff8c38 60%, #ffaa66 100%)",
          color: "#0a0a0a",
          fontSize: 130,
          fontWeight: 900,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: -6,
        }}
      >
        K
      </div>
    ),
    {
      ...size,
    }
  );
}
