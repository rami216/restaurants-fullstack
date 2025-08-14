// imageUrl.ts (or inline near the top of the file)
import api from "./axios";
export function resolveImageSrc(path?: string): any {
  if (!path) return "";
  const BACKEND_URL = api.defaults.baseURL || "";

  // If it's already absolute, just return it
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  // If it's a CSS background-image value (url('...'))
  if (path.startsWith("url(")) {
    const inner = path.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
    return `url(${resolveImageSrc(inner)})`;
  }

  // If it starts with "/", prepend backend URL
  if (path.startsWith("/")) {
    return `${BACKEND_URL}${path}`;
  }

  // Fallback: return as is
  return path;
}
