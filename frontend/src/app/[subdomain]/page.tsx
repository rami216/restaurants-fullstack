// frontend/src/app/[subdomain]/page.tsx

import React from "react";
import api from "@/lib/axios";
import { WebsiteData } from "@/components/builder/Properties";
import BuilderCanvas from "@/components/builder/BuilderCanvas"; // We'll reuse the canvas in "preview" mode

// This is a Server Component that fetches data on the server before rendering
async function getWebsiteData(subdomain: string): Promise<WebsiteData | null> {
  try {
    const response = await api.get(`/builder/public/${subdomain}`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch public website data:", error);
    return null;
  }
}

export default async function PublicWebsitePage({
  params,
}: {
  params: { subdomain: string };
}) {
  const websiteData = await getWebsiteData(params.subdomain);

  if (!websiteData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <h1 className="text-2xl font-bold">Website not found.</h1>
      </div>
    );
  }

  // Find the home page to display by default (usually the one with slug '/')
  const homePage =
    websiteData.pages.find((p) => p.slug === "/") || websiteData.pages[0];

  return (
    <div>
      {/* We can reuse the BuilderCanvas but we need to adapt it to have a "preview" mode.
        For now, we'll pass a special prop `isPreview={true}`.
        This will tell the canvas to hide all the editor controls.
      */}
      <BuilderCanvas
        page={homePage}
        navbar={websiteData.navbar}
        websiteData={websiteData}
        isPreview={true} // IMPORTANT: This tells the canvas to be read-only
        // Pass dummy functions for the editor props that are not needed in preview
        selection={{ type: null, id: null }}
        onSelect={() => {}}
        onUpdate={() => {}}
        onPageSwitch={() => {}}
      />
    </div>
  );
}
