// // src/middleware.ts (or middleware.ts at Next app root)
// import type { NextRequest } from "next/server";
// import { NextResponse } from "next/server";

// // Treat these as "main" hosts that should NOT be rewritten
// const MAIN_HOST_SUFFIX = ".zygoflow.com";
// const MAIN_HOSTS = new Set(["zygoflow.com", "www.zygoflow.com"]);

// // Dev/local hosts to skip rewriting entirely
// const DEV_HOSTS = new Set([
//   "localhost:3000",
//   "127.0.0.1:3000",
//   "localhost",
//   "127.0.0.1",
// ]);

// export function middleware(req: NextRequest) {
//   const host = (
//     req.headers.get("x-forwarded-host") ||
//     req.headers.get("host") ||
//     ""
//   ).toLowerCase();
//   const path = req.nextUrl.pathname;

//   // Let framework assets & API pass
//   if (
//     path.startsWith("/_next/") ||
//     path.startsWith("/api/") ||
//     path === "/favicon.ico" ||
//     path === "/robots.txt" ||
//     path === "/sitemap.xml"
//   ) {
//     return NextResponse.next();
//   }

//   // Skip rewrite on dev/local
//   if (DEV_HOSTS.has(host)) return NextResponse.next();

//   // Skip rewrite on your main app hosts
//   if (host.endsWith(MAIN_HOST_SUFFIX) || MAIN_HOSTS.has(host)) {
//     return NextResponse.next();
//   }

//   // Otherwise it's a custom domain → rewrite to our internal route
//   const url = req.nextUrl.clone();
//   url.pathname = `/__site${path}`; // "/" -> "/__site"
//   return NextResponse.rewrite(url);
// }

// export const config = {
//   matcher: ["/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml).*)"],
// };
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const MAIN_HOST_SUFFIX = ".zygoflow.com";
const MAIN_HOSTS = new Set(["zygoflow.com", "www.zygoflow.com"]);
const DEV_HOSTS = new Set([
  "localhost:3000",
  "127.0.0.1:3000",
  "localhost",
  "127.0.0.1",
]);

export function middleware(req: NextRequest) {
  const host = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  ).toLowerCase();
  const path = req.nextUrl.pathname;

  // Let framework assets & API pass
  if (
    path.startsWith("/_next/") ||
    path.startsWith("/api/") ||
    path === "/favicon.ico" ||
    path === "/robots.txt" ||
    path === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // ✅ Never rewrite the builder/app pages
  if (path.startsWith("/builder")) return NextResponse.next();

  // Skip rewrite on dev/local
  if (DEV_HOSTS.has(host)) return NextResponse.next();

  // Skip rewrite on your main app hosts
  if (host.endsWith(MAIN_HOST_SUFFIX) || MAIN_HOSTS.has(host)) {
    return NextResponse.next();
  }

  // Otherwise it's a custom domain → rewrite to our internal route
  const url = req.nextUrl.clone();
  url.pathname = `/__site${path}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|robots.txt|sitemap.xml).*)"],
};
