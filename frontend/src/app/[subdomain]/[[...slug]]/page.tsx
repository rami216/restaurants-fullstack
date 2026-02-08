// app/[subdomain]/[[...slug]]/page.tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PublicCanvas from "@/components/builder/PublicCanvas";
import type { PublicWebsiteData } from "@/components/builder/Properties";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

// Your main hosts (requests to these should use the [subdomain] param)
const MAIN_HOST_SUFFIX = ".zygoflow.com";
const MAIN_HOSTS = new Set(["zygoflow.com", "www.zygoflow.com"]);

// async function fetchBySubdomain(subdomain: string): Promise<PublicWebsiteData> {
//   const res = await fetch(`${API_BASE}/builder/public/${subdomain}`, {
//     cache: "no-store",
//   });
//   if (!res.ok) throw new Error("not found");
//   return res.json();
// }
async function fetchBySubdomain(subdomain: string): Promise<PublicWebsiteData> {
  // ✅ NUCLEAR FIX: Append ?_t=${Date.now()} to the URL
  const res = await fetch(
    `${API_BASE}/builder/public/${subdomain}?_t=${Date.now()}`,
    {
      cache: "no-store",
      // headers: { "Cache-Control": "no-cache" } // Optional extra safety
    },
  );
  if (!res.ok) throw new Error("not found");
  return res.json();
}

// async function fetchByHost(host: string): Promise<PublicWebsiteData> {
//   const res = await fetch(
//     `${API_BASE}/public/by-host?host=${encodeURIComponent(host)}`,
//     { cache: "no-store" }
//   );
//   if (!res.ok) throw new Error("not found");
//   return res.json();
// }

async function fetchByHost(host: string): Promise<PublicWebsiteData> {
  // ✅ NUCLEAR FIX: Append &_t=${Date.now()}
  const res = await fetch(
    `${API_BASE}/builder/public/by-host?host=${encodeURIComponent(host)}&_t=${Date.now()}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("not found");
  return res.json();
}

export default async function PublicSite({
  params,
}: {
  params: { subdomain: string; slug?: string[] };
}) {
  const hdrs = await headers();

  // --- NEW DEBUGGING LINES ---
  console.log("--- DEBUGGING HEADERS on Next.js Server ---");
  console.log("Host Header:", hdrs.get("host"));
  console.log("X-Forwarded-Host Header:", hdrs.get("x-forwarded-host"));
  console.log("-----------------------------------------");
  // --- END DEBUGGING ---

  // **THE FIX**: Look for our custom header from the Worker first
  const hostRaw =
    hdrs.get("x-original-host") ||
    hdrs.get("x-forwarded-host") ||
    hdrs.get("host") ||
    "";
  const host = hostRaw.toLowerCase();

  let websiteData: PublicWebsiteData;
  try {
    const isMainHost = host.endsWith(MAIN_HOST_SUFFIX) || MAIN_HOSTS.has(host);

    if (isMainHost) {
      // e.g. https://www.zygoflow.com/<subdomain>/about
      websiteData = await fetchBySubdomain(params.subdomain);
    } else {
      // e.g. https://their-domain.com/about (custom domain)
      websiteData = await fetchByHost(host);
    }
  } catch {
    return notFound();
  }

  const path = "/" + (params.slug?.join("/") || "");
  const initialPage =
    websiteData.pages.find((p) => p.slug === path) ||
    websiteData.pages.find((p) => p.slug === "/") ||
    websiteData.pages[0];

  if (!initialPage) return notFound();

  return <PublicCanvas initialPage={initialPage} websiteData={websiteData} />;
}
