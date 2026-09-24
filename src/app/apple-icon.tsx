import { ImageResponse } from "next/og";
import { BrandMark } from "@/lib/brand-mark";

// iOS home screen icon ("Add to Home Screen").
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<BrandMark size={180} />, size);
}
