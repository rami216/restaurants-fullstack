// lib/imageUrl.ts
import api from "@/lib/axios";

const PUBLIC_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || ""; // e.g. https://api.zygoflow.com
const PRIVATE_BASE = (api?.defaults?.baseURL as string) || ""; // axios base (dashboard)
const DEFAULT_BASE = PUBLIC_BASE || PRIVATE_BASE;

export function resolveImageSrc(path?: string): string {
  if (!path) return "";
  const s = path.trim();

  // already absolute (or data/blob) → return as-is
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  if (s.startsWith("//")) return `https:${s}`;

  // CSS url(...) → unwrap + recurse
  if (s.startsWith("url(")) {
    const inner = s.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
    return `url(${resolveImageSrc(inner)})`;
  }

  // backend-relative path
  if (s.startsWith("/")) {
    return DEFAULT_BASE ? `${DEFAULT_BASE}${s}` : s;
  }

  // other relative paths (e.g. "uploads/foo.jpg")
  return DEFAULT_BASE ? `${DEFAULT_BASE}/${s}` : s;
}
