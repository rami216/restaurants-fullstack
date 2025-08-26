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
const ORIGIN_BASE =
  process.env.NEXT_PUBLIC_SUPABASE_BASE_URL?.replace(/\/+$/, "") || "";
const CDN_BASE = process.env.NEXT_PUBLIC_MEDIA_BASE?.replace(/\/+$/, "") || "";
const PUBLIC_PREFIX = "/storage/v1/object/public"; // do not change

function stripCssUrl(input: string) {
  return input.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
}

export function resolveImageSrc(input?: string): string {
  if (!input) return "";

  const raw = stripCssUrl(input);

  // data: / blob: passthrough
  if (/^(data:|blob:)/i.test(raw)) return raw;

  // Already an absolute http(s) URL
  if (/^https?:\/\//i.test(raw)) {
    // If it's the Supabase origin, swap to CDN if configured
    if (ORIGIN_BASE && raw.startsWith(ORIGIN_BASE) && CDN_BASE) {
      return raw.replace(ORIGIN_BASE, CDN_BASE);
    }
    return raw;
  }

  // Relative path → ensure leading slash
  const path = raw.startsWith("/") ? raw : `/${raw}`;

  // If it's a storage public path, prefix with CDN (or origin fallback)
  if (path.startsWith(PUBLIC_PREFIX)) {
    const base = CDN_BASE || ORIGIN_BASE || "";
    return base ? `${base}${path}` : path;
  }

  // Anything else relative (rare): prefix with CDN (or origin) as best effort
  const base = CDN_BASE || ORIGIN_BASE || "";
  return base ? `${base}${path}` : path;
}

/**
 * Convenience helper for CSS background-image values.
 * Usage: style={{ backgroundImage: normalizeBackground('/storage/v1/object/public/...') }}
 */
export function normalizeBackground(bg?: string) {
  if (!bg) return undefined;
  const url = resolveImageSrc(stripCssUrl(bg));
  // If the value already looks like a gradient, keep it as-is
  if (/^linear-gradient/i.test(bg)) return bg;
  return `url(${url})`;
}
