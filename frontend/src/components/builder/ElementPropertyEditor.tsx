// components/builder/PropertyEditor.tsx

"use client";

import React, { useRef } from "react";
import { Selection, Page, FormField, AccordionItem } from "./Properties";
import {
  Trash2,
  PlusCircle,
  Bold,
  Italic,
  Underline,
  Upload,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

interface PropertyEditorProps {
  isExpanded: boolean;
  onToggle: () => void;
  selectedItem: any | null;
  selectionType: Selection["type"];
  activePage: Page | null;
  onUpdate: (updatedPage: Page) => void;
  onDelete: () => void;
}

const PropertyEditor: React.FC<PropertyEditorProps> = ({
  isExpanded,
  onToggle,
  selectedItem,
  selectionType,
  activePage,
  onUpdate,
  onDelete,
}) => {
  const renderNavbarEditor = () => {
    // ... (logic to edit navbar properties like background color)
    return <div>Navbar Editor</div>;
  };

  const renderNavbarItemEditor = () => {
    // ... (logic to edit navbar item text and link)
    return <div>Navbar Item Editor</div>;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete this ${selectionType}?`)) {
      onDelete(); // Just call the function passed from the parent
    }
  };
  if (!selectedItem || !selectionType || !activePage) {
    return (
      <div>
        <h2 className="text-xl font-bold mb-4">Properties</h2>
        <p className="text-gray-500">
          Select an item on the canvas to edit its properties.
        </p>
      </div>
    );
  }

  const updateItem = (updatedItem: any) => {
    const updatedPage = {
      ...activePage,
      sections: activePage.sections.map((section) => {
        if (
          section.section_id === updatedItem.section_id &&
          selectionType === "section"
        ) {
          return updatedItem;
        }
        return {
          ...section,
          subsections: section.subsections.map((subsection) => {
            if (
              subsection.subsection_id === updatedItem.subsection_id &&
              selectionType === "subsection"
            ) {
              return updatedItem;
            }
            return {
              ...subsection,
              elements: subsection.elements.map((element) =>
                element.element_id === updatedItem.element_id &&
                selectionType === "element"
                  ? updatedItem
                  : element
              ),
            };
          }),
        };
      }),
    };
    onUpdate(updatedPage);
  };

  const handlePropertyChange = (key: string, value: any) => {
    const newProperties = { ...selectedItem.properties, [key]: value };
    updateItem({ ...selectedItem, properties: newProperties });
  };

  const handleStyleChange = (key: string, value: any) => {
    const newProperties = {
      ...selectedItem.properties,
      style: { ...selectedItem.properties.style, [key]: value },
    };
    updateItem({ ...selectedItem, properties: newProperties });
  };

  // const handleDelete = () => {
  //   if (!confirm(`Are you sure you want to delete this ${selectionType}?`))
  //     return;
  //   let updatedSections = activePage.sections;

  //   if (selectionType === "section") {
  //     updatedSections = activePage.sections.filter(
  //       (s) => s.section_id !== selectedItem.section_id
  //     );
  //   } else if (selectionType === "subsection") {
  //     updatedSections = activePage.sections.map((s) => ({
  //       ...s,
  //       subsections: s.subsections.filter(
  //         (sub) => sub.subsection_id !== selectedItem.subsection_id
  //       ),
  //     }));
  //   } else if (selectionType === "element") {
  //     updatedSections = activePage.sections.map((s) => ({
  //       ...s,
  //       subsections: s.subsections.map((sub) => ({
  //         ...sub,
  //         elements: sub.elements.filter(
  //           (el) => el.element_id !== selectedItem.element_id
  //         ),
  //       })),
  //     }));
  //   }

  //   onUpdate({ ...activePage, sections: updatedSections });
  //   onDelete();
  // };
  const handleLocalImageSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const localUrl = URL.createObjectURL(file);
    handlePropertyChange("src", localUrl);
  };

  const renderSectionEditor = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Layout Direction (for subsections)
        </label>
        <select
          value={selectedItem.properties.flexDirection || "row"}
          onChange={(e) =>
            handlePropertyChange("flexDirection", e.target.value)
          }
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        >
          <option value="row">Horizontal (Columns)</option>
          <option value="column">Vertical (Rows)</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Justify Subsections
        </label>
        <select
          value={selectedItem.properties.justifyContent || "flex-start"}
          onChange={(e) =>
            handlePropertyChange("justifyContent", e.target.value)
          }
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        >
          <option value="flex-start">Start</option>
          <option value="center">Center</option>
          <option value="flex-end">End</option>
          <option value="space-between">Space Between</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Gap Between Subsections
        </label>
        <input
          type="text"
          value={selectedItem.properties.gap || "1rem"}
          onChange={(e) => handlePropertyChange("gap", e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          placeholder="e.g., 1rem, 16px"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Padding
        </label>
        <input
          type="text"
          value={selectedItem.properties.padding || "2rem"}
          onChange={(e) => handlePropertyChange("padding", e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Background Color
        </label>
        <input
          type="color"
          value={selectedItem.properties.backgroundColor || "#ffffff"}
          onChange={(e) =>
            handlePropertyChange("backgroundColor", e.target.value)
          }
          className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Background Image URL
        </label>
        <input
          type="text"
          value={selectedItem.properties.backgroundImage || ""}
          onChange={(e) =>
            handlePropertyChange("backgroundImage", e.target.value)
          }
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          placeholder="https://example.com/image.jpg"
        />
      </div>
    </div>
  );

  const renderSubsectionEditor = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Element Layout
        </label>
        <select
          value={selectedItem.properties.display || "flex"}
          onChange={(e) => {
            const newDisplay = e.target.value;
            handlePropertyChange("display", newDisplay);
            // Set default grid properties when switching if they don't exist
            if (newDisplay === "grid" && !selectedItem.properties.gridColumns) {
              const newProps = {
                ...selectedItem.properties,
                display: "grid",
                gridColumns: 2,
                gridTemplateColumns: "repeat(2, 1fr)",
              };
              updateItem({ ...selectedItem, properties: newProps });
            }
          }}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
        >
          <option value="flex">Flexbox (Vertical/Horizontal)</option>
          <option value="grid">Grid</option>
        </select>
      </div>

      {/* Conditional UI for Grid Layout */}
      {selectedItem.properties.display === "grid" && (
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Number of Columns
          </label>
          <input
            type="number"
            min="1"
            value={selectedItem.properties.gridColumns || ""}
            onChange={(e) => {
              const rawValue = e.target.value;
              // Update the property that holds the input's value. This allows typing.
              handlePropertyChange("gridColumns", rawValue);

              const columns = parseInt(rawValue, 10);
              // Only update the functional CSS property if the value is a valid, positive number.
              if (!isNaN(columns) && columns > 0) {
                handlePropertyChange(
                  "gridTemplateColumns",
                  `repeat(${columns}, 1fr)`
                );
              }
            }}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
      )}

      {/* Conditional UI for Flexbox Layout */}
      {(!selectedItem.properties.display ||
        selectedItem.properties.display === "flex") && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Flex Direction
            </label>
            <select
              value={selectedItem.properties.flexDirection || "column"}
              onChange={(e) =>
                handlePropertyChange("flexDirection", e.target.value)
              }
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="column">Vertical</option>
              <option value="row">Horizontal</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Justify Elements
            </label>
            <select
              value={selectedItem.properties.justifyContent || "flex-start"}
              onChange={(e) =>
                handlePropertyChange("justifyContent", e.target.value)
              }
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="flex-start">Start</option>
              <option value="center">Center</option>
              <option value="flex-end">End</option>
              <option value="space-between">Space Between</option>
            </select>
          </div>
        </>
      )}

      {/* Common Properties */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Gap Between Elements
        </label>
        <input
          type="text"
          value={selectedItem.properties.gap || "1rem"}
          onChange={(e) => handlePropertyChange("gap", e.target.value)}
          className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          placeholder="e.g., 1rem, 16px"
        />
      </div>
    </div>
  );
  const handleNameStyleChange = (key: string, value: any) => {
    if (!selectedItem) return;
    const newProperties = {
      ...selectedItem.properties,
      nameStyle: { ...selectedItem.properties.nameStyle, [key]: value },
    };
    updateItem({ ...selectedItem, properties: newProperties });
  };
  const handleLabelStyleChange = (key: string, value: any) => {
    if (!selectedItem) return;
    const newProperties = {
      ...selectedItem.properties,
      labelStyle: { ...selectedItem.properties.labelStyle, [key]: value },
    };
    updateItem({ ...selectedItem, properties: newProperties });
  };

  const renderElementEditor = () => {
    const toggleStyle = (
      styleKey: string,
      onValue: string,
      offValue: string
    ) => {
      const currentVal = selectedItem.properties.style?.[styleKey];
      const newVal = currentVal === onValue ? offValue : onValue;
      handleStyleChange(styleKey, newVal);
    };
    const toggleNameStyle = (
      styleKey: string,
      onValue: string,
      offValue: string
    ) => {
      const currentVal = selectedItem.properties.nameStyle?.[styleKey];
      const newVal = currentVal === onValue ? offValue : onValue;
      handleNameStyleChange(styleKey, newVal);
    };
    switch (selectedItem.element_type) {
      case "TEXT":
        const style = selectedItem.properties.style || {};
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Content
              </label>
              <textarea
                value={selectedItem.properties.content || ""}
                onChange={(e) =>
                  handlePropertyChange("content", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                rows={3}
              />
            </div>
            {/* --- NEW TEXT STYLE CONTROLS --- */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Styles
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => toggleStyle("fontWeight", "bold", "normal")}
                  className={`p-2 rounded ${
                    style.fontWeight === "bold"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Bold size={16} />
                </button>
                <button
                  onClick={() => toggleStyle("fontStyle", "italic", "normal")}
                  className={`p-2 rounded ${
                    style.fontStyle === "italic"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Italic size={16} />
                </button>
                <button
                  onClick={() =>
                    toggleStyle("textDecoration", "underline", "none")
                  }
                  className={`p-2 rounded ${
                    style.textDecoration === "underline"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Underline size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Font Size
              </label>
              <input
                type="text"
                value={style.fontSize || "1rem"}
                onChange={(e) => handleStyleChange("fontSize", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Color
              </label>
              <input
                type="color"
                value={style.color || "#000000"}
                onChange={(e) => handleStyleChange("color", e.target.value)}
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        );
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Content
              </label>
              <textarea
                value={selectedItem.properties.content || ""}
                onChange={(e) =>
                  handlePropertyChange("content", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Font Size
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.fontSize || "1rem"}
                onChange={(e) => handleStyleChange("fontSize", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Color
              </label>
              <input
                type="color"
                value={selectedItem.properties.style?.color || "#000000"}
                onChange={(e) => handleStyleChange("color", e.target.value)}
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        );
      case "BUTTON":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Button Text
              </label>
              <input
                type="text"
                value={selectedItem.properties.text || ""}
                onChange={(e) => handlePropertyChange("text", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Link URL
              </label>
              <input
                type="text"
                value={selectedItem.properties.action_value || "#"}
                onChange={(e) =>
                  handlePropertyChange("action_value", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">Styling</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Background Color
              </label>
              <input
                type="color"
                value={
                  selectedItem.properties.style?.backgroundColor || "#3498db"
                }
                onChange={(e) =>
                  handleStyleChange("backgroundColor", e.target.value)
                }
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Text Color
              </label>
              <input
                type="color"
                value={selectedItem.properties.style?.color || "#ffffff"}
                onChange={(e) => handleStyleChange("color", e.target.value)}
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Width
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.width || "auto"}
                onChange={(e) => handleStyleChange("width", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 100px, 100%, auto"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Padding (Y X)
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.padding || "0.5rem 1rem"}
                onChange={(e) => handleStyleChange("padding", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 0.5rem 1rem"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Border
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.border || "none"}
                onChange={(e) => handleStyleChange("border", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 2px solid #000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Border Radius
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.borderRadius || "8px"}
                onChange={(e) =>
                  handleStyleChange("borderRadius", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 8px, 50%"
              />
            </div>
          </div>
        );
      // --- NEW EDITOR FOR LIST ---
      case "LIST":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                List Items (one per line)
              </label>
              <textarea
                value={(selectedItem.properties.items || []).join("\n")}
                onChange={(e) =>
                  handlePropertyChange("items", e.target.value.split("\n"))
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                rows={5}
              />
            </div>
          </div>
        );
      // --- NEW EDITOR FOR DROPDOWN ---
      case "DROPDOWN":
        const handleOptionChange = (
          index: number,
          key: "text" | "action_value",
          value: string
        ) => {
          const newOptions = [...selectedItem.properties.options];
          newOptions[index] = { ...newOptions[index], [key]: value };
          handlePropertyChange("options", newOptions);
        };

        const addDropdownOption = () => {
          const newOptions = [
            ...(selectedItem.properties.options || []),
            { text: "New Option", action_value: "#" },
          ];
          handlePropertyChange("options", newOptions);
        };

        const removeDropdownOption = (index: number) => {
          const newOptions = selectedItem.properties.options.filter(
            (_: any, i: number) => i !== index
          );
          handlePropertyChange("options", newOptions);
        };

        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Dropdown Label
              </label>
              <input
                type="text"
                value={selectedItem.properties.label || ""}
                onChange={(e) => handlePropertyChange("label", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Options
              </label>
              {(selectedItem.properties.options || []).map(
                (option: any, index: number) => (
                  <div key={index} className="p-2 border rounded-md space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">
                        Option {index + 1}
                      </span>
                      <button
                        onClick={() => removeDropdownOption(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Display Text"
                      value={option.text}
                      onChange={(e) =>
                        handleOptionChange(index, "text", e.target.value)
                      }
                      className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Link URL"
                      value={option.action_value}
                      onChange={(e) =>
                        handleOptionChange(
                          index,
                          "action_value",
                          e.target.value
                        )
                      }
                      className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                    />
                  </div>
                )
              )}
              <button
                onClick={addDropdownOption}
                className="w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
              >
                <PlusCircle size={16} className="mr-2" /> Add Option
              </button>
            </div>
          </div>
        );
      case "IMAGE":
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Image Preview
              </label>
              <img
                src={
                  selectedItem.properties.src || "https://placehold.co/600x400"
                }
                alt="preview"
                className="mt-1 w-full rounded-md border bg-gray-100"
              />
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleLocalImageSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
              >
                <Upload size={16} className="mr-2" /> Choose from PC
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Alt Text
              </label>
              <input
                type="text"
                value={selectedItem.properties.alt || ""}
                onChange={(e) => handlePropertyChange("alt", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">Styling</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Width
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.width || "100%"}
                onChange={(e) => handleStyleChange("width", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 200px, 100%"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Height
              </label>
              <input
                type="text"
                value={selectedItem.properties.style?.height || "auto"}
                onChange={(e) => handleStyleChange("height", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="e.g., 200px, auto"
              />
            </div>
          </div>
        );
      case "CATEGORY":
        const nameStyle = selectedItem.properties.nameStyle || {};
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category Name
              </label>
              <input
                type="text"
                value={selectedItem.properties.name || ""}
                onChange={(e) => handlePropertyChange("name", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
            <hr />
            <h4 className="text-md font-medium text-gray-800 pt-2">
              Name Styling
            </h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Text Styles
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() =>
                    toggleNameStyle("fontWeight", "bold", "normal")
                  }
                  className={`p-2 rounded ${
                    nameStyle.fontWeight === "bold"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Bold size={16} />
                </button>
                <button
                  onClick={() =>
                    toggleNameStyle("fontStyle", "italic", "normal")
                  }
                  className={`p-2 rounded ${
                    nameStyle.fontStyle === "italic"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Italic size={16} />
                </button>
                <button
                  onClick={() =>
                    toggleNameStyle("textDecoration", "underline", "none")
                  }
                  className={`p-2 rounded ${
                    nameStyle.textDecoration === "underline"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200"
                  }`}
                >
                  <Underline size={16} />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Font Family
              </label>
              <select
                value={nameStyle.fontFamily || "sans-serif"}
                onChange={(e) =>
                  handleNameStyleChange("fontFamily", e.target.value)
                }
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              >
                <option value="sans-serif">Sans-serif</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
                <option value="cursive">Cursive</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Text Color
              </label>
              <input
                type="color"
                value={nameStyle.color || "#000000"}
                onChange={(e) => handleNameStyleChange("color", e.target.value)}
                className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        );
      case "FORM":
        const handleFieldChange = (
          index: number,
          key: "label" | "placeholder",
          value: string
        ) => {
          const newFields = [...selectedItem.properties.fields];
          newFields[index] = { ...newFields[index], [key]: value };
          handlePropertyChange("fields", newFields);
        };

        const addField = () => {
          const newFields = [
            ...(selectedItem.properties.fields || []),
            {
              id: `field_${Date.now()}`,
              label: "New Field",
              placeholder: "Enter value",
            },
          ];
          handlePropertyChange("fields", newFields);
        };

        const removeField = (index: number) => {
          const newFields = selectedItem.properties.fields.filter(
            (_: any, i: number) => i !== index
          );
          handlePropertyChange("fields", newFields);
        };

        const handleButtonPropChange = (key: string, value: string) => {
          const newButtonProps = {
            ...selectedItem.properties.submitButton,
            [key]: value,
          };
          handlePropertyChange("submitButton", newButtonProps);
        };

        const handleButtonStyleChange = (key: string, value: string) => {
          const newButtonProps = {
            ...selectedItem.properties.submitButton,
            style: {
              ...selectedItem.properties.submitButton.style,
              [key]: value,
            },
          };
          handlePropertyChange("submitButton", newButtonProps);
        };

        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Form Title
              </label>
              <input
                type="text"
                value={selectedItem.properties.title || ""}
                onChange={(e) => handlePropertyChange("title", e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>

            <hr />

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Form Styling
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Form Width
                  </label>
                  <input
                    type="text"
                    value={selectedItem.properties.style?.width || "100%"}
                    onChange={(e) => handleStyleChange("width", e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    placeholder="e.g., 100%, 500px"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Background Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.style?.backgroundColor ||
                      "#f9fafb"
                    }
                    onChange={(e) =>
                      handleStyleChange("backgroundColor", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Field Label Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.labelStyle?.color || "#374151"
                    }
                    onChange={(e) =>
                      handleLabelStyleChange("color", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>

            <hr />

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Form Fields
              </h4>
              <div className="space-y-3">
                {(selectedItem.properties.fields || []).map(
                  (field: FormField, index: number) => (
                    <div
                      key={field.id}
                      className="p-3 border rounded-md bg-gray-50 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500">
                          Field {index + 1}
                        </span>
                        <button
                          onClick={() => removeField(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Label"
                        value={field.label}
                        onChange={(e) =>
                          handleFieldChange(index, "label", e.target.value)
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Placeholder"
                        value={field.placeholder}
                        onChange={(e) =>
                          handleFieldChange(
                            index,
                            "placeholder",
                            e.target.value
                          )
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                      />
                    </div>
                  )
                )}
              </div>
              <button
                onClick={addField}
                className="mt-3 w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
              >
                <PlusCircle size={16} className="mr-2" /> Add Field
              </button>
            </div>

            <hr />

            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Submit Button
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Button Text
                  </label>
                  <input
                    type="text"
                    value={selectedItem.properties.submitButton?.text || ""}
                    onChange={(e) =>
                      handleButtonPropChange("text", e.target.value)
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Background Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.submitButton?.style
                        ?.backgroundColor || "#3498db"
                    }
                    onChange={(e) =>
                      handleButtonStyleChange("backgroundColor", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Text Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.submitButton?.style?.color ||
                      "#ffffff"
                    }
                    onChange={(e) =>
                      handleButtonStyleChange("color", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Width
                  </label>
                  <input
                    type="text"
                    value={
                      selectedItem.properties.submitButton?.style?.width ||
                      "100%"
                    }
                    onChange={(e) =>
                      handleButtonStyleChange("width", e.target.value)
                    }
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    placeholder="e.g., 100px, 100%, auto"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      case "ACCORDION":
        const handleAccordionChange = (
          index: number,
          key: "question" | "answer",
          value: string
        ) => {
          const newItems = [...selectedItem.properties.items];
          newItems[index] = { ...newItems[index], [key]: value };
          handlePropertyChange("items", newItems);
        };

        const addAccordionItem = () => {
          const newItems = [
            ...(selectedItem.properties.items || []),
            {
              id: `accordion_${Date.now()}`,
              question: "New Question",
              answer: "New Answer",
            },
          ];
          handlePropertyChange("items", newItems);
        };

        const removeAccordionItem = (index: number) => {
          const newItems = selectedItem.properties.items.filter(
            (_: any, i: number) => i !== index
          );
          handlePropertyChange("items", newItems);
        };

        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Accordion Items
              </h4>
              <div className="space-y-3">
                {(selectedItem.properties.items || []).map(
                  (item: AccordionItem, index: number) => (
                    <div
                      key={item.id}
                      className="p-3 border rounded-md bg-gray-50 space-y-2"
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500">
                          Item {index + 1}
                        </span>
                        <button
                          onClick={() => removeAccordionItem(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <textarea
                        placeholder="Question"
                        value={item.question}
                        onChange={(e) =>
                          handleAccordionChange(
                            index,
                            "question",
                            e.target.value
                          )
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                        rows={2}
                      />
                      <textarea
                        placeholder="Answer"
                        value={item.answer}
                        onChange={(e) =>
                          handleAccordionChange(index, "answer", e.target.value)
                        }
                        className="block w-full border-gray-300 rounded-md shadow-sm p-1 text-sm"
                        rows={3}
                      />
                    </div>
                  )
                )}
              </div>
              <button
                onClick={addAccordionItem}
                className="mt-3 w-full flex items-center justify-center text-sm text-blue-600 hover:text-blue-800 p-2 border-dashed border-2 rounded-md"
              >
                <PlusCircle size={16} className="mr-2" /> Add Item
              </button>
            </div>
            <hr />
            <div>
              <h4 className="text-md font-medium text-gray-800 mb-2">
                Styling
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Question Background
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.style?.questionBg || "#f3f4f6"
                    }
                    onChange={(e) =>
                      handleStyleChange("questionBg", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Answer Background
                  </label>
                  <input
                    type="color"
                    value={selectedItem.properties.style?.answerBg || "#ffffff"}
                    onChange={(e) =>
                      handleStyleChange("answerBg", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Icon Color
                  </label>
                  <input
                    type="color"
                    value={
                      selectedItem.properties.style?.iconColor || "#6b7280"
                    }
                    onChange={(e) =>
                      handleStyleChange("iconColor", e.target.value)
                    }
                    className="mt-1 block w-full h-10 p-1 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return <p>No editor for this element.</p>;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        {isExpanded && <h2 className="text-xl font-bold">Properties</h2>}
        <button
          onClick={onToggle}
          className="p-1 text-gray-500 hover:text-gray-800 ml-auto"
        >
          {isExpanded ? (
            <PanelRightClose size={20} />
          ) : (
            <PanelRightOpen size={20} />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="overflow-y-auto flex-grow">
          {selectedItem ? (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg text-gray-600 font-mono capitalize">
                  {selectionType?.replace("_", " ")}
                </h3>
                {selectionType !== "navbar" && (
                  <button
                    onClick={handleDelete}
                    className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              {selectionType === "section" && renderSectionEditor()}
              {selectionType === "subsection" && renderSubsectionEditor()}
              {selectionType === "element" && renderElementEditor()}
              {selectionType === "navbar" && renderNavbarEditor()}
              {selectionType === "navbar_item" && renderNavbarItemEditor()}
            </>
          ) : (
            <p className="text-gray-500">Select an item to edit.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default PropertyEditor;
