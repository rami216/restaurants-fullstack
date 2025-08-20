// //subdomain/[[...slug]]/page.tsx
// "use client";
// import PublicCanvas from "@/components/builder/PublicCanvas";
// import api from "@/lib/axios";
// import { PublicWebsiteData } from "@/components/builder/Properties";
// import { useEffect, useState } from "react";

// export default function PreviewPage({
//   params,
// }: {
//   params: { subdomain: string; slug?: string[] };
// }) {
//   const [websiteData, setWebsiteData] = useState<PublicWebsiteData | null>(
//     null
//   );
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     const fetchWebsiteData = async () => {
//       try {
//         const { data } = await api.get<PublicWebsiteData>(
//           `/builder/public/${params.subdomain}`,
//           {
//             headers: {
//               "Cache-Control": "no-store",
//             },
//           }
//         );
//         setWebsiteData(data);
//       } catch (error) {
//         console.error("Failed to fetch website data:", error);
//         setWebsiteData(null);
//       } finally {
//         setLoading(false);
//       }
//     };

//     fetchWebsiteData();
//   }, [params.subdomain]);

//   if (loading) {
//     return <p>Loading preview...</p>;
//   }

//   if (!websiteData) {
//     return <p>Not found</p>;
//   }

//   const path = "/" + (params.slug?.join("/") || "");
//   const initialPage =
//     websiteData.pages.find((p) => p.slug === path) ||
//     websiteData.pages.find((p) => p.slug === "/") ||
//     websiteData.pages[0];

//   return <PublicCanvas initialPage={initialPage} websiteData={websiteData} />;
// }
// app/[subdomain]/[[...slug]]/page.tsx
// app/[subdomain]/[[...slug]]/page.tsx
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

async function fetchBySubdomain(subdomain: string): Promise<PublicWebsiteData> {
  const res = await fetch(`${API_BASE}/builder/public/${subdomain}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("not found");
  return res.json();
}

async function fetchByHost(host: string): Promise<PublicWebsiteData> {
  const res = await fetch(
    `${API_BASE}/builder/public/by-host?host=${encodeURIComponent(host)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("not found");
  return res.json();
}

export default async function PublicSite({
  params,
}: {
  params: { subdomain: string; slug?: string[] };
}) {
  // In some Next versions types say Promise<ReadonlyHeaders>, so just await it.
  const hdrs = await headers();
  const hostRaw = hdrs.get("x-forwarded-host") || hdrs.get("host") || "";
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
