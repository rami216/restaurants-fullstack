// components/builder/ElementPalette.tsx

"use client";

import React from "react";
import { Page, Element as ElementType } from "./Properties";

interface ElementPaletteProps {
  selectedSubsectionId: string | null;
  activePage: Page | null;
  onUpdate: (updatedPage: Page) => void;
}

const availableElements = [
  {
    type: "TEXT",
    name: "Text",
    defaultProps: {
      content: "New Text Block",
      style: { fontSize: "1rem", color: "#000000" },
    },
  },
  {
    type: "BUTTON",
    name: "Button",
    defaultProps: { text: "Click Me", action_type: "LINK", action_value: "#" },
  },
  {
    type: "IMAGE",
    name: "Image",
    defaultProps: {
      src: "https://placehold.co/600x400",
      alt: "Placeholder Image",
    },
  },
  {
    type: "LIST",
    name: "List (UL)",
    defaultProps: {
      items: ["List item 1", "List item 2", "List item 3"],
      style: { listStyleType: "disc", color: "#000000", marginLeft: "20px" },
    },
  },
  {
    type: "DROPDOWN",
    name: "Dropdown Menu",
    defaultProps: {
      label: "Select an Option",
      options: [{ text: "Go to Home", action_value: "/" }],
    },
  },
];

const ElementPalette: React.FC<ElementPaletteProps> = ({
  selectedSubsectionId,
  activePage,
  onUpdate,
}) => {
  const handleAddElement = (elementType: string, defaultProps: any) => {
    if (!selectedSubsectionId || !activePage)
      return alert("Please select a layout block first.");

    const newElement: ElementType = {
      element_id: `element_${Date.now()}`,
      element_type: elementType,
      position: 999,
      properties: defaultProps,
    };

    const updatedPage = {
      ...activePage,
      sections: activePage.sections.map((section) => ({
        ...section,
        subsections: section.subsections.map((subsection) => {
          if (subsection.subsection_id === selectedSubsectionId) {
            return {
              ...subsection,
              elements: [...subsection.elements, newElement],
            };
          }
          return subsection;
        }),
      })),
    };
    onUpdate(updatedPage);
  };

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Add Elements</h2>
      <p
        className={`text-sm mb-4 ${
          selectedSubsectionId ? "text-green-600" : "text-red-600"
        }`}
      >
        {selectedSubsectionId
          ? "A layout block is selected."
          : "Select a layout block to add elements."}
      </p>
      <div className="space-y-2">
        {availableElements.map((el) => (
          <button
            key={el.type}
            onClick={() => handleAddElement(el.type, el.defaultProps)}
            disabled={!selectedSubsectionId}
            className="w-full text-left bg-gray-100 p-2 rounded hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
          >
            {el.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ElementPalette;
