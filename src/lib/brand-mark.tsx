/**
 * The SquadClock mark: a hairline clock face on the near-black canvas,
 * hands at 10:10, and one "live" green dot at twelve, the only green the
 * design system allows (DESIGN.md). Drawn as SVG for next/og's
 * ImageResponse, so every icon size is generated from this one source.
 *
 * The mark sits inside the central 60% of the square, which keeps it
 * clear of the safe zone when the icon is used as maskable (Android
 * crops it to a circle or squircle).
 */
export function BrandMark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0a",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="26" fill="none" stroke="#ffffff" strokeWidth="3" />
        <line x1="50" y1="50" x2="39" y2="41" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="50" x2="63" y2="39" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="50" r="2.5" fill="#ffffff" />
        <circle cx="50" cy="24" r="5" fill="#22c55e" stroke="#0a0a0a" strokeWidth="2" />
      </svg>
    </div>
  );
}
