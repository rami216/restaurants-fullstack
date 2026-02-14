// app/__site/[[...slug]]/page.tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PublicCanvas from "@/components/builder/PublicCanvas";
import type { PublicWebsiteData } from "@/components/builder/Properties";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:8000";

async function fetchByHost(host: string): Promise<PublicWebsiteData> {
  const res = await fetch(
    `${API_BASE}/builder/public/by-host?host=${encodeURIComponent(host)}&_t=${Date.now()}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error("not found");
  return res.json();
}

export default async function PublicCustomDomain({
  params,
}: {
  params: { slug?: string[] };
}) {
  const hdrs = await headers();

  // --- NEW DEBUGGING LINES: SHOW ME EVERYTHING ---
  console.log("--- DEBUGGING ALL HEADERS (__site) ---");
  const allHeaders: Record<string, string> = {};
  hdrs.forEach((value, key) => {
    allHeaders[key] = value;
  });
  console.log(JSON.stringify(allHeaders, null, 2));
  console.log("----------------------------------------");
  // --- END DEBUGGING ---

  const hostRaw =
    hdrs.get("x-original-host") ||
    hdrs.get("x-forwarded-host") ||
    hdrs.get("host") ||
    "";
  const host = hostRaw.toLowerCase();

  let websiteData: PublicWebsiteData;
  try {
    websiteData = await fetchByHost(host);
  } catch (err) {
    console.error("Failed to fetch custom domain data for host:", host, err);
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
