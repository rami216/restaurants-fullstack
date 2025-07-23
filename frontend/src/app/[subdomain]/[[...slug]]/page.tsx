import PublicCanvas from "@/components/builder/PublicCanvas";
import api from "@/lib/axios";
import { PublicWebsiteData } from "@/components/builder/Properties";

export default async function PreviewPage({
  params,
}: {
  params: { subdomain: string; slug?: string[] };
}) {
  // 1. Fetch full site + locations
  const { data: websiteData } = await api.get<PublicWebsiteData>(
    `/builder/public/${params.subdomain}`
  );
  if (!websiteData) return <p>Not found</p>;

  // 2. Reconstruct the path from slug array
  const path = "/" + (params.slug?.join("/") || "");

  // 3. Pick the matching page, or fallback
  const initialPage =
    websiteData.pages.find((p) => p.slug === path) ||
    websiteData.pages.find((p) => p.slug === "/") ||
    websiteData.pages[0];

  return <PublicCanvas initialPage={initialPage} websiteData={websiteData} />;
}
