"use client";
import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
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
  WebsiteData,
} from "./Properties";
import type { Element as BuilderElement } from "./Properties";
import { Plus, ChevronDown } from "lucide-react";
import api from "@/lib/axios";
import { motion } from "framer-motion";
import { getMotionConfig } from "./animate";
import Mustache from "mustache";
import AuthFormElement from "@/components/shared/AuthFormElement";
import { resolveImageSrc } from "@/lib/imageUrl";
// Standard Accordion
const Accordion: React.FC<{ items: AccordionItem[]; style: any }> = ({
  items,
  style,
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggleItem = (index: number) =>
    setOpenIndex(openIndex === index ? null : index);

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
const normalizeBackground = (bg?: string) => {
  if (!bg) return undefined;
  // if we already have url(...), extract inner and pass through resolver
  if (bg.startsWith("url(")) {
    const inner = bg.replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
    return `url(${resolveImageSrc(inner)})`;
  }
  // plain path or absolute url
  return `url(${resolveImageSrc(bg)})`;
};

interface AiElementRunnerProps {
  element: BuilderElement;
}

const AiElementRunner: React.FC<AiElementRunnerProps> = ({ element }) => {
  const { aiPayload } = element;
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!aiPayload || !ref.current) return;

    if (!aiPayload || !ref.current) return;

    const processed = { ...(aiPayload.properties || {}) };
    for (const key of ["src", "image_url", "backgroundImage"]) {
      if (processed[key]) processed[key] = resolveImageSrc(processed[key]);
    }

    let htmlOnly = (aiPayload.aiTemplate || "").replace(
      /<script[\s\S]*?<\/script>/g,
      ""
    );

    // 2) (Your Handlebars conversion logic is good, keep it)
    const loopMatches = [...htmlOnly.matchAll(/{{#each\s+([\w$]+)}}/g)];
    loopMatches.forEach(([fullMatch, arrKey]) => {
      htmlOnly = htmlOnly.replace(fullMatch, `{{#${arrKey}}}`);
      htmlOnly = htmlOnly.replace(/{{\/each}}/, `{{/${arrKey}}}`);
    });
    htmlOnly = htmlOnly.replace(/{{\s*this\s*}}/g, "{{.}}");

    // 3) Render the template with the PROCESSED properties
    let rendered: string;
    try {
      rendered = Mustache.render(htmlOnly, processed);
    } catch {
      rendered = htmlOnly;
    }
    ref.current.innerHTML = rendered;

    // 4) Execute JS if provided
    if (aiPayload.script) {
      const jsBody = aiPayload.script
        .replace(/^\s*<script[^>]*>/, "")
        .replace(/<\/script>\s*$/, "");
      try {
        const fn = new Function("container", jsBody);
        fn(ref.current);
      } catch (jsErr) {
        console.error("Error running AI script:", jsErr);
      }
    }
  }, [
    aiPayload?.aiTemplate,
    aiPayload?.script,
    JSON.stringify(aiPayload?.properties),
  ]);

  return <div ref={ref} />;
};
interface BuilderCanvasProps {
  page: Page | undefined;
  navbar: Navbar | null;
  selection: Selection;
  onSelect: (selection: Selection) => void;
  onUpdate: (updatedPage: Page) => void;
  onPageSwitch: (pageId: string) => void;
  websiteData: WebsiteData | null;
  isPreview?: boolean;
  onGeneratePage: (prompt: string) => Promise<void>; // <-- ADD THIS
}

const BuilderCanvas: React.FC<BuilderCanvasProps> = ({
  page,
  navbar,
  selection,
  onUpdate,
  onSelect,
  onPageSwitch,
  websiteData,
  isPreview = false,
  onGeneratePage,
}) => {
  const [pageAiPrompt, setPageAiPrompt] = useState("");
  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  // --- State for preview navigation ---
  const [currentPage, setCurrentPage] = useState(page);
  const handlePreviewPageSwitch = (pageId: string) => {
    const newPage = websiteData?.pages.find((p) => p.page_id === pageId);
    if (newPage) setCurrentPage(newPage);
  };

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
    onUpdate({ ...page, sections: [...page.sections, newSection] });
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

  function renderElement(element: ElementType) {
    const props = element.properties || {};
    const style = props.style || {};
    const BACKEND_URL = api.defaults.baseURL || "";
    const { initial, animate, transition } = getMotionConfig(props.animation);

    // This wrap function is specific to BuilderCanvas
    const wrap = (children: React.ReactNode) => (
      <motion.div
        style={style}
        initial={initial}
        animate={animate}
        transition={transition}
      >
        {children}
      </motion.div>
    );

    // Determine the element's true purpose for rendering
    const effectiveType = props.originalType || element.element_type;

    // --- RENDER LOGIC USING if/else if ---

    if (effectiveType === "CATEGORY") {
      if (element.element_type === "AI") {
        return wrap(<AiElementRunner element={element} />);
      } else {
        const hasHover = Object.keys(style).some((k) =>
          k.startsWith("--hover-")
        );
        return wrap(
          <div
            className={`rounded-lg overflow-hidden bg-white shadow-md cursor-pointer ${
              hasHover ? "has-hover-effect" : ""
            }`}
            style={style}
          >
            {props.image_url && (
              <img
                src={resolveImageSrc(props.image_url)}
                alt={props.name}
                className="w-full h-40 object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "https://placehold.co/60x60/fecaca/991b1b?text=Error";
                }}
              />
            )}
            <div className="p-4">
              <h4
                className="font-bold text-xl text-gray-800"
                style={props.nameStyle}
              >
                {props.name || "Category Name"}
              </h4>
            </div>
          </div>
        );
      }
    } else if (effectiveType === "MENU_ITEM") {
      if (element.element_type === "AI") {
        return wrap(<AiElementRunner element={element} />);
      } else {
        return wrap(
          <div className="border rounded-lg p-4 bg-white shadow" style={style}>
            {props.image_url && (
              <img
                src={resolveImageSrc(props.image_url)}
                alt={props.item_name}
                className="w-full object-cover rounded-md mb-4"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "https://placehold.co/60x60/fecaca/991b1b?text=Error";
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
      }
    } else if (effectiveType === "FORM") {
      if (element.element_type === "AI") {
        return wrap(<AiElementRunner element={element} />);
      } else {
        const buttonStyle = props.submitButton?.style || {};
        const labelStyle = props.labelStyle || {};
        const inputStyle = props.inputStyle || {};
        return wrap(
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
                    style={inputStyle}
                    className="w-full border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              ))}
              <button type="submit" style={buttonStyle}>
                {props.submitButton?.text || "Submit"}
              </button>
            </form>
          </div>
        );
      }
    }

    // Fallback for any other AI element that doesn't have a special type
    else if (element.element_type === "AI") {
      return wrap(
        <AiElementRunner
          key={element.aiPayload?.id || element.element_id}
          element={element}
        />
      );
    }

    // --- The rest of your standard element renderers ---
    else if (effectiveType === "TEXT") {
      const contentHTML = { __html: props.content || "" };
      return wrap(<div dangerouslySetInnerHTML={contentHTML} />);
    } else if (effectiveType === "IMAGE") {
      return wrap(
        <img
          src={
            props.src
              ? resolveImageSrc(props.src)
              : "https://placehold.co/600x400"
          }
          alt={props.alt || "placeholder"}
          style={{ width: "100%", height: "auto" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src =
              "https://placehold.co/600x400/fecaca/991b1b?text=Error";
          }}
        />
      );
    } else if (effectiveType === "BUTTON") {
      return wrap(<button style={style}>{props.text || "Button"}</button>);
    } else if (effectiveType === "LIST") {
      return wrap(
        <ul style={style}>
          {(props.items || []).map((item: string, i: number) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    } else if (effectiveType === "ACCORDION") {
      return wrap(<Accordion items={props.items || []} style={style} />);
    } else if (effectiveType === "LOGIN_FORM") {
      return wrap(
        <AuthFormElement
          kind="login"
          props={props}
          subdomain={websiteData?.subdomain}
          editMode={true}
        />
      );
    } else if (effectiveType === "REGISTER_FORM") {
      return wrap(
        <AuthFormElement
          kind="register"
          props={props}
          subdomain={websiteData?.subdomain}
          editMode={true}
        />
      );
    } else if (effectiveType === "MAP") {
      return wrap(
        <div className="relative">
          <div className="absolute inset-0 z-10 cursor-pointer" />
          <iframe
            src={props.src}
            style={{ ...style, pointerEvents: "none" }}
            allowFullScreen={false}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Google Map"
          />
        </div>
      );
    } else if (effectiveType === "DROPDOWN") {
      return wrap(
        <select className="border border-gray-300 rounded p-2">
          {props.label && <option disabled>{props.label}</option>}
          {(props.options || []).map((opt: any, i: number) => (
            <option key={i} value={opt.action_value}>
              {opt.text}
            </option>
          ))}
        </select>
      );
    } else {
      return wrap(
        <div className="border p-2 bg-gray-300 text-black rounded">
          Unknown Element
        </div>
      );
    }
  }

  if (!page) {
    return (
      <div className="text-center p-10 text-gray-500">
        Select a page to start building.
      </div>
    );
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow-inner">
      {/* --- START: NEW PAGE SELECTOR --- */}
      <div className="mb-4 p-3 bg-gray-50 border rounded-lg flex items-center space-x-4">
        <label htmlFor="page-selector" className="font-semibold text-gray-700">
          Editing Page:
        </label>
        <select
          id="page-selector"
          value={page?.page_id || ""}
          onChange={(e) => onPageSwitch(e.target.value)}
          className="flex-grow border-gray-300 rounded-md shadow-sm p-2"
        >
          {websiteData?.pages.map((p) => (
            <option key={p.page_id} value={p.page_id}>
              {p.title}
            </option>
          ))}
        </select>
      </div>
      {/* --- END: NEW PAGE SELECTOR --- */}
      {navbar && (
        <nav
          onClick={
            !isPreview
              ? () => onSelect({ type: "navbar", id: navbar.navbar_id })
              : undefined
          }
          className={`p-4 mb-4 rounded-lg transition-all ${
            !isPreview
              ? `cursor-pointer border-2 ${
                  selection.type === "navbar" &&
                  selection.id === navbar.navbar_id
                    ? "border-purple-500"
                    : "border-dashed border-gray-300"
                }`
              : ""
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
                const itemStyle = navbar.properties?.itemStyle || {};

                return (
                  <a
                    key={item.item_id}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (targetPage) onPageSwitch(targetPage.page_id);
                      onSelect({ type: "navbar_item", id: item.item_id });
                    }}
                    style={itemStyle}
                    className={`px-3 py-2 rounded transition-all ${
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
        {page.sections.map((section) => {
          const properties = section.properties || {};
          const styleProps = properties.style || {};

          // get bg from either place
          const rawBg =
            properties.backgroundImage ?? styleProps.backgroundImage;

          // normalize (supports gradients, url(...), and raw paths)
          let backgroundImage: string | undefined;
          if (typeof rawBg === "string" && rawBg.trim()) {
            backgroundImage = rawBg.startsWith("linear-gradient")
              ? rawBg
              : normalizeBackground(rawBg);
          }

          const sectionStyle: React.CSSProperties = {
            backgroundColor:
              properties.backgroundColor ?? styleProps.backgroundColor,
            padding: properties.padding ?? styleProps.padding,
            display: properties.display ?? styleProps.display,
            flexDirection: properties.flexDirection ?? styleProps.flexDirection,
            justifyContent:
              properties.justifyContent ?? styleProps.justifyContent,
            alignItems: properties.alignItems ?? styleProps.alignItems,
            gap: properties.gap ?? styleProps.gap,
            ...styleProps,
            ...(backgroundImage ? { backgroundImage } : {}),
            ...(backgroundImage && backgroundImage.startsWith("url(")
              ? { backgroundSize: "cover", backgroundPosition: "center" }
              : {}),
          };

          return (
            <div
              key={section.section_id}
              onClick={
                !isPreview
                  ? () => onSelect({ type: "section", id: section.section_id })
                  : undefined
              }
              className={`p-4 rounded-lg transition-all ${
                !isPreview
                  ? `cursor-pointer border-2 ${
                      selection.type === "section" &&
                      selection.id === section.section_id
                        ? "border-blue-500"
                        : "border-dashed border-gray-300"
                    }`
                  : ""
              }`}
              style={sectionStyle}
            >
              <div
                className="flex flex-wrap"
                style={{
                  display: "flex",
                  flexDirection: properties.flexDirection,
                  justifyContent: properties.justifyContent,
                  alignItems: properties.alignItems,
                  gap: properties.gap,
                }}
              >
                {section.subsections.map((sub) => {
                  // --- FIX: Provide a default empty object for properties if it's missing ---
                  const subProps = sub.properties || {};

                  const subsectionStyle: React.CSSProperties = {
                    // Safely access properties from subProps
                    display: subProps.display || "flex",
                    gap: subProps.gap || "1rem",
                    ...(subProps.style || {}),
                  };

                  if (subProps.display === "grid") {
                    subsectionStyle.gridTemplateColumns =
                      subProps.gridTemplateColumns || "repeat(2, 1fr)";
                  } else {
                    subsectionStyle.flexDirection =
                      subProps.flexDirection || "column";
                    subsectionStyle.justifyContent =
                      subProps.justifyContent || "flex-start";
                    subsectionStyle.alignItems =
                      subProps.alignItems || "stretch";
                  }

                  const { initial, animate, transition } = getMotionConfig(
                    subProps.animation // Also use subProps here
                  );

                  return (
                    <motion.div
                      key={sub.subsection_id}
                      initial={initial}
                      animate={animate}
                      transition={transition}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect({ type: "subsection", id: sub.subsection_id });
                      }}
                      className={`p-4 border-2 rounded-lg min-h-[100px] flex-1 transition-all ${
                        selection.type === "subsection" &&
                        selection.id === sub.subsection_id
                          ? "border-green-500"
                          : "border-dashed border-gray-400"
                      }`}
                      style={subsectionStyle}
                    >
                      {sub.elements.map((el) => (
                        <div
                          key={el.element_id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect({ type: "element", id: el.element_id });
                          }}
                          className={`p-2 rounded transition-all ${
                            selection.type === "element" &&
                            selection.id === el.element_id
                              ? "ring-2 ring-offset-2 ring-pink-500"
                              : ""
                          }`}
                        >
                          {renderElement(el)}
                        </div>
                      ))}

                      {sub.elements.length === 0 && (
                        <div className="text-gray-400 self-center mx-auto">
                          Add elements here
                        </div>
                      )}
                    </motion.div>
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
          );
        })}
        {/* --- START: NEW PAGE GENERATOR UI --- */}
        {!isPreview && (
          <div className="mt-6 p-4 border-2 border-dashed border-purple-400 rounded-lg bg-purple-50">
            <h3 className="text-lg font-semibold text-purple-800 mb-2">
              Generate Whole Page with AI
            </h3>
            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={3}
              placeholder="Describe the page you want to create, e.g., 'An elegant 'About Us' page for a cafe'."
              value={pageAiPrompt}
              onChange={(e) => setPageAiPrompt(e.target.value)}
            />
            <button
              onClick={async () => {
                setIsGeneratingPage(true);
                await onGeneratePage(pageAiPrompt);
                setIsGeneratingPage(false);
              }}
              disabled={isGeneratingPage || !pageAiPrompt.trim()}
              className="mt-2 w-full bg-purple-600 text-white py-2 rounded disabled:opacity-50"
            >
              {isGeneratingPage ? "Generating Page..." : "Generate Page"}
            </button>
          </div>
        )}
        {/* --- END: NEW PAGE GENERATOR UI --- */}

        {!isPreview && (
          <button
            onClick={handleAddSection}
            className="w-full py-4 border-2 border-dashed border-gray-400 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500"
          >
            + Add New Section
          </button>
        )}
      </div>
    </div>
  );
};

export default BuilderCanvas;
