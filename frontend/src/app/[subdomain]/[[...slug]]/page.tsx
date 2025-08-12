//subdomain/[[...slug]]/page.tsx
"use client";
import PublicCanvas from "@/components/builder/PublicCanvas";
import api from "@/lib/axios";
import { PublicWebsiteData } from "@/components/builder/Properties";
import { useEffect, useState } from "react";

export default function PreviewPage({
  params,
}: {
  params: { subdomain: string; slug?: string[] };
}) {
  const [websiteData, setWebsiteData] = useState<PublicWebsiteData | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWebsiteData = async () => {
      try {
        const { data } = await api.get<PublicWebsiteData>(
          `/builder/public/${params.subdomain}`,
          {
            headers: {
              "Cache-Control": "no-store",
            },
          }
        );
        setWebsiteData(data);
      } catch (error) {
        console.error("Failed to fetch website data:", error);
        setWebsiteData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWebsiteData();
  }, [params.subdomain]);

  if (loading) {
    return <p>Loading preview...</p>;
  }

  if (!websiteData) {
    return <p>Not found</p>;
  }

  const path = "/" + (params.slug?.join("/") || "");
  const initialPage =
    websiteData.pages.find((p) => p.slug === path) ||
    websiteData.pages.find((p) => p.slug === "/") ||
    websiteData.pages[0];

  return <PublicCanvas initialPage={initialPage} websiteData={websiteData} />;
}
