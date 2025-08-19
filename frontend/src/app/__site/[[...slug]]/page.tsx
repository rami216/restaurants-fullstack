// app/__site/[[...slug]]/page.tsx
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import PublicCanvas from "@/components/builder/PublicCanvas";
import type { PublicWebsiteData } from "@/components/builder/Properties";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ||
  "http://localhost:8000";

async function fetchByHost(host: string): Promise<PublicWebsiteData> {
  const res = await fetch(
    `${API_BASE}/builder/public/by-host?host=${encodeURIComponent(host)}`,
    { cache: "no-store" }
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
  const host = (
    hdrs.get("x-forwarded-host") ||
    hdrs.get("host") ||
    ""
  ).toLowerCase();

  let websiteData: PublicWebsiteData;
  try {
    websiteData = await fetchByHost(host);
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
