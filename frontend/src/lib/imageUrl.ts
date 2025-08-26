// // lib/imageUrl.ts
// import api from "@/lib/axios";

// const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""; // e.g. https://api.zygoflow.com
// const PRIVATE_BASE = (api?.defaults?.baseURL as string) || ""; // axios base (dashboard)
// const DEFAULT_BASE = PUBLIC_BASE || PRIVATE_BASE;

// export function resolveImageSrc(path?: string): string {
//   if (!path) return "";
//   const s = path.trim();

//   // already absolute (or data/blob) → return as-is
//   if (/^(https?:|data:|blob:)/i.test(s)) return s;
//   if (s.startsWith("//")) return `https:${s}`;

//   // CSS url(...) → unwrap + recurse
//   if (s.startsWith("url(")) {
//     const inner = s.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
//     return `url(${resolveImageSrc(inner)})`;
//   }

//   // backend-relative path
//   if (s.startsWith("/")) {
//     return DEFAULT_BASE ? `${DEFAULT_BASE}${s}` : s;
//   }

//   // other relative paths (e.g. "uploads/foo.jpg")
//   return DEFAULT_BASE ? `${DEFAULT_BASE}/${s}` : s;
// }

// lib/imageUrl.ts

/**
 * Build a CDN URL for Supabase Storage public objects.
 * - Accepts raw paths ("/storage/v1/object/public/..."), absolute Supabase URLs,
 *   or already-wrapped css url(...) strings.
 * - Rewrites Supabase origin to Cloudflare media host if provided.
 */
const ORIGIN_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
  /\/+$/,
  ""
);
const CDN_BASE = (process.env.NEXT_PUBLIC_MEDIA_BASE || "").replace(/\/+$/, "");

const PUBLIC_PREFIX = "/storage/v1/object/public"; // Supabase public objects

function stripCssUrl(input: string) {
  return input.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
}

function isStoragePublicPath(path: string) {
  return (
    path.startsWith(PUBLIC_PREFIX) ||
    path.startsWith("/storage/v1/object/public/") ||
    path.startsWith("/all_vids/")
  );
}

export function resolveImageSrc(input?: string): string {
  if (!input) return "";

  const raw = stripCssUrl(input);

  // data: / blob: passthrough
  if (/^(data:|blob:)/i.test(raw)) return raw;

  // Already absolute
  if (/^https?:\/\//i.test(raw)) {
    // If it’s pointing at the Supabase origin, swap to CDN if we have one
    if (ORIGIN_BASE && raw.startsWith(ORIGIN_BASE) && CDN_BASE) {
      return raw.replace(ORIGIN_BASE, CDN_BASE);
    }
    return raw;
  }

  // Ensure a leading slash
  let path = raw.startsWith("/") ? raw : `/${raw}`;

  // Support short form: /all_vids/...  →  /storage/v1/object/public/all_vids/...
  if (path.startsWith("/all_vids/")) {
    path = `${PUBLIC_PREFIX}${path.replace(/^\/all_vids/, "/all_vids")}`;
  }

  // Only rewrite known Supabase public paths to CDN/origin
  if (path.startsWith(PUBLIC_PREFIX)) {
    const base = CDN_BASE || ORIGIN_BASE || "";
    return base ? `${base}${path}` : path;
  }

  // Anything else (e.g., /logo.svg, /_next/static/...): leave as-is
  return path;
}

/**
 * Convenience helper for CSS background-image values.
 * Usage: style={{ backgroundImage: normalizeBackground('/storage/v1/object/public/...') }}
 */
export function normalizeBackground(bg?: string) {
  if (!bg) return undefined;
  // Keep gradients intact
  if (/^linear-gradient/i.test(bg)) return bg;

  const url = resolveImageSrc(stripCssUrl(bg));
  return `url(${url})`;
}
