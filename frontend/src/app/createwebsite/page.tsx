// app/createwebsite/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import ElementPalette from "@/components/builder/ElementPalette";
import BuilderCanvas from "@/components/builder/BuilderCanvas";
import { WebsiteData, Page, Selection } from "@/components/builder/Properties";
import PropertyEditor from "@/components/builder/ElementPropertyEditor";

const CreateWebsitePage = () => {
  const [loading, setLoading] = useState(true);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({
    type: null,
    id: null,
  });

  const fetchWebsiteData = async () => {
    setLoading(true);
    try {
      const response = await api.get("/builder/website");
      setWebsiteData(response.data);
      if (response.data.pages?.length > 0 && !activePageId) {
        setActivePageId(response.data.pages[0].page_id);
      }
    } catch (error) {
      if ((error as any).response?.status === 404) {
        setWebsiteData(null);
      } else {
        console.error("Error fetching website data:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsiteData();
  }, []);

  const handleCreateWebsite = async () => {
    try {
      await api.post("/builder/website", {});
      await fetchWebsiteData();
    } catch (error) {
      alert("Failed to create website.");
      console.error(error);
    }
  };

  const handleSaveChangesToDB = async () => {
    // This is where you would iterate through the local websiteData state
    // and send all the necessary PUT/POST requests to your backend API.
    // This is a complex task for a later stage.
    alert(
      "Saving to database is not implemented yet, but all changes are in the local state!"
    );
    console.log("Current state to save:", websiteData);
  };

  const updateWebsiteData = (updatedPage: Page) => {
    if (!websiteData) return;
    setWebsiteData({
      ...websiteData,
      pages: websiteData.pages.map((p) =>
        p.page_id === updatedPage.page_id ? updatedPage : p
      ),
    });
  };

  const activePage = websiteData?.pages.find((p) => p.page_id === activePageId);

  const findSelectedItem = () => {
    if (!selection.id || !activePage) return null;
    for (const section of activePage.sections) {
      if (selection.type === "section" && section.section_id === selection.id)
        return section;
      for (const subsection of section.subsections) {
        if (
          selection.type === "subsection" &&
          subsection.subsection_id === selection.id
        )
          return subsection;
        for (const element of subsection.elements) {
          if (
            selection.type === "element" &&
            element.element_id === selection.id
          )
            return element;
        }
      }
    }
    return null;
  };

  const selectedItem = findSelectedItem();

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        Loading Builder...
      </div>
    );

  if (!websiteData) {
    return (
      <div className="flex flex-col justify-center items-center h-screen bg-gray-100">
        <h2 className="text-2xl font-bold mb-4">No Website Found</h2>
        <p className="mb-6">Get started by creating your website.</p>
        <button
          onClick={handleCreateWebsite}
          className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
        >
          Create a Website
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-200 font-sans">
      <aside className="w-64 bg-white p-4 overflow-y-auto shadow-lg">
        <ElementPalette
          selectedSubsectionId={
            selection.type === "subsection" ? selection.id : null
          }
          activePage={activePage || null}
          onUpdate={updateWebsiteData}
        />
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Website Builder</h1>
          <button
            onClick={handleSaveChangesToDB}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded"
          >
            Save All Changes
          </button>
        </header>
        <main className="flex-1 p-4 overflow-y-auto">
          <BuilderCanvas
            page={activePage}
            selection={selection}
            onSelect={setSelection}
            onUpdate={updateWebsiteData}
          />
        </main>
      </div>

      <aside className="w-80 bg-white p-4 overflow-y-auto shadow-lg">
        <PropertyEditor
          selectedItem={selectedItem}
          selectionType={selection.type}
          activePage={activePage || null}
          onUpdate={updateWebsiteData}
          onDelete={() => setSelection({ type: null, id: null })}
        />
      </aside>
    </div>
  );
};

export default CreateWebsitePage;
