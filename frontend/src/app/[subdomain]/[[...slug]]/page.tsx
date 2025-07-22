// app/[subdomain]/[[...slug]]/page.tsx
import PublicCanvas from "@/components/builder/PublicCanvas";
import api from "@/lib/axios";
import { WebsiteData } from "@/components/builder/Properties";

export default async function PreviewPage({
  params,
}: {
  params: { subdomain: string; slug?: string[] };
}) {
  // Fetch the site config for this subdomain
  const { data: websiteData } = await api.get<WebsiteData>(
    `/builder/public/${params.subdomain}`
  );
  if (!websiteData) return <p>Not found</p>;

  // Reconstruct the requested path ("/", "/about", "/pricing", etc.)
  const path = "/" + (params.slug?.join("/") || "");

  // Find the matching page or fallback to the root page
  const initialPage =
    websiteData.pages.find((p) => p.slug === path) ||
    websiteData.pages.find((p) => p.slug === "/") ||
    websiteData.pages[0];

  return <PublicCanvas initialPage={initialPage} websiteData={websiteData} />;
}
