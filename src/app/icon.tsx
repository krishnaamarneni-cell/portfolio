import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Dynamic PWA icon — orange gradient with a giant K. Next 15 serves this at
 *  /icon and the manifest references it for both 192 and 512 sizes (the OS
 *  scales appropriately). */
export default function Icon() {
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
          fontSize: 360,
          fontWeight: 900,
          fontFamily: "system-ui, -apple-system, sans-serif",
          letterSpacing: -20,
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
