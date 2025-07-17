// frontend/src/components/builder/BuilderCanvas.tsx

"use client";

import React from "react";
import {
  Page,
  Selection,
  Section as SectionType,
  Subsection as SubsectionType,
  Element as ElementType,
} from "./Properties";
import { Plus } from "lucide-react";

interface BuilderCanvasProps {
  page: Page | undefined;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onUpdate: (updatedPage: Page) => void;
}

const BuilderCanvas: React.FC<BuilderCanvasProps> = ({
  page,
  selection,
  onUpdate,
  onSelect,
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
              <h4 className="font-bold text-xl text-gray-800">
                {props.name || "Category Name"}
              </h4>
            </div>
          </div>
        );

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
    <div className="space-y-4">
      {page.sections.map((section) => (
        <div
          key={section.section_id}
          onClick={() => onSelect({ type: "section", id: section.section_id })}
          className={`p-4 border-2 rounded-lg transition-all cursor-pointer ${
            selection.type === "section" && selection.id === section.section_id
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
            {section.subsections.map((subsection) => (
              <div
                key={subsection.subsection_id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect({
                    type: "subsection",
                    id: subsection.subsection_id,
                  });
                }}
                className={`p-4 border-2 rounded-lg min-h-[100px] flex-1 flex flex-col items-stretch transition-all ${
                  // Added flex-1 and items-stretch
                  selection.type === "subsection" &&
                  selection.id === subsection.subsection_id
                    ? "border-green-500"
                    : "border-dashed border-gray-400"
                }`}
                style={subsection.properties}
              >
                {subsection.elements.map((element) => (
                  <div
                    key={element.element_id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect({ type: "element", id: element.element_id });
                    }}
                    className={`p-2 rounded transition-all w-full ${
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
            ))}
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
  );
};

export default BuilderCanvas;
