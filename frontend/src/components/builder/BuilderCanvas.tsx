// frontend/src/components/builder/BuilderCanvas.tsx

"use client";

import React, { useState } from "react"; // Import useState
import {
  Page,
  Selection,
  Section as SectionType,
  Subsection as SubsectionType,
  Element as ElementType,
  FormField,
  AccordionItem,
  Navbar,
  NavbarItem,
  WebsiteData, // Import WebsiteData
} from "./Properties";
import { Plus, ChevronDown } from "lucide-react";

const Accordion = ({
  items,
  style,
}: {
  items: AccordionItem[];
  style: any;
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-2" style={{ width: style.width || "100%" }}>
      {(items || []).map((item, index) => (
        <div key={item.id} className="border rounded-md overflow-hidden">
          <button
            onClick={() => toggleItem(index)}
            className="w-full flex justify-between items-center p-3 font-semibold text-left"
            style={{ backgroundColor: style.questionBg || "#f3f4f6" }}
          >
            <span>{item.question}</span>
            <ChevronDown
              size={20}
              style={{
                color: style.iconColor || "#6b7280",
                transform:
                  openIndex === index ? "rotate(180deg)" : "rotate(0deg)",
              }}
              className="transition-transform duration-300"
            />
          </button>
          {openIndex === index && (
            <div
              className="p-3 text-gray-700"
              style={{ backgroundColor: style.answerBg || "#ffffff" }}
            >
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

interface BuilderCanvasProps {
  page: Page | undefined;
  navbar: Navbar | null; // Pass navbar data
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onUpdate: (updatedPage: Page) => void;
  onPageSwitch: (pageId: string) => void;
  websiteData: WebsiteData | null; // Add websiteData to props
}

const BuilderCanvas: React.FC<BuilderCanvasProps> = ({
  page,
  navbar,
  selection,
  onUpdate,
  onSelect,
  onPageSwitch,
  websiteData,
}) => {
  const handleAddSection = () => {
    if (!page) return;
    const newSection: SectionType = {
      section_id: `section_${Date.now()}`,
      section_type: "default",
      position: (page.sections?.length || 0) + 1,
      properties: {
        display: "flex",
        flexDirection: "row",
        gap: "1rem",
        padding: "2rem",
        backgroundColor: "#ffffff",
      },
      subsections: [],
    };
    const updatedPage = { ...page, sections: [...page.sections, newSection] };
    onUpdate(updatedPage);
  };

  const handleAddSubsection = (sectionId: string) => {
    if (!page) return;
    const updatedSections = page.sections.map((section) => {
      if (section.section_id === sectionId) {
        const newSubsection: SubsectionType = {
          subsection_id: `subsection_${Date.now()}`,
          position: (section.subsections?.length || 0) + 1,
          properties: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
          },
          elements: [],
        };
        return {
          ...section,
          subsections: [...section.subsections, newSubsection],
        };
      }
      return section;
    });
    onUpdate({ ...page, sections: updatedSections });
  };

  const renderElement = (element: ElementType) => {
    const props = element.properties || {};
    const style = props.style || {};
    const BACKEND_URL = "http://127.0.0.1:8000";

    switch (element.element_type) {
      case "FORM":
        const buttonStyle = props.submitButton?.style || {};
        const labelStyle = props.labelStyle || {}; // Get the label style object
        return (
          <div className="border rounded-lg" style={style}>
            <h3 className="text-2xl font-bold mb-4 text-gray-800">
              {props.title || "Form Title"}
            </h3>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {(props.fields || []).map((field: FormField) => (
                <div key={field.id}>
                  <label
                    className="block text-sm font-medium mb-1"
                    style={labelStyle}
                  >
                    {field.label}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                    readOnly
                  />
                </div>
              ))}
              <button type="submit" style={buttonStyle}>
                {props.submitButton?.text || "Submit"}
              </button>
            </form>
          </div>
        );

        return (
          <div className="p-4 border rounded-lg bg-gray-50" style={style}>
            <h3 className="text-2xl font-bold mb-4 text-gray-800">
              {props.title || "Form Title"}
            </h3>
            <form className="space-y-4">
              {(props.fields || []).map((field: FormField) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                  </label>
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                    readOnly // Make inputs read-only in the builder
                  />
                </div>
              ))}
              <button type="submit" style={buttonStyle}>
                {props.submitButton?.text || "Submit"}
              </button>
            </form>
          </div>
        );
      case "TEXT":
        return <div style={style}>{props.content || "New Text Block"}</div>;
      case "BUTTON":
        return <button style={style}>{props.text || "Button"}</button>;
      case "IMAGE":
        return (
          <img
            src={props.src || "https://placehold.co/600x400"}
            alt={props.alt || "placeholder"}
            style={style}
          />
        );
      case "LIST":
        return (
          <ul style={style}>
            {(props.items || []).map((item: string, index: number) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        );
      case "DROPDOWN":
        return (
          <select className="border border-gray-300 rounded p-2">
            {props.label && <option disabled>{props.label}</option>}
            {(props.options || []).map((opt: any, index: number) => (
              <option key={index} value={opt.action_value}>
                {opt.text}
              </option>
            ))}
          </select>
        );

      // This is the new case to render the menu item card
      case "MENU_ITEM":
        return (
          <div className="border rounded-lg p-4 bg-white shadow" style={style}>
            {props.image_url && (
              <img
                src={`${BACKEND_URL}${props.image_url}`}
                alt={props.item_name}
                className="w-full object-cover rounded-md mb-4"
                // Hide the image element if it fails to load
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <h4 className="font-bold text-lg text-gray-800">
              {props.item_name || "Menu Item"}
            </h4>
            <p className="text-sm text-gray-600 my-2">
              {props.description || "No description available."}
            </p>
            <p className="font-semibold text-right text-gray-800">
              ${props.base_price?.toFixed(2) || "0.00"}
            </p>
          </div>
        );
      case "CATEGORY":
        // Get the specific styles for the name, or default to an empty object
        const nameStyle = props.nameStyle || {};
        return (
          <div
            className="rounded-lg overflow-hidden bg-white shadow-md"
            style={style}
          >
            {props.image_url && (
              <img
                src={`${BACKEND_URL}${props.image_url}`}
                alt={props.name}
                className="w-full h-40 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            )}
            <div className="p-4">
              {/* Apply the nameStyle object directly to the h4 element */}
              <h4 className="font-bold text-xl text-gray-800" style={nameStyle}>
                {props.name || "Category Name"}
              </h4>
            </div>
          </div>
        );
      case "ACCORDION":
        // Render the new interactive Accordion component
        return <Accordion items={props.items || []} style={style} />;

      default:
        return (
          <div className="border p-2 bg-gray-300 text-black rounded">
            Unknown Element
          </div>
        );
    }
  };

  if (!page) {
    return (
      <div className="text-center p-10 text-gray-500">
        Select a page to start building.
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-inner">
      {/* --- NAVBAR RENDERING --- */}
      {navbar && (
        <nav
          onClick={() => onSelect({ type: "navbar", id: navbar.navbar_id })}
          className={`p-4 mb-4 border-2 rounded-lg transition-all cursor-pointer ${
            selection.type === "navbar" && selection.id === navbar.navbar_id
              ? "border-purple-500"
              : "border-dashed border-gray-300"
          }`}
          style={navbar.properties}
        >
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold">Your Logo</div>
            <div className="flex items-center space-x-4">
              {navbar.items.map((item: NavbarItem) => {
                const targetPage = websiteData?.pages.find(
                  (p) => p.slug === item.link_url
                );
                return (
                  <a
                    key={item.item_id}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (targetPage) {
                        onPageSwitch(targetPage.page_id);
                      }
                      onSelect({ type: "navbar_item", id: item.item_id });
                    }}
                    className={`px-3 py-2 rounded ${
                      selection.type === "navbar_item" &&
                      selection.id === item.item_id
                        ? "ring-2 ring-purple-500"
                        : ""
                    } ${
                      page?.page_id === targetPage?.page_id
                        ? "bg-purple-100 text-purple-700"
                        : ""
                    }`}
                  >
                    {item.text}
                  </a>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      <div className="space-y-4">
        {page.sections.map((section) => (
          <div
            key={section.section_id}
            onClick={() =>
              onSelect({ type: "section", id: section.section_id })
            }
            className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
              selection.type === "section" &&
              selection.id === section.section_id
                ? "border-blue-500"
                : "border-dashed border-gray-300"
            }`}
            style={section.properties}
          >
            <div
              className="flex flex-wrap"
              style={{
                display: "flex",
                flexDirection: section.properties.flexDirection,
                justifyContent: section.properties.justifyContent,
                alignItems: section.properties.alignItems,
                gap: section.properties.gap,
              }}
            >
              {section.subsections.map((subsection) => {
                // Construct dynamic styles for the subsection
                const subsectionStyle: React.CSSProperties = {
                  display: subsection.properties.display || "flex",
                  gap: subsection.properties.gap || "1rem",
                };

                if (subsection.properties.display === "grid") {
                  subsectionStyle.gridTemplateColumns =
                    subsection.properties.gridTemplateColumns ||
                    "repeat(2, 1fr)";
                } else {
                  // Default to flex properties
                  subsectionStyle.flexDirection =
                    subsection.properties.flexDirection || "column";
                  subsectionStyle.justifyContent =
                    subsection.properties.justifyContent || "flex-start";
                  subsectionStyle.alignItems =
                    subsection.properties.alignItems || "stretch";
                }

                return (
                  <div
                    key={subsection.subsection_id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({
                        type: "subsection",
                        id: subsection.subsection_id,
                      });
                    }}
                    className={`p-4 border-2 rounded-lg min-h-[100px] flex-1 transition-all ${
                      selection.type === "subsection" &&
                      selection.id === subsection.subsection_id
                        ? "border-green-500"
                        : "border-dashed border-gray-400"
                    }`}
                    style={subsectionStyle} // Apply the dynamic styles here
                  >
                    {subsection.elements.map((element) => (
                      <div
                        key={element.element_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect({ type: "element", id: element.element_id });
                        }}
                        className={`p-2 rounded transition-all ${
                          selection.type === "element" &&
                          selection.id === element.element_id
                            ? "ring-2 ring-offset-2 ring-pink-500"
                            : ""
                        }`}
                      >
                        {renderElement(element)}
                      </div>
                    ))}
                    {subsection.elements.length === 0 && (
                      <div className="text-gray-400 self-center mx-auto">
                        Add elements here
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddSubsection(section.section_id);
                }}
                className="flex items-center justify-center min-h-[100px] w-32 border-2 border-dashed border-gray-400 rounded-lg text-gray-400 hover:border-green-500 hover:text-green-500 transition-all"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>
        ))}
        <button
          onClick={handleAddSection}
          className="w-full py-4 border-2 border-dashed border-gray-400 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500"
        >
          + Add New Section
        </button>
      </div>
    </div>
  );
};

export default BuilderCanvas;
