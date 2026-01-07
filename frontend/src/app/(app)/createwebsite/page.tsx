// frontend/src/app/createwebsite/page.tsx

"use client";
export const dynamic = "force-dynamic"; // Add this line here!
import React, { useState, useEffect, Suspense } from "react";
import api from "@/lib/axios";
import ElementPalette from "@/components/builder/ElementPalette";
import BuilderCanvas from "@/components/builder/BuilderCanvas";
import { buildPublicUrl } from "@/lib/publicUrl";

import {
  WebsiteData,
  Page,
  Selection,
  Location,
  Category,
  Navbar,
  Element,
  Subsection,
  Section,
  AiElementPayload,
  EditableProp,
  AccordionItem,
  PublicOptionGroup,
  FormField,
} from "@/components/builder/Properties";
import PropertyEditor from "@/components/builder/ElementPropertyEditor";
import { v4 as uuidv4 } from "uuid";
import { isEqual } from "lodash";
import Mustache from "mustache";
import { useRouter } from "next/navigation"; // ⬅️ add this at the top

type DeletedItem = {
  type: "section" | "subsection" | "element" | "navbar_item";
  id: string;
};

const CreateWebsitePage = () => {
  const router = useRouter(); // ⬅️ add this
  const [subdomain, setSubdomain] = useState(""); // ✅ 1. Add state for the subdomain input

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [websiteData, setWebsiteData] = useState<WebsiteData | null>(null);
  // NEW: State to store a snapshot of the original data for comparison
  const [originalWebsiteData, setOriginalWebsiteData] =
    useState<WebsiteData | null>(null);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>({
    type: null,
    id: null,
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isPaletteExpanded, setIsPaletteExpanded] = useState(true);
  const [isPropertiesExpanded, setIsPropertiesExpanded] = useState(true);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);

  // --- START: ADD STATE FOR CLIPBOARD ---
  const [clipboard, setClipboard] = useState<Element | null>(null);
  // --- END: ADD STATE FOR CLIPBOARD ---

  const isTempId = (id: string) =>
    typeof id === "string" &&
    !id.match(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );

  const handleMoveSection = (sectionId: string, direction: "up" | "down") => {
    if (!activePage) return;

    const sections = [...activePage.sections];
    const index = sections.findIndex((s) => s.section_id === sectionId);

    // Stop if the section is already at the top or bottom
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === sections.length - 1)
    ) {
      return;
    }

    const newIndex = direction === "up" ? index - 1 : index + 1;

    // Swap the elements
    const movedSection = sections.splice(index, 1)[0];
    sections.splice(newIndex, 0, movedSection);

    // Update the 'position' property for all sections to reflect the new order
    const updatedSections = sections.map((section, pos) => ({
      ...section,
      position: pos,
    }));

    updateWebsiteData({ ...activePage, sections: updatedSections });
  };

  const fetchWebsiteData = async () => {
    setLoading(true);
    try {
      const [websiteRes, locationsRes, restaurantRes] = await Promise.all([
        api.get("/builder/website").catch((e) => e.response),
        api.get("/locations/has-location").catch((e) => e.response),
        api.get("/restaurants/has-restaurant").catch((e) => e.response),
      ]);

      // 1) Website
      if (websiteRes?.status === 200 && websiteRes.data) {
        setWebsiteData(websiteRes.data);
        setOriginalWebsiteData(JSON.parse(JSON.stringify(websiteRes.data)));
        if (websiteRes.data.pages?.length > 0 && !activePageId) {
          setActivePageId(websiteRes.data.pages[0].page_id);
        }
      } else if (websiteRes?.status === 404) {
        // Try to create one on the fly
        console.log("[builder] No website yet — creating…");
        const createRes = await api.post("/builder/website", {});
        const fresh = await api.get("/builder/website");
        setWebsiteData(fresh.data);
        setOriginalWebsiteData(JSON.parse(JSON.stringify(fresh.data)));
        if (fresh.data.pages?.length > 0) {
          setActivePageId(fresh.data.pages[0].page_id);
        }
      } else {
        console.warn(
          "[builder] /builder/website returned:",
          websiteRes?.status,
          websiteRes?.data
        );
        setWebsiteData(null);
        setOriginalWebsiteData(null);
      }

      // 2) Locations
      if (locationsRes?.status === 200) {
        setLocations(locationsRes.data);
        if (locationsRes.data.length > 0) {
          setSelectedLocationId(locationsRes.data[0].location_id);
        }
      }

      // 3) Restaurant & categories
      if (restaurantRes?.status === 200 && restaurantRes.data?.has_restaurant) {
        const rId = restaurantRes.data.restaurant_id;
        setRestaurantId(rId);
        const categoriesRes = await api.get(`/restaurants/categories/${rId}`);
        setCategories(categoriesRes.data);
      }
    } catch (error) {
      console.error("Error fetching initial data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWebsiteData();
  }, []);

  const handleCreateStandalonePage = async (title: string) => {
    if (!websiteData) return;
    try {
      const slug = `/${title.toLowerCase().replace(/\s+/g, "-")}`;
      const response = await api.post("/builder/pages/standalone", {
        website_id: websiteData.website_id,
        title,
        slug,
      });
      await fetchWebsiteData();
      setActivePageId(response.data.page_id); // Switch to the new page
    } catch (error) {
      console.error("Failed to create standalone page:", error);
      alert("Error creating standalone page.");
    }
  };

  const handleCreateWebsite = async () => {
    const formattedSubdomain = subdomain.trim().toLowerCase();
    if (!formattedSubdomain) {
      alert("Please enter a subdomain.");
      return;
    }

    try {
      await api.post("/builder/website", { subdomain: formattedSubdomain });
      await fetchWebsiteData();
    } catch (error: any) {
      // Type error as 'any' to safely access nested properties

      // ✅ Get the specific error message from the backend response if it exists
      const detail = error.response?.data?.detail;

      // ✅ Show the specific message, or a fallback if none is available
      alert(`Failed to create website: ${detail || error.message}`);

      console.error(error);
    }
  };

  // --- UPDATED: Fully implemented efficient save logic ---
  const handleSaveChangesToDB = async () => {
    if (!websiteData || !activePageId || !originalWebsiteData) return;
    setIsSaving(true);

    try {
      // --- 1. Process Deletions First ---
      const deletePromises = deletedItems.map((item) => {
        if (!isTempId(item.id)) {
          return api.delete(`/builder/${item.type}s/${item.id}`);
        }
        return Promise.resolve();
      });
      await Promise.all(deletePromises);
      setDeletedItems([]);

      // --- 2. Process Page Content Creates and Updates ---
      const activePageData = websiteData.pages.find(
        (p) => p.page_id === activePageId
      );
      const originalPageData = originalWebsiteData.pages.find(
        (p) => p.page_id === activePageId
      );

      if (!activePageData || !originalPageData)
        throw new Error("Active page data not found");

      const originalItems = new Map();
      originalPageData.sections.forEach((s) => {
        originalItems.set(s.section_id, s);
        s.subsections.forEach((sub) => {
          originalItems.set(sub.subsection_id, sub);
          sub.elements.forEach((el) => originalItems.set(el.element_id, el));
        });
      });

      for (const [s_idx, section] of activePageData.sections.entries()) {
        let sectionId = section.section_id;
        if (isTempId(sectionId)) {
          const res = await api.post("/builder/sections", {
            page_id: activePageId,
            section_type: section.section_type,
            position: s_idx,
            properties: section.properties,
          });
          sectionId = res.data.section_id;
        } else {
          const originalSection = originalItems.get(sectionId);
          if (
            originalSection &&
            (!isEqual(originalSection.properties, section.properties) ||
              originalSection.position !== s_idx)
          ) {
            await api.put(`/builder/sections/${sectionId}`, {
              position: s_idx,
              properties: section.properties,
            });
          }
        }

        for (const [sub_idx, subsection] of section.subsections.entries()) {
          let subsectionId = subsection.subsection_id;
          if (isTempId(subsectionId)) {
            const res = await api.post("/builder/subsections", {
              section_id: sectionId,
              position: sub_idx,
              properties: subsection.properties,
            });
            subsectionId = res.data.subsection_id;
          } else {
            const originalSubsection = originalItems.get(subsectionId);
            if (
              originalSubsection &&
              (!isEqual(originalSubsection.properties, subsection.properties) ||
                originalSubsection.position !== sub_idx)
            ) {
              await api.put(`/builder/subsections/${subsectionId}`, {
                position: sub_idx,
                properties: subsection.properties,
              });
            }
          }

          for (const [el_idx, element] of subsection.elements.entries()) {
            if (isTempId(element.element_id)) {
              await api.post("/builder/elements", {
                subsection_id: subsectionId,
                element_type: element.element_type,
                position: el_idx,
                properties: element.properties,
                aiPayload: element.aiPayload,
              });
            } else {
              const originalElement = originalItems.get(element.element_id);
              if (
                originalElement &&
                (originalElement.element_type !== element.element_type || // <-- ADD THIS CHECK
                  !isEqual(originalElement.properties, element.properties) ||
                  !isEqual(originalElement.aiPayload, element.aiPayload) ||
                  originalElement.position !== el_idx)
              ) {
                await api.put(`/builder/elements/${element.element_id}`, {
                  position: el_idx,
                  element_type: element.element_type, // <-- ADD THIS LINE TO THE PAYLOAD
                  properties: element.properties,
                  aiPayload: element.aiPayload,
                });
              }
            }
          }
        }
      }

      // --- 3. Process Navbar Property Updates ---
      if (websiteData.navbar && originalWebsiteData.navbar) {
        if (
          !isEqual(
            websiteData.navbar.properties,
            originalWebsiteData.navbar.properties
          )
        ) {
          await api.put(`/builder/navbars/${websiteData.navbar.navbar_id}`, {
            properties: websiteData.navbar.properties,
          });
        }
      }

      alert("All changes saved successfully!");
      await fetchWebsiteData();
    } catch (error) {
      console.error("Failed to save changes:", error);
      alert("An error occurred while saving. Please check the console.");
    } finally {
      setIsSaving(false);
    }
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
  const navbar = websiteData?.navbar || null;

  const findSelectedItem = () => {
    if (!selection.id || !websiteData) return null;
    if (selection.type === "navbar") return navbar;
    if (selection.type === "navbar_item")
      return (
        navbar?.items.find((item) => item.item_id === selection.id) || null
      );
    if (!activePage) return null;
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
  const handleDeleteItem = async (
    itemToDelete: any,
    type: Selection["type"]
  ) => {
    if (!itemToDelete || !type) return;

    // --- 1. PROMPT USER FOR CONFIRMATION ---
    const isDataApp =
      type === "element" &&
      (itemToDelete.properties?.originalType === "DATA_TABLE" ||
        itemToDelete.properties?.originalType === "DATA_VIEW");

    const confirmMessage = isDataApp
      ? "Are you sure? Deleting this element will also permanently delete its data table and all submitted data."
      : `Are you sure you want to delete this ${type}?`;

    if (!confirm(confirmMessage)) {
      return; // User cancelled the action
    }

    // --- 2. PERFORM IMMEDIATE DELETION OF ASSOCIATED DATA (YOUR IDEA) ---
    try {
      // A. If it's a Data App, delete its schema from the DB immediately.
      if (isDataApp && itemToDelete.properties?.schema_id) {
        await api.delete(
          `/builder/schemas/by-element/${itemToDelete.element_id}`
        );
      }

      // B. If it's an Image/Video, delete its file from storage immediately.
      if (
        type === "element" &&
        ["IMAGE", "VIDEO"].includes(itemToDelete.element_type)
      ) {
        const fileUrl =
          itemToDelete.properties?.src || itemToDelete.properties?.image_url;
        if (fileUrl && fileUrl.includes("/storage/v1/object/public/")) {
          const url = new URL(fileUrl);
          const pathParts = url.pathname.split("/public/");
          const [bucket, ...objectPathParts] = pathParts[1].split("/");
          const objectPath = objectPathParts.join("/");
          await api.post("/uploads/delete-object", {
            bucket,
            path: objectPath,
          });
        }
      }
    } catch (error) {
      console.error(
        "An error occurred during immediate deletion of associated resources:",
        error
      );
      // We can alert the user but still proceed to remove the item from the UI
      alert(
        "An error occurred while trying to delete associated data. The element will be removed from the page, but please save your work to finalize all changes."
      );
    }

    // --- 3. QUEUE THE UI ELEMENT FOR DELETION ON SAVE (YOUR EXISTING LOGIC) ---
    const idKey = `${type}_id` as keyof typeof itemToDelete;
    const idToDelete = itemToDelete[idKey];
    if (!isTempId(idToDelete)) {
      setDeletedItems((prev) => [
        ...prev,
        { type: type as any, id: idToDelete },
      ]);
    }

    // --- 4. REMOVE ITEM FROM LOCAL REACT STATE ---
    if (activePage) {
      let updatedSections = activePage.sections;
      if (type === "section") {
        updatedSections = activePage.sections.filter(
          (s) => s.section_id !== idToDelete
        );
      } else {
        updatedSections = activePage.sections.map((s) => ({
          ...s,
          subsections: s.subsections
            .map((sub) => ({
              ...sub,
              elements: sub.elements.filter(
                (el) => el.element_id !== idToDelete
              ),
            }))
            .filter((sub) => sub.subsection_id !== idToDelete),
        }));
      }
      updateWebsiteData({ ...activePage, sections: updatedSections });
    }

    // --- 5. CLEAR SELECTION ---
    setSelection({ type: null, id: null });
  };

  const handleCreatePage = async (title: string) => {
    if (!websiteData) return;
    try {
      const slug = `/${title.toLowerCase().replace(/\s+/g, "-")}`;
      const response = await api.post("/builder/pages", {
        website_id: websiteData.website_id,
        title,
        slug,
      });
      await fetchWebsiteData();
      setActivePageId(response.data.page_id);
    } catch (error) {
      console.error("Failed to create page:", error);
      alert("Error creating page.");
    }
  };

  //region copy-paste
  const handleCopyElement = () => {
    if (selectedItem && selection.type === "element") {
      setClipboard(selectedItem as Element);
      // You can add a toast notification here for better UX
      console.log("Element copied:", selectedItem);
    }
  };

  const handlePasteElement = () => {
    if (
      !clipboard ||
      selection.type !== "subsection" ||
      !selection.id ||
      !activePage
    ) {
      return;
    }

    // Create a deep copy with a new unique ID
    const newElement: Element = {
      ...JSON.parse(JSON.stringify(clipboard)),
      element_id: `element_${Date.now()}`,
    };

    const updatedPage = {
      ...activePage,
      sections: activePage.sections.map((section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => {
          if (subsection.subsection_id === selection.id) {
            return {
              ...subsection,
              elements: [...subsection.elements, newElement],
            };
          }
          return subsection;
        }),
      })),
    };

    updateWebsiteData(updatedPage);
  };
  //endregion copy
  const handleGenerateSection = async (prompt: string, sectionId: string) => {
    if (!activePage || !websiteData) return; // Also check for websiteData

    try {
      // The AI response now contains { properties: {...}, subsections: [...] }
      const { data } = await api.post("/ai/generate-ai-section", {
        prompt,
        website_id: websiteData.website_id,
      });

      // The AI returns subsections. We need to assign new unique IDs to them and their elements.
      const newSubsections: Subsection[] = data.subsections.map((sub: any) => ({
        ...sub,
        subsection_id: `subsection_${Date.now()}_${Math.random()}`,
        elements: sub.elements.map((el: any) => ({
          ...el,
          element_id: `element_${Date.now()}_${Math.random()}`,
        })),
      }));

      const updatedPage = {
        ...activePage,
        sections: activePage.sections.map((section) => {
          if (section.section_id === sectionId) {
            // THE FIX:
            // Replace the section's properties AND its subsections with the AI's response.
            return {
              ...section,
              properties: data.properties, // <-- THIS IS THE NEW LINE
              subsections: newSubsections,
            };
          }
          return section;
        }),
      };

      updateWebsiteData(updatedPage);
    } catch (err) {
      console.error("AI section generation failed:", err);
      alert("AI section generation failed. Please check the console.");
      // Re-throw to let the child component know the request failed
      throw err;
    }
  };
  // --- END: NEW FUNCTION TO HANDLE SECTION GENERATION ---

  const handleRefineSection = async (prompt: string) => {
    // This check is correct and important
    if (!selectedItem || selection.type !== "section" || !activePage) return;

    // THE FIX: Create a new, correctly typed variable after the check
    const currentSection = selectedItem as Section;

    try {
      // The API will return the complete, modified section object
      const { data: refinedSection } = await api.post("/ai/refine-ai-section", {
        prompt,
        section_json: currentSection, // Use the new variable
        website_id: websiteData?.website_id,
      });

      // Replace the old section with the refined one
      const updatedSections = activePage.sections.map((sec) =>
        // Use the new variable here as well
        sec.section_id === currentSection.section_id ? refinedSection : sec
      );

      updateWebsiteData({ ...activePage, sections: updatedSections });
      setSelection({ type: "section", id: refinedSection.section_id });
    } catch (err) {
      console.error("AI section refinement failed:", err);
      alert("AI section refinement failed.");
      throw err;
    }
  };

  interface RefineResponse {
    template: string;
    script?: string;
    properties: Record<string, any>;
    editableProps: EditableProp[];
  }

  function getEditablePropsForType(elementType: string): EditableProp[] {
    switch (elementType) {
      case "TEXT":
        return [
          { key: "content", label: "Content", type: "textarea" },
          { key: "style.color", label: "Text Color", type: "color" },
          { key: "style.fontSize", label: "Font Size", type: "text" },
        ];
      case "IMAGE":
        return [
          { key: "src", label: "Image Source", type: "text" },
          { key: "alt", label: "Alt Text", type: "text" },
        ];
      case "BUTTON":
        return [
          { key: "text", label: "Button Text", type: "text" },
          { key: "style.backgroundColor", label: "Background", type: "color" },
          { key: "style.color", label: "Text Color", type: "color" },
        ];
      case "MENU_ITEM":
        return [
          { key: "item_name", label: "Item Name", type: "text" },
          { key: "description", label: "Description", type: "textarea" },
          { key: "base_price", label: "Price", type: "number" },
          { key: "image_url", label: "Image URL", type: "text" },
        ];
      case "FORM":
        return [
          { key: "title", label: "Form Title", type: "text" },
          { key: "submitButton.text", label: "Button Text", type: "text" },
          {
            key: "style.backgroundColor",
            label: "Form Background",
            type: "color",
          },
          {
            key: "submitButton.style.backgroundColor",
            label: "Button Background",
            type: "color",
          },
          {
            key: "submitButton.style.color",
            label: "Button Text Color",
            type: "color",
          },
        ];
      // Add other cases for LIST, ACCORDION, etc. if they have editable fields
      default:
        return [];
    }
  }

  // HELPER 2: Builds a simple HTML representation for standard elements.
  function buildHtmlForElement(
    element: Element,
    uniqueClassName: string
  ): string {
    const props = element.properties || {};
    let htmlOnly = "";

    switch (element.element_type) {
      case "TEXT":
        htmlOnly = `<div style="color:${
          props.style?.color ?? "inherit"
        }; font-size:${props.style?.fontSize ?? "1rem"};">${
          props.content ?? ""
        }</div>`;
        break;
      case "IMAGE":
        const imgUrl = props.src ? `${api.defaults.baseURL}${props.src}` : "";
        htmlOnly = `<img src="${imgUrl}" alt="${
          props.alt ?? ""
        }" style="width:${props.style?.width ?? "100%"}; height:${
          props.style?.height ?? "auto"
        }; object-fit:cover;" />`;
        break;
      case "BUTTON":
        htmlOnly = `<button style="background-color:${
          props.style?.backgroundColor ?? "blue"
        }; color:${props.style?.color ?? "white"}; padding:${
          props.style?.padding ?? "10px 20px"
        }; border:none; border-radius:${props.style?.borderRadius ?? "5px"};">${
          props.text ?? "Button"
        }</button>`;
        break;
      case "CATEGORY":
        // --- FIX: Send only the relative path to the AI ---
        htmlOnly = `<div class="card" style="max-width:${
          props.style?.maxWidth ?? "320px"
        }; text-align:${props.style?.textAlign ?? "center"}; border:${
          props.style?.border ?? "none"
        };"><img src="${props.image_url || ""}" alt="${
          props.name
        }" style="width:100%;height:160px;object-fit:cover;" /><div style="padding:1rem;"><h4 style="color:${
          props.nameStyle?.color ?? "inherit"
        }; font-weight:${props.nameStyle?.fontWeight ?? "bold"};">${
          props.name
        }</h4></div></div>`;
        break;
      case "LIST":
        const listItems = (props.items || [])
          .map((item: string) => `<li>${item}</li>`)
          .join("");
        htmlOnly = `<ul style="list-style-position: inside; padding-left: 20px;">${listItems}</ul>`;
        break;
      case "FORM": {
        const formFields = (props.fields || [])
          .map(
            (field: FormField) =>
              `<div style="margin-bottom: 1rem;">
                   <label style="display: block; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem;">${field.label}</label>
                   <input type="text" name="${field.label}" placeholder="${field.placeholder}" style="width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px;" />
                 </div>`
          )
          .join("");

        const buttonText = props.submitButton?.text || "Submit";
        // Create a string of button styles to avoid issues with objects in templates
        const buttonStyle = props.submitButton?.style || {};
        const buttonStyleString = `background-color: ${
          buttonStyle.backgroundColor || "#333"
        }; color: ${
          buttonStyle.color || "white"
        }; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;`;

        htmlOnly = `<div style="padding: 1.5rem; border: 1px solid #eee; border-radius: 8px;">
            <h3 style="font-size: 1.5rem; font-weight: bold; margin-bottom: 1rem;">${
              props.title || "Form Title"
            }</h3>
            <form>
              ${formFields}
              <button type="submit" style="${buttonStyleString}">${buttonText}</button>
            </form>
          </div>`;
        break;
      }
      case "ACCORDION":
        const accordionItems = (props.items || [])
          .map(
            (item: AccordionItem) =>
              `<div style="border: 1px solid #ddd; margin-bottom: 5px;"><h3 style="margin:0; padding: 10px; background-color: #f7f7f7;">${item.question}</h3><div style="padding: 10px;">${item.answer}</div></div>`
          )
          .join("");
        htmlOnly = `<div>${accordionItems}</div>`;
        break;
      case "MAP":
        // --- THIS IS THE FIX ---
        // Include the relative container and absolute overlay div
        // to ensure the map is not interactive in the builder.
        htmlOnly = `<div class="relative" style="width:100%; height:300px;">
            <div class="absolute inset-0 z-10 cursor-pointer"></div>
            <iframe src="${props.src}" style="width:100%; height:100%; border:0; pointer-events: none;" allowfullscreen="" loading="lazy"></iframe>
          </div>`;
        break;
      case "DROPDOWN":
        const labelOption = props.label
          ? `<option disabled>${props.label}</option>`
          : "";
        const options = (props.options || [])
          .map(
            (opt: any) =>
              `<option value="${opt.action_value}">${opt.text}</option>`
          )
          .join("");
        htmlOnly = `<select style="border: 1px solid #ccc; padding: 8px; border-radius: 4px;">${labelOption}${options}</select>`;
        break;
      case "MENU_ITEM":
        // --- FIX: Send only the relative path to the AI ---
        const price = props.base_price?.toFixed(2) || "0.00";
        htmlOnly = `<div class="menu-item-card" style="border: 1px solid #eee; padding: 1rem; text-align: center;">${
          props.image_url
            ? `<img src="${props.image_url}" alt="${props.item_name}" style="width:100%; height:150px; object-fit:cover;" />`
            : ""
        }<h4>${props.item_name || "Menu Item"}</h4><p>${
          props.description || ""
        }</p><p style="font-weight: bold;">$${price}</p></div>`;
        break;
      default:
        htmlOnly = `<div></div>`;
    }
    return `<style></style>\n<div class="${uniqueClassName}">${htmlOnly}</div>`;
  }

  const handleRefineElement = async (prompt: string) => {
    if (!selectedItem || selection.type !== "element" || !activePage) return;

    try {
      const currentElement = JSON.parse(
        JSON.stringify(selectedItem)
      ) as Element;

      let currentState: AiElementPayload;
      let originalEditableProps: EditableProp[];

      if (currentElement.element_type === "AI" && currentElement.aiPayload) {
        currentState = currentElement.aiPayload;
        originalEditableProps = currentElement.aiPayload.editableProps;
      } else {
        originalEditableProps = getEditablePropsForType(
          currentElement.element_type
        );
        currentState = {
          id: `ai_payload_new_${Date.now()}`,
          aiTemplate: buildHtmlForElement(
            currentElement,
            `ai-element-${currentElement.element_id.split("-")[0]}`
          ),
          script: undefined,
          properties: currentElement.properties,
          editableProps: originalEditableProps,
        };
      }

      const { data: responsePayload } = await api.post<AiElementPayload>(
        "/ai/refine-element",
        {
          prompt,
          currentState: currentState,
          website_id: websiteData?.website_id,
        }
      );

      // Safely merge the original properties with the AI's response.
      const finalProperties = {
        ...currentState.properties,
        ...responsePayload.properties,

        // --- THIS IS THE FIX ---
        // Use the existing originalType if it's there; otherwise, set it for the first time.
        originalType:
          currentState.properties.originalType || currentElement.element_type,
      };

      const finalAiPayload: AiElementPayload = {
        id: `ai_payload_${Date.now()}`,
        aiTemplate: responsePayload.aiTemplate,
        script: responsePayload.script,
        properties: finalProperties,
        editableProps: originalEditableProps,
      };

      const refinedElement: Element = {
        ...currentElement,
        element_type: "AI",
        properties: finalAiPayload.properties,
        aiPayload: finalAiPayload,
      };

      // (The state update logic below is correct and remains the same)
      const updatedSections = activePage.sections.map((section) => ({
        ...section,
        subsections: section.subsections.map((sub) => ({
          ...sub,
          elements: sub.elements.map((el) =>
            el.element_id === currentElement.element_id ? refinedElement : el
          ),
        })),
      }));

      updateWebsiteData({ ...activePage, sections: updatedSections });
      setSelection({ type: "element", id: refinedElement.element_id });
    } catch (err) {
      console.error("AI element refinement failed:", err);
      alert("AI element refinement failed.");
    }
  };
  const handleRefineDataAppElement = async (prompt: string) => {
    if (
      !selectedItem ||
      selection.type !== "element" ||
      !activePage ||
      !websiteData
    )
      return;

    try {
      // The current state is simply the aiPayload of the selected element
      const currentState = (selectedItem as Element).aiPayload;
      if (!currentState) {
        alert("This element cannot be refined as it's not an AI component.");
        return;
      }

      const { data: refinedPayload } = await api.post(
        "/ai/refine-data-app-element",
        {
          prompt,
          currentState,
          website_id: websiteData.website_id,
        }
      );

      // Create the updated element
      const refinedElement: Element = {
        ...(selectedItem as Element),
        properties: refinedPayload.properties,
        aiPayload: refinedPayload,
      };

      // Update the state
      const updatedSections = activePage.sections.map((section) => ({
        ...section,
        subsections: section.subsections.map((sub) => ({
          ...sub,
          elements: sub.elements.map((el) =>
            // --- ✅ THE FIX IS HERE ---
            el.element_id === (selectedItem as Element).element_id
              ? refinedElement
              : el
          ),
        })),
      }));

      updateWebsiteData({ ...activePage, sections: updatedSections });
      setSelection({ type: "element", id: refinedElement.element_id });
    } catch (err) {
      console.error("AI data app refinement failed:", err);
      alert("AI data app refinement failed.");
      throw err; // Re-throw to inform the child component of the failure
    }
  };

  const handleGeneratePage = async (prompt: string) => {
    if (!activePage || !prompt.trim()) return;

    try {
      const { data } = await api.post("/ai/generate-ai-page", {
        prompt,
        website_id: websiteData?.website_id,
      });

      // Ensure data.sections is an array before mapping
      const sectionsFromAI = data.sections || [];

      const newSectionsWithIds = sectionsFromAI.map(
        (section: any, index: number) => ({
          ...section,
          section_id: `section_${Date.now()}_${Math.random()}`,
          section_type: section.section_type || "default",
          position: index,
          // THE FIX: Add a fallback to an empty array if subsections are missing
          subsections: (section.subsections || []).map((sub: any) => ({
            ...sub,
            subsection_id: `subsection_${Date.now()}_${Math.random()}`,
            // THE FIX: Add a fallback to an empty array if elements are missing
            elements: (sub.elements || []).map((el: any) => ({
              ...el,
              element_id: `element_${Date.now()}_${Math.random()}`,
            })),
          })),
        })
      );

      const updatedPage = { ...activePage, sections: newSectionsWithIds };
      updateWebsiteData(updatedPage);
    } catch (err) {
      console.error("AI page generation failed:", err);
      alert("AI page generation failed. Please check the console.");
    }
  };

  const previewHref = websiteData
    ? buildPublicUrl({
        subdomain: websiteData.subdomain,
        slug: "/", // or current page's slug if you want deep-link preview
        primaryDomain: websiteData.primary_custom_domain ?? null,
        primaryDomainVerified: Boolean(
          websiteData.primary_custom_domain_status
        ),
      })
    : "#";

  // ... all your big functions (handleSaveChangesToDB, etc.) stay exactly where they are ...

  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center h-screen">
          Loading Application...
        </div>
      }
    >
      {loading ? (
        <div className="flex justify-center items-center h-screen">
          Loading Builder...
        </div>
      ) : !websiteData ? (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-100 text-gray-800">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h2 className="text-2xl font-bold mb-4">Create Your Website</h2>
            <p className="mb-6">
              Choose a subdomain to get started. This will be your site's
              address.
            </p>
            <div className="flex items-center border rounded-lg overflow-hidden">
              <input
                type="text"
                placeholder="your-site-name"
                value={subdomain}
                onChange={(e) => setSubdomain(e.target.value)}
                className="p-3 w-full outline-none"
              />
              <span className="bg-gray-200 p-3 text-gray-600">
                www.zygoflow.com/yourdomainname
              </span>
            </div>
            <button
              onClick={handleCreateWebsite}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg mt-4 w-full"
            >
              Create My Website
            </button>
          </div>
        </div>
      ) : (
        <div className="flex h-screen bg-gray-200 font-sans">
          {/* --- LEFT ASIDE: Palette --- */}
          <aside
            className={`bg-white shadow-lg transition-all duration-300 ease-in-out ${
              isPaletteExpanded ? "w-64 p-4" : "w-16 p-2"
            }`}
          >
            <ElementPalette
              isExpanded={isPaletteExpanded}
              onToggle={() => setIsPaletteExpanded(!isPaletteExpanded)}
              selectedSubsectionId={
                selection.type === "subsection" ? selection.id : null
              }
              activePage={activePage || null}
              onUpdate={updateWebsiteData}
              locations={locations}
              selectedLocationId={selectedLocationId}
              onLocationChange={setSelectedLocationId}
              categories={categories}
              websiteId={websiteData.website_id}
            />
          </aside>

          {/* --- CENTER COLUMN: Canvas --- */}
          <div className="flex-1 flex flex-col">
            <header className="bg-gray-800 text-white p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold">Website Builder</h1>

                {/* Credits badge logic */}
                <div className="flex items-center gap-3 bg-white/10 rounded-md px-3 py-2">
                  {(() => {
                    const limitUsd = Number(
                      websiteData.ai_spend_limit_usd ?? 0
                    );
                    const spentUsd = Number(websiteData.monthly_spend_usd ?? 0);
                    const totalCredits = Math.round(limitUsd * 1000);
                    const usedCredits = Math.min(
                      totalCredits,
                      Math.round(spentUsd * 1000)
                    );
                    const remaining = Math.max(0, totalCredits - usedCredits);
                    const pct =
                      totalCredits > 0
                        ? Math.round((usedCredits / totalCredits) * 100)
                        : 0;

                    return (
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-medium">
                          Credits:{" "}
                          <span className="font-semibold">{remaining}</span> /{" "}
                          {totalCredits}
                        </div>
                        <div className="w-40 h-2 bg-white/20 rounded">
                          <div
                            className="h-2 bg-green-400 rounded"
                            style={{ width: `${pct}%` }}
                            title={`${pct}% used`}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    router.push(
                      `/builder/websites/${websiteData.website_id}/payments`
                    )
                  }
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded"
                >
                  Payments
                </button>
                {websiteData.subdomain && (
                  <>
                    <a
                      href="/builder/custom-domain"
                      className="inline-flex items-center px-3 py-1.5 rounded bg-slate-200 text-slate-900 text-sm"
                    >
                      Custom Domain
                    </a>
                    <a
                      href={previewHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded"
                    >
                      Preview
                    </a>
                  </>
                )}
                <button
                  onClick={handleSaveChangesToDB}
                  disabled={isSaving}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded disabled:bg-gray-400"
                >
                  {isSaving ? "Saving..." : "Save All Changes"}
                </button>
              </div>
            </header>

            <main className="flex-1 p-4 overflow-y-auto">
              <BuilderCanvas
                page={activePage}
                navbar={navbar}
                websiteData={websiteData}
                selection={selection}
                onSelect={setSelection}
                onUpdate={updateWebsiteData}
                onPageSwitch={setActivePageId}
                onGeneratePage={handleGeneratePage}
              />
            </main>
          </div>

          {/* --- RIGHT ASIDE: Properties --- */}
          <aside
            className={`bg-white shadow-lg transition-all duration-300 ease-in-out ${
              isPropertiesExpanded ? "w-80 p-4" : "w-16 p-2"
            }`}
          >
            <PropertyEditor
              isExpanded={isPropertiesExpanded}
              onToggle={() => setIsPropertiesExpanded(!isPropertiesExpanded)}
              selectedItem={selectedItem}
              selectionType={selection.type}
              activePage={activePage || null}
              websiteData={websiteData}
              onUpdate={updateWebsiteData}
              onUpdateWebsite={(updatedWebsite) =>
                setWebsiteData(updatedWebsite)
              }
              onDelete={handleDeleteItem}
              onCreatePage={handleCreatePage}
              clipboard={clipboard}
              onCopy={handleCopyElement}
              onPaste={handlePasteElement}
              onGenerateSection={handleGenerateSection}
              onMoveSection={handleMoveSection}
              onRefineSection={handleRefineSection}
              onRefineElement={handleRefineElement}
              onCreateStandalonePage={handleCreateStandalonePage}
              onRefineDataAppElement={handleRefineDataAppElement}
            />
          </aside>
        </div>
      )}
    </Suspense>
  );
};

export default CreateWebsitePage;
