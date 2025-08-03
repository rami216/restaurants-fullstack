// frontend/src/app/createwebsite/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import ElementPalette from "@/components/builder/ElementPalette";
import BuilderCanvas from "@/components/builder/BuilderCanvas";
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
} from "@/components/builder/Properties";
import PropertyEditor from "@/components/builder/ElementPropertyEditor";
import { v4 as uuidv4 } from "uuid";
import { isEqual } from "lodash";
import Mustache from "mustache";

type DeletedItem = {
  type: "section" | "subsection" | "element" | "navbar_item";
  id: string;
};

const CreateWebsitePage = () => {
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

      if (websiteRes && websiteRes.status === 200) {
        setWebsiteData(websiteRes.data);
        // NEW: Keep a pristine copy to compare against for finding updates
        setOriginalWebsiteData(JSON.parse(JSON.stringify(websiteRes.data)));
        if (websiteRes.data.pages?.length > 0 && !activePageId) {
          setActivePageId(websiteRes.data.pages[0].page_id);
        }
      } else {
        setWebsiteData(null);
        setOriginalWebsiteData(null);
      }

      if (locationsRes && locationsRes.status === 200) {
        setLocations(locationsRes.data);
        if (locationsRes.data.length > 0) {
          setSelectedLocationId(locationsRes.data[0].location_id);
        }
      }

      if (
        restaurantRes &&
        restaurantRes.status === 200 &&
        restaurantRes.data.has_restaurant
      ) {
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
    try {
      await api.post("/builder/website", {});
      await fetchWebsiteData();
    } catch (error) {
      alert("Failed to create website.");
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

  const handleDeleteItem = () => {
    if (!selectedItem || !selection.type) return;
    if (selection.type === "navbar") {
      alert("The main navbar container cannot be deleted.");
      return;
    }

    const idKey = `${selection.type}_id` as keyof typeof selectedItem;
    const idToDelete = selectedItem[idKey];

    if (!isTempId(idToDelete)) {
      setDeletedItems((prev) => [
        ...prev,
        { type: selection.type as DeletedItem["type"], id: idToDelete },
      ]);
    }

    if (selection.type === "navbar_item") {
      const newNavbar = {
        ...navbar!,
        items: navbar!.items.filter((item) => item.item_id !== idToDelete),
      };
      setWebsiteData({ ...websiteData!, navbar: newNavbar });
    } else if (activePage) {
      let updatedSections = activePage.sections;
      if (selection.type === "section") {
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
  // --- START: NEW FUNCTION TO HANDLE SECTION GENERATION ---
  // const handleGenerateSection = async (prompt: string, sectionId: string) => {
  //   if (!activePage) return;

  //   try {
  //     const { data } = await api.post("/ai/generate-ai-section", { prompt });

  //     // The AI returns subsections. We need to assign new unique IDs to them and their elements.
  //     const newSubsections: Subsection[] = data.subsections.map((sub: any) => ({
  //       ...sub,
  //       subsection_id: `subsection_${Date.now()}_${Math.random()}`,
  //       elements: sub.elements.map((el: any) => ({
  //         ...el,
  //         element_id: `element_${Date.now()}_${Math.random()}`,
  //       })),
  //     }));

  //     const updatedPage = {
  //       ...activePage,
  //       sections: activePage.sections.map((section) => {
  //         if (section.section_id === sectionId) {
  //           // Replace the subsections of the selected section
  //           return {
  //             ...section,
  //             subsections: newSubsections,
  //           };
  //         }
  //         return section;
  //       }),
  //     };

  //     updateWebsiteData(updatedPage);
  //   } catch (err) {
  //     console.error("AI section generation failed:", err);
  //     alert("AI section generation failed. Please check the console.");
  //     // Re-throw to let the child component know the request failed
  //     throw err;
  //   }
  // };
  const handleGenerateSection = async (prompt: string, sectionId: string) => {
    if (!activePage) return;

    try {
      // The AI response now contains { properties: {...}, subsections: [...] }
      const { data } = await api.post("/ai/generate-ai-section", { prompt });

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

  // const handleRefineElement = async (prompt: string) => {
  //   if (!selectedItem || selection.type !== "element" || !activePage) return;

  //   try {
  //     // 1) Clone the element
  //     const currentElement = JSON.parse(
  //       JSON.stringify(selectedItem)
  //     ) as Element;
  //     const uniqueClassName = `ai-element-${
  //       currentElement.element_id.split("-")[0]
  //     }`;

  //     // 2) Build the “fullTemplate” for the AI
  //     let fullTemplate: string;
  //     if (currentElement.element_type === "AI" && currentElement.aiPayload) {
  //       // Already AI: reuse its full snippet (style + HTML + any <script>)
  //       fullTemplate = currentElement.aiPayload.aiTemplate;
  //     } else {
  //       // First-time: reconstruct raw HTML + inline styles + empty <style>
  //       const props = currentElement.properties || {};
  //       let htmlOnly = "";

  //       switch (currentElement.element_type) {
  //         case "TEXT": {
  //           const { content = "", style = {} } = props;
  //           htmlOnly = `<div class="${uniqueClassName}" style="
  //   color:${style.color ?? "inherit"};
  //   font-size:${style.fontSize ?? "1rem"};
  // ">${content}</div>`;
  //           break;
  //         }
  //         case "IMAGE": {
  //           const { src = "", alt = "", style = {} } = props;
  //           const url = src ? `${api.defaults.baseURL}${src}` : "";
  //           htmlOnly = `<img class="${uniqueClassName}" src="${url}" alt="${alt}" style="
  //   width:${style.width ?? "100%"};
  //   height:${style.height ?? "auto"};
  //   object-fit:cover;
  // " />`;
  //           break;
  //         }
  //         case "BUTTON": {
  //           const { text = "", style = {} } = props;
  //           htmlOnly = `<button class="${uniqueClassName}" style="
  //   background-color:${style.backgroundColor ?? "blue"};
  //   color:${style.color ?? "white"};
  //   padding:${style.padding ?? "10px 20px"};
  //   border:${style.border ?? "none"};
  //   border-radius:${style.borderRadius ?? "5px"};
  //   cursor:pointer;
  // ">${text}</button>`;
  //           break;
  //         }
  //         case "CATEGORY": {
  //           const {
  //             nameStyle = {},
  //             style: cardStyle = {},
  //             image_url,
  //             name = "",
  //           } = props;
  //           htmlOnly = `<div class="card ${uniqueClassName}" style="
  //   max-width:${cardStyle.maxWidth ?? "320px"};
  //   text-align:${cardStyle.textAlign ?? "center"};
  //   border:${cardStyle.border ?? "none"};
  // ">
  //   <img src="http://127.0.0.1:8000${image_url}" alt="${name}" style="width:100%;height:160px;object-fit:cover;" />
  //   <div style="padding:1rem;">
  //     <h4 style="
  //       color:${nameStyle.color ?? "inherit"};
  //       font-weight:${nameStyle.fontWeight ?? "bold"};
  //       font-style:${nameStyle.fontStyle ?? "normal"};
  //     ">${name}</h4>
  //   </div>
  // </div>`;
  //           break;
  //         }
  //         default: {
  //           // fallback for any other element types
  //           htmlOnly = `<div class="${uniqueClassName}"></div>`;
  //         }
  //       }

  //       fullTemplate = `<style></style>\n${htmlOnly}`;
  //     }

  //     // 3) Call the unified refine endpoint
  //     const { data } = await api.post<{
  //       template: string;
  //       script?: string;
  //     }>("/ai/refine-element", {
  //       prompt,
  //       full_template: fullTemplate,
  //       unique_class_name: `.${uniqueClassName}`,
  //     });

  //     // 4) Merge old & new <script> blocks, with correct typing
  //     const scriptRe = /<script[\s\S]*?<\/script>/g;
  //     const oldTmpl = currentElement.aiPayload?.aiTemplate ?? "";
  //     const oldScripts: string[] = oldTmpl.match(scriptRe) || [];
  //     const newScripts: string[] = data.script?.match(scriptRe) || [];
  //     const withoutScripts = data.template.replace(scriptRe, "").trim();
  //     const scriptsToKeep = oldScripts.filter((os) => !newScripts.includes(os));
  //     const mergedTemplate = [
  //       withoutScripts,
  //       ...newScripts,
  //       ...scriptsToKeep,
  //     ].join("\n");

  //     // 5) Build the new AiElementPayload
  //     const oldPayload: AiElementPayload = currentElement.aiPayload ?? {
  //       id: "",
  //       aiTemplate: "",
  //       properties: currentElement.properties || {},
  //       editableProps: [] as EditableProp[],
  //       script: undefined,
  //     };

  //     const newAiPayload: AiElementPayload = {
  //       id: `ai_payload_${Date.now()}`,
  //       aiTemplate: mergedTemplate,
  //       script: data.script ?? oldPayload.script,
  //       properties: oldPayload.properties,
  //       editableProps: oldPayload.editableProps,
  //     };

  //     // 6) Swap into your page state
  //     const refinedElement: Element = {
  //       ...currentElement,
  //       element_type: "AI",
  //       properties: currentElement.properties,
  //       aiPayload: newAiPayload,
  //     };

  //     const updatedSections = activePage.sections.map((section) => ({
  //       ...section,
  //       subsections: section.subsections.map((sub) => ({
  //         ...sub,
  //         elements: sub.elements.map((el) =>
  //           el.element_id === currentElement.element_id ? refinedElement : el
  //         ),
  //       })),
  //     }));

  //     updateWebsiteData({ ...activePage, sections: updatedSections });
  //     setSelection({ type: "element", id: refinedElement.element_id });
  //   } catch (err) {
  //     console.error("AI element refinement failed:", err);
  //     alert("AI element refinement failed.");
  //     throw err;
  //   }
  // };
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
        htmlOnly = `<iframe src="${props.src}" style="width:100%; height:300px; border:0;" allowfullscreen="" loading="lazy"></iframe>`;
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

  // The final, complete function
  // const handleRefineElement = async (prompt: string) => {
  //   if (!selectedItem || selection.type !== "element" || !activePage) return;

  //   try {
  //     const currentElement = JSON.parse(
  //       JSON.stringify(selectedItem)
  //     ) as Element;

  //     // 1. Prepare the component's state to send to the AI
  //     let currentState: AiElementPayload;
  //     // Determine if the element has a valid set of editable props to start with
  //     const hasExistingEditableProps =
  //       (currentElement.aiPayload?.editableProps?.length ?? 0) > 0;

  //     if (currentElement.element_type === "AI" && currentElement.aiPayload) {
  //       currentState = currentElement.aiPayload;
  //     } else {
  //       // For standard elements, build the initial state using helpers
  //       currentState = {
  //         id: `ai_payload_new_${Date.now()}`,
  //         aiTemplate: buildHtmlForElement(
  //           currentElement,
  //           `ai-element-${currentElement.element_id.split("-")[0]}`
  //         ),
  //         script: undefined,
  //         properties: currentElement.properties,
  //         editableProps: getEditablePropsForType(currentElement.element_type),
  //       };
  //     }

  //     // 2. Call the smart backend endpoint
  //     const { data: responsePayload } = await api.post<AiElementPayload>(
  //       "/ai/refine-element",
  //       {
  //         prompt,
  //         currentState: currentState,
  //       }
  //     );

  //     // 3. Intelligently construct the final payload
  //     const finalAiPayload: AiElementPayload = {
  //       id: `ai_payload_${Date.now()}`,
  //       aiTemplate: responsePayload.aiTemplate,
  //       script: responsePayload.script,
  //       properties: responsePayload.properties,

  //       // *** THE FINAL FIX ***
  //       // If the component already had good editable props (like the accordion), keep them.
  //       // If it was a broken component (like the text element with no props), accept the AI's repair.
  //       editableProps: hasExistingEditableProps
  //         ? currentState.editableProps
  //         : responsePayload.editableProps,
  //     };

  //     // 4. Create the final, updated element
  //     const refinedElement: Element = {
  //       ...currentElement,
  //       element_type: "AI",
  //       properties: finalAiPayload.properties,
  //       aiPayload: finalAiPayload,
  //     };

  //     // 5. Update the page state
  //     const updatedSections = activePage.sections.map((section) => ({
  //       ...section,
  //       subsections: section.subsections.map((sub) => ({
  //         ...sub,
  //         elements: sub.elements.map((el) =>
  //           el.element_id === currentElement.element_id ? refinedElement : el
  //         ),
  //       })),
  //     }));

  //     updateWebsiteData({ ...activePage, sections: updatedSections });
  //     setSelection({ type: "element", id: refinedElement.element_id });
  //   } catch (err) {
  //     console.error("AI element refinement failed:", err);
  //     alert("AI element refinement failed.");
  //   }
  // };
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

  const handleGeneratePage = async (prompt: string) => {
    if (!activePage || !prompt.trim()) return;

    try {
      const { data } = await api.post("/ai/generate-ai-page", { prompt });

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
        />
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">Website Builder</h1>
          {websiteData?.subdomain && (
            <a
              href={`/${websiteData.subdomain}`}
              target="_blank" // Opens in a new tab
              rel="noopener noreferrer"
              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded"
            >
              Preview
            </a>
          )}
          <button
            onClick={handleSaveChangesToDB}
            disabled={isSaving}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded disabled:bg-gray-400"
          >
            {isSaving ? "Saving..." : "Save All Changes"}
          </button>
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
            onGeneratePage={handleGeneratePage} // <-- ADD THIS PROP
          />
        </main>
      </div>
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
          onUpdateWebsite={(updatedWebsite) => setWebsiteData(updatedWebsite)}
          onDelete={handleDeleteItem}
          onCreatePage={handleCreatePage}
          clipboard={clipboard}
          onCopy={handleCopyElement}
          onPaste={handlePasteElement}
          onGenerateSection={handleGenerateSection}
          onMoveSection={handleMoveSection} // <-- ADD THIS PROP
          onRefineSection={handleRefineSection}
          onRefineElement={handleRefineElement} // <-- ADD THIS PROP
          onCreateStandalonePage={handleCreateStandalonePage} // <-- ADD THIS
        />
      </aside>
    </div>
  );
};

export default CreateWebsitePage;
