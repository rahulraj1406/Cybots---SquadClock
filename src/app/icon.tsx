import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

// The two sizes the web app manifest needs for installability
// (served as /icon/192 and /icon/512).
const SIZES = [192, 512] as const;

export function generateImageMetadata() {
  return SIZES.map((size) => ({
    id: String(size),
    size: { width: size, height: size },
    contentType: "image/png",
  }));
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const size = Number(await id);
  return new ImageResponse(<BrandMark size={size} />, { width: size, height: size });
}
