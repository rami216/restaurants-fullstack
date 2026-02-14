// app/__site/[[...slug]]/page.tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PublicCanvas from "@/components/builder/PublicCanvas";
import type { PublicWebsiteData } from "@/components/builder/Properties";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 🚨 FIX 1: Added _URL to match your environment variables! 🚨
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

  // 🚨 FIX 2: Matched the header extraction perfectly with your subdomain file 🚨
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
    return notFound(); // <--- This was triggering because it was hitting localhost!
  }

  const path = "/" + (params.slug?.join("/") || "");
  const initialPage =
    websiteData.pages.find((p) => p.slug === path) ||
    websiteData.pages.find((p) => p.slug === "/") ||
    websiteData.pages[0];

  if (!initialPage) return notFound();

  return <PublicCanvas initialPage={initialPage} websiteData={websiteData} />;
}
