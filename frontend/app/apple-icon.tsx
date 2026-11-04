import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Apple devices use a PNG touch icon rather than the SVG favicon. Keep it in
 * lockstep with icon.svg so Safari and iOS show the same ICEPUNK snowflake.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <svg viewBox="0 0 64 64" width="180" height="180" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="frost" cx="34%" cy="26%" r="78%">
            <stop offset="0" stopColor="#183957" />
            <stop offset="1" stopColor="#071522" />
          </radialGradient>
        </defs>
        <rect width="64" height="64" rx="15" fill="url(#frost)" />
        <g fill="none" stroke="#d9f4ff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.1">
          <path d="M32 10v44M12.95 21l38.1 22M12.95 43l38.1-22" />
          <path d="m26 17 6 6 6-6m-17 10 11 6 11-6m-17 20 6-6 6 6" />
          <path d="m18.1 29 8.2 1.4-2.8-7.8m22.4 12-8.2-1.4 2.8 7.8" />
        </g>
      </svg>
    ),
    size,
  );
}
