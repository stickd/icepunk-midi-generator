import type { NextConfig } from "next";

function origin(value: string | undefined, fallback: string, requiredInProduction = false): string {
  if (requiredInProduction && !value) {
    throw new Error("NEXT_PUBLIC_STORAGE_ORIGIN is required for a production build.");
  }
  try {
    return new URL(value ?? fallback).origin;
  } catch {
    if (requiredInProduction) {
      throw new Error("NEXT_PUBLIC_STORAGE_ORIGIN must be an absolute HTTP(S) origin for a production build.");
    }
    return new URL(fallback).origin;
  }
}

const apiOrigin = origin(process.env.NEXT_PUBLIC_API_URL, "http://localhost:8081");
const storageOrigin = origin(
  process.env.NEXT_PUBLIC_STORAGE_ORIGIN,
  "http://localhost:9010",
  process.env.NODE_ENV === "production",
);
const analyticsOrigins = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  ? "https://www.googletagmanager.com https://www.google-analytics.com"
  : "";
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  // Next's runtime and the current glass UI require inline bootstrap/style
  // snippets. No unsafe-eval or third-party script origin is permitted.
  `script-src 'self' 'unsafe-inline' ${analyticsOrigins}`.trim(),
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${apiOrigin} ${storageOrigin} ${analyticsOrigins}`.trim(),
  `img-src 'self' data: blob: ${apiOrigin} ${storageOrigin}`,
  `media-src 'self' blob: ${apiOrigin} ${storageOrigin}`,
  "font-src 'self' data:",
  "worker-src 'self' blob:",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          // Browsers ignore this over local HTTP; production is required to
          // terminate TLS at the reverse proxy before public exposure.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
