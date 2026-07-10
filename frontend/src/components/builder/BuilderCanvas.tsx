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
import saasApi from "@/lib/saasApi";

// ✅ DEFINE THIS SEPARATE COMPONENT (Outside BuilderCanvas)
const BuilderVideoElement = ({ props }: { props: any }) => {
  const src = props.src ? resolveImageSrc(props.src) : "";
  const poster = props.poster ? resolveImageSrc(props.poster) : undefined;

  // --- 1. BACKGROUND MODE RENDER ---
  if (props.isBackground) {
    return (
      <div
        className="w-full h-full min-h-[50px] relative group" // 'relative' keeps the absolute video inside!
        style={{
          // We let the builder wrapper control the size, but we ensure this fills it
          minHeight: src ? "100%" : "100px",
        }}
      >
        {/* A. The Video Layer (Bottom Layer) */}
        <div
          className="absolute inset-0 w-full h-full overflow-hidden"
          style={{
            zIndex: 0,
            pointerEvents: "none", // CRITICAL: Allows clicks to pass through to Text/Buttons on top
            borderRadius: props.videoStyle?.borderRadius || "0px",
          }}
        >
          {src ? (
            <video
              src={src}
              poster={poster}
              autoPlay={props.autoPlay !== false}
              muted={props.muted !== false}
              loop={props.loop !== false}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            // Placeholder when no video is uploaded yet
            <div className="absolute inset-0 bg-blue-50/50 flex items-center justify-center border-2 border-dashed border-blue-300 m-1 rounded">
              <span className="text-blue-400 text-xs font-semibold">
                Background Video Placeholder
              </span>
            </div>
          )}

          {/* Overlay (Controlled by Opacity Slider) */}
          <div
            className="absolute inset-0 bg-black transition-opacity duration-300"
            style={{ opacity: props.overlayOpacity || 0 }}
          />
        </div>

        {/* B. The "Selection Handle" (Top Layer - Only visible in Builder) */}
        {/* This allows you to click/select the video even though the video itself ignores clicks */}
        <div
          className="absolute top-2 right-2 z-50 flex items-center gap-2 px-2 py-1.5 bg-blue-600 text-white text-xs rounded shadow-lg cursor-pointer hover:bg-blue-700 transition-all opacity-80 hover:opacity-100"
          style={{ pointerEvents: "auto" }} // CRITICAL: Catches the click to select this element
          title="Click here to select and edit the background video"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 10l5 5-5 5" />
            <path d="M4 4v7a4 4 0 0 0 4 4h12" />
          </svg>
          <span className="font-bold">Select Video</span>
        </div>

        {/* C. Helper Border (Optional: Helps you see the element bounds while hovering) */}
        <div className="absolute inset-0 border-2 border-blue-400 opacity-0 group-hover:opacity-30 pointer-events-none transition-opacity" />
      </div>
    );
  }

  // --- 2. STANDARD CARD MODE RENDER (Original Logic) ---
  const cardStyle = props.style || {};
  const titleStyle = props.titleStyle || {};
  const metaStyle = props.metaStyle || {};
  const vidStyle = props.videoStyle || {};

  // Standard interactive state
  const [isOpen, setIsOpen] = React.useState(false);
  const isExpandable = !!props.isExpandable;
  const showVideo = !isExpandable || isOpen;

  return (
    <div
      className={`bg-white border rounded-xl shadow overflow-hidden relative ${
        isExpandable ? "cursor-pointer hover:bg-gray-50 transition-colors" : ""
      }`}
      style={cardStyle}
      onClick={(e) => {
        // If expandable, toggle open.
        // NOTE: The parent builder wrapper likely handles the "Selection" event.
        if (isExpandable) setIsOpen(!isOpen);
      }}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex-1">
          <h4 style={titleStyle}>{props.title || "Video title"}</h4>
          <span style={metaStyle}>{props.length || ""}</span>
        </div>
        {isExpandable && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transform transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        )}
      </div>

      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          showVideo ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="relative p-4 pt-0">
          <div className="absolute inset-0 z-10" />
          <video
            src={src}
            poster={poster}
            controls={Boolean(props.controls)}
            style={{ ...vidStyle, pointerEvents: "none", width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
};
const withUnit = (v: any) =>
  typeof v === "number" || (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v))
    ? `${v}px`
    : v;
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
  element: ElementType;
  isPreview: boolean;
  subdomain?: string; // pass from website data at the call site
}

const AiElementRunner: React.FC<AiElementRunnerProps> = ({
  element,
  isPreview,
  subdomain,
}) => {
  const { aiPayload } = element;
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!aiPayload || !ref.current) return;

    const processedProps = {
      ...(aiPayload.properties || {}),
      ...(element.properties || {}),
    };

    const keysToResolve = new Set([
      "src",
      "poster",
      "image_url",
      "backgroundImage",
    ]);
    if (aiPayload.editableProps) {
      aiPayload.editableProps.forEach((prop: any) => {
        if (prop.type === "image") keysToResolve.add(prop.key);
      });
    }
    keysToResolve.forEach((key) => {
      if (processedProps[key])
        processedProps[key] = resolveImageSrc(processedProps[key]);
    });

    let htmlOnly = (aiPayload.aiTemplate || "").replace(
      /<script[\s\S]*?<\/script>/g,
      "",
    );
    const templateRegex = /<template id="displayTemplate">[\s\S]*?<\/template>/;
    const templateMatch = htmlOnly.match(templateRegex);
    const templateContent = templateMatch ? templateMatch[0] : "";
    if (templateContent) {
      htmlOnly = htmlOnly.replace(
        templateContent,
        '<div id="displayTemplate-placeholder"></div>',
      );
    }

    try {
      ref.current.innerHTML = Mustache.render(htmlOnly, processedProps);
    } catch (e) {
      console.error("Mustache render error:", e);
      ref.current.innerHTML = "Error rendering element";
    }

    if (templateContent) {
      const placeholder = ref.current.querySelector(
        "#displayTemplate-placeholder",
      );
      if (placeholder) {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = templateContent;
        if (tempDiv.firstChild) placeholder.replaceWith(tempDiv.firstChild);
      }
    }

    if (aiPayload.script) {
      const jsBody = aiPayload.script
        .replace(/^\s*<script[^>]*>/, "")
        .replace(/<\/script>\s*$/, "");
      try {
        const schemaId = element.properties?.schema_id;
        const apiClient = isPreview ? saasApi : api;
        const propsWithExtras = {
          ...processedProps,
          subdomain: subdomain ?? processedProps.subdomain ?? "",
        };
        // Builder stub: cart isn't live here, but scripts must not crash
        const addToCartStub = (item: any) =>
          alert(
            `(Builder preview) "${item?.name ?? "Item"}" would be added to the cart on the live site.`,
          );
        const zy = {
          mode: "builder" as const,
          isPreview,
          subdomain: propsWithExtras.subdomain,
          websiteId: processedProps.website_id,
          addToCart: addToCartStub,
          navigate: (_url: string) => {}, // no-op in builder so links don't yank you out
        };
        const fn = new Function(
          "container",
          "api",
          "schemaId",
          "properties",
          "Mustache",
          "addToCart",
          "zy",
          jsBody,
        );
        fn(
          ref.current,
          apiClient,
          schemaId,
          propsWithExtras,
          Mustache,
          addToCartStub,
          zy,
        );
      } catch (jsErr: any) {
        console.error("Error running AI script:", jsErr);
        // visible error in the builder = instant diagnosis instead of dead elements
        const box = document.createElement("div");
        box.style.cssText =
          "margin-top:8px;padding:10px 12px;border:1px solid #fca5a5;background:#fef2f2;color:#b91c1c;font-size:13px;border-radius:8px;";
        box.textContent = `Element script error: ${jsErr?.message ?? jsErr}`;
        ref.current.appendChild(box);
      }
    }
  }, [aiPayload, element.properties, isPreview, subdomain]);

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
  onBuildApp?: (prompt: string) => Promise<void>;
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
  onBuildApp,
}) => {
  const [priceRegistry, setPriceRegistry] = useState<Record<string, number>>(
    {},
  );

  const [pageAiPrompt, setPageAiPrompt] = useState("");
  const [isGeneratingPage, setIsGeneratingPage] = useState(false);
  // --- State for preview navigation ---
  const [currentPage, setCurrentPage] = useState(page);
  //appbuilder
  const [appPrompt, setAppPrompt] = useState("");
  const [isBuildingApp, setIsBuildingApp] = useState(false);

  const handlePreviewPageSwitch = (pageId: string) => {
    const newPage = websiteData?.pages.find((p) => p.page_id === pageId);
    if (newPage) setCurrentPage(newPage);
  };
  const withUnit = (v: any) =>
    typeof v === "number" || (typeof v === "string" && /^\d+$/.test(v))
      ? `${v}px`
      : v;

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
    // 1. INITIALIZE DATA
    let props = { ...(element.properties || {}) };

    // 2. THE LIVE SYNC CHECK (Add this part!)
    const itemId = props.item_id || element.aiPayload?.properties?.item_id;
    if (itemId && priceRegistry[itemId] !== undefined) {
      props.base_price = priceRegistry[itemId];
    }

    // 3. YOUR ORIGINAL VARIABLES
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
        <AiElementRunner
          key={element.aiPayload?.id || element.element_id}
          element={element}
          isPreview={isPreview} // ✅ Pass down the isPreview prop
          subdomain={websiteData?.subdomain} // ← ADD THIS
        />;
      } else {
        const hasHover = Object.keys(style).some((k) =>
          k.startsWith("--hover-"),
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
          </div>,
        );
      }
    }
    if (effectiveType === "MENU_ITEM") {
      if (element.element_type === "AI") {
        return (
          <motion.div
            key={element.element_id}
            initial={initial}
            animate={animate}
            transition={transition}
            style={{}} // 👈 EMPTY STYLE HERE to stop the double border!
          >
            <AiElementRunner
              key={element.aiPayload?.id || element.element_id}
              element={{ ...element, properties: props }}
              isPreview={isPreview}
              subdomain={websiteData?.subdomain} // ← ADD THIS
            />
          </motion.div>
        );
      } else {
        return wrap(
          <div className="border rounded-lg p-4 bg-white shadow">
            {props.image_url && (
              <img
                src={resolveImageSrc(props.image_url)}
                alt={props.item_name}
                className="w-full h-40 object-cover rounded-md mb-4"
              />
            )}
            <h4 className="font-bold text-lg text-gray-800">
              {props.item_name || "Menu Item"}
            </h4>
            <p className="font-semibold text-right text-gray-800">
              {/* Uses the hydrated price from priceRegistry */}$
              {Number(props.base_price || 0).toFixed(2)}
            </p>
          </div>,
        );
      }
    } else if (effectiveType === "FORM") {
      if (element.element_type === "AI") {
        return wrap(
          <AiElementRunner
            key={element.aiPayload?.id || element.element_id}
            element={element}
            isPreview={isPreview}
            subdomain={websiteData?.subdomain} // ← ADD THIS
          />,
        );
      } else {
        const buttonStyle = props.submitButton?.style || {};
        const labelStyle = props.labelStyle || {};
        const inputStyle = props.inputStyle || {};
        return wrap(
          <div
            className="border rounded-lg p-4 md:p-6" // ✅ Added padding classes
            style={{
              ...style,
              width: "100%", // ✅ Force full width
              maxWidth: "600px", // ✅ Reasonable max width
              margin: "0 auto", // ✅ Center it
              boxSizing: "border-box", // ✅ Include padding in width
            }}
          >
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
                    style={{
                      ...inputStyle,
                      width: "100%", // ✅ Ensure inputs take full width
                      boxSizing: "border-box", // ✅ Critical for proper sizing
                    }}
                    className="border border-gray-300 rounded-md shadow-sm p-2"
                  />
                </div>
              ))}
              <button
                type="submit"
                style={{
                  ...buttonStyle,
                  width: "100%", // ✅ Full width button on mobile
                }}
                className="w-full" // ✅ Tailwind backup
              >
                {props.submitButton?.text || "Submit"}
              </button>
            </form>
          </div>,
        );
      }
    }
    // Fallback for any other AI element that doesn't have a special type
    else if (element.element_type === "AI") {
      return wrap(
        <AiElementRunner
          key={element.aiPayload?.id || element.element_id}
          element={element}
          isPreview={isPreview} // ✅ Pass down the isPreview prop
          subdomain={websiteData?.subdomain} // ← ADD THIS
        />,
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
        />,
      );
    } else if (effectiveType === "BUTTON") {
      return wrap(<button style={style}>{props.text || "Button"}</button>);
    } else if (effectiveType === "LIST") {
      return wrap(
        <ul style={style}>
          {(props.items || []).map((item: string, i: number) => (
            <li key={i}>{item}</li>
          ))}
        </ul>,
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
        />,
      );
    } else if (effectiveType === "REGISTER_FORM") {
      return wrap(
        <AuthFormElement
          kind="register"
          props={props}
          subdomain={websiteData?.subdomain}
          editMode={true}
        />,
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
        </div>,
      );
    } else if (effectiveType === "VIDEO") {
      // ✅ WRAP THE COMPONENT
      return wrap(<BuilderVideoElement props={props} />);
    } else if (effectiveType === "DROPDOWN") {
      return wrap(
        <select className="border border-gray-300 rounded p-2">
          {props.label && <option disabled>{props.label}</option>}
          {(props.options || []).map((opt: any, i: number) => (
            <option key={i} value={opt.action_value}>
              {opt.text}
            </option>
          ))}
        </select>,
      );
    } else if (effectiveType === "DIVIDER") {
      return (
        <hr
          style={{
            borderColor: style?.borderColor || "#e5e7eb",
            borderTopWidth: style?.borderWidth || "1px",
            marginTop: style?.marginTop || "1rem",
            marginBottom: style?.marginBottom || "1rem",
            width: "100%",
            borderStyle: "solid",
          }}
        />
      );
    } else if (effectiveType === "SPACER") {
      return <div style={{ height: style?.height || "48px", width: "100%" }} />;
    } else if (effectiveType === "EMBED") {
      return wrap(
        <div style={{ width: "100%", position: "relative" }}>
          <iframe
            src={props.src || ""}
            style={{
              width: "100%",
              height: style?.height || "400px",
              border: "0",
              borderRadius: style?.borderRadius || "8px",
              pointerEvents: "none",
            }}
            allowFullScreen
            title="Embed"
          />
          {/* Overlay prevents iframe from capturing builder clicks */}
          <div style={{ position: "absolute", inset: 0, cursor: "default" }} />
        </div>,
      );
    } else if (effectiveType === "COUNTDOWN") {
      return wrap(
        <div style={style}>
          {props.title && (
            <p
              style={{
                fontSize: "0.875rem",
                marginBottom: "1rem",
                textAlign: "center",
                color: style?.color || "#9ca3af",
              }}
            >
              {props.title}
            </p>
          )}
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {["Days", "Hours", "Minutes", "Seconds"].map((unit) => (
              <div key={unit} style={{ textAlign: "center", minWidth: "60px" }}>
                <div
                  style={
                    props.numberStyle || {
                      fontSize: "2.5rem",
                      fontWeight: 700,
                      color: "#ffffff",
                    }
                  }
                >
                  --
                </div>
                <div
                  style={
                    props.labelStyle || {
                      fontSize: "0.75rem",
                      color: "#9ca3af",
                      textTransform: "uppercase",
                    }
                  }
                >
                  {unit}
                </div>
              </div>
            ))}
          </div>
        </div>,
      );
    } else if (effectiveType === "SOCIAL_LINKS") {
      const iconMap: Record<string, string> = {
        instagram: "📷",
        facebook: "👤",
        tiktok: "🎵",
        whatsapp: "💬",
        twitter: "🐦",
        linkedin: "💼",
        youtube: "▶️",
        telegram: "✈️",
      };
      return wrap(
        <div
          style={
            style || {
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              justifyContent: "center",
            }
          }
        >
          {(props.links || []).map((link: any, i: number) => (
            <span
              key={i}
              style={
                props.iconStyle || {
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#111827",
                  color: "#ffffff",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                }
              }
            >
              {iconMap[link.platform] || "🔗"}
            </span>
          ))}
        </div>,
      );
    } else if (effectiveType === "RATING") {
      const rating = props.rating || 4;
      const max = props.maxRating || 5;
      return wrap(
        <div style={style || { textAlign: "center", padding: "1rem" }}>
          <div>
            {Array.from({ length: max }).map((_, i) => (
              <span
                key={i}
                style={{
                  color: i < rating ? props.starColor || "#f59e0b" : "#d1d5db",
                  fontSize: "1.5rem",
                }}
              >
                ★
              </span>
            ))}
          </div>
          {props.label && (
            <p
              style={
                props.labelStyle || {
                  fontSize: "1rem",
                  color: "#374151",
                  marginTop: "8px",
                }
              }
            >
              {props.label}
            </p>
          )}
        </div>,
      );
    } else if (effectiveType === "PROGRESS_BAR") {
      return wrap(
        <div style={style || { padding: "1rem", width: "100%" }}>
          {props.label && (
            <p
              style={
                props.labelStyle || {
                  fontSize: "0.875rem",
                  color: "#374151",
                  marginBottom: "6px",
                }
              }
            >
              {props.label} — {props.percentage || 0}%
            </p>
          )}
          <div
            style={{
              width: "100%",
              backgroundColor: props.trackColor || "#e5e7eb",
              borderRadius: "9999px",
              height: "12px",
            }}
          >
            <div
              style={{
                width: `${props.percentage || 0}%`,
                backgroundColor: props.barColor || "#3b82f6",
                borderRadius: "9999px",
                height: "100%",
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>,
      );
    } else if (effectiveType === "BADGE") {
      return <span style={style || {}}>{props.text || "Badge"}</span>;
    } else {
      return wrap(
        <div className="border p-2 bg-gray-300 text-black rounded">
          Unknown Element
        </div>,
      );
    }
  }

  useEffect(() => {
    if (!currentPage) return;

    // 1. Find every item_id present on the current page
    const usedIds = new Set<string>();
    currentPage.sections.forEach((sec) => {
      sec.subsections.forEach((sub) => {
        sub.elements.forEach((el) => {
          // Check both standard properties and aiPayload properties
          const id =
            el.properties?.item_id || el.aiPayload?.properties?.item_id;
          if (id) usedIds.add(id);
        });
      });
    });

    // 2. Fetch only the prices for these specific IDs
    if (usedIds.size > 0) {
      const idList = Array.from(usedIds).join(",");
      api
        .get(`/menu-items/batch-prices?ids=${idList}`)
        .then((res) => {
          setPriceRegistry(res.data); // Updates the UI with live prices
        })
        .catch((err) => console.error("Price sync failed", err));
    }
  }, [currentPage]);

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
                  (p) => p.slug === item.link_url,
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
          // ✅ FIX TS ERROR: Cast to 'any' to access new backgroundVideo properties
          const properties: any = section.properties || {};
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
            // ADD THESE LINES TO FIX POSITIONING
            top: withUnit(styleProps.top),
            left: withUnit(styleProps.left),
            // ✅ CRITICAL: Default to relative so the absolute video stays inside
            position: styleProps.position || "relative",
            overflow:
              styleProps.position === "relative"
                ? "visible" // Allows popups to escape if needed
                : styleProps.overflow || "hidden", // Default hidden to crop video edges
            // ... rest of your bg logic
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
              {/* ✅ 1. INSERT THIS: Background Video Layer */}
              {properties.backgroundVideo && (
                <div
                  className="absolute inset-0 w-full h-full overflow-hidden"
                  style={{
                    zIndex: 0, // Behind content
                    pointerEvents: "none", // Don't block selection clicks in builder
                    borderRadius: styleProps.borderRadius || "0px",
                  }}
                >
                  <video
                    src={properties.backgroundVideo}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {/* Optional Overlay */}
                  {properties.backgroundVideoOpacity && (
                    <div
                      className="absolute inset-0 bg-black transition-opacity"
                      style={{ opacity: properties.backgroundVideoOpacity }}
                    />
                  )}
                </div>
              )}

              {/* ✅ 2. CONTENT WRAPPER: Added 'relative z-10' to sit ON TOP of video */}
              <div
                className="flex flex-wrap relative z-10"
                style={{
                  display: "flex",
                  flexDirection: properties.flexDirection,
                  justifyContent: properties.justifyContent,
                  alignItems: properties.alignItems,
                  gap: properties.gap,
                }}
              >
                {section.subsections.map((sub) => {
                  const subProps = sub.properties || {};
                  const userStyle = subProps.style || {};

                  // 1. Build the Style Object (Synchronized with PublicCanvas)
                  const subsectionStyle: React.CSSProperties = {
                    // Positioning
                    position: userStyle.position || "static",
                    top: withUnit(userStyle.top),
                    left: withUnit(userStyle.left),
                    right: withUnit(userStyle.right),
                    bottom: withUnit(userStyle.bottom),
                    zIndex: userStyle.position === "relative" ? 50 : "auto",

                    // Layout Base
                    display: subProps.display || "flex",
                    gap: subProps.gap || "1rem",

                    // Essential: Prevent clipping when using relative offsets
                    overflow:
                      userStyle.position === "relative" ? "visible" : "hidden",

                    // Spread user styles last so they can override if needed
                    ...userStyle,
                  };

                  // 2. Handle Grid vs Flex Specifics
                  if (subProps.display === "grid") {
                    subsectionStyle.gridTemplateColumns =
                      subProps.gridTemplateColumns ||
                      `repeat(${subProps.gridColumns || 2}, 1fr)`;
                  } else {
                    subsectionStyle.flexDirection =
                      subProps.flexDirection || "column";
                    subsectionStyle.justifyContent =
                      subProps.justifyContent || "flex-start";
                    subsectionStyle.alignItems =
                      subProps.alignItems || "stretch";
                  }

                  // 3. Animation Configuration
                  const { initial, animate, transition } = getMotionConfig(
                    subProps.animation,
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
                      /* FIX: Removed 'flex-1'. 
         In the Builder, flex-1 forces the box to stretch to fill the row.
         In Public view, the box only takes the space it needs. 
         Removing this ensures the "origin" of your -100px is the same in both.
      */
                      className={`p-4 border-2 rounded-lg min-h-[100px] transition-all ${
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

        {/* --- START: NEW APP GENERATOR UI --- */}
        {/* {!isPreview && (
          <div className="mt-4 p-4 border-2 border-dashed border-indigo-400 rounded-lg bg-indigo-50">
            <h3 className="text-lg font-semibold text-indigo-800 mb-2">
              Generate Entire App with AI
            </h3>
            <p className="text-xs text-indigo-600 mb-2">
              Creates multiple pages, navbar links, data tables, and working
              forms in one go.
            </p>
            <textarea
              className="w-full border rounded p-2 text-sm"
              rows={3}
              placeholder="Describe a whole app, e.g., 'A barbershop with a services list and online booking where picking a slot marks it taken.'"
              value={appPrompt}
              onChange={(e) => setAppPrompt(e.target.value)}
            />
            <button
              onClick={async () => {
                setIsBuildingApp(true);
                await onBuildApp?.(appPrompt);
                setIsBuildingApp(false);
                setAppPrompt("");
              }}
              disabled={isBuildingApp || !appPrompt.trim()}
              className="mt-2 w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50"
            >
              {isBuildingApp
                ? "Building App… (can take a minute)"
                : "Generate App"}
            </button>
          </div>
        )} */}
        {/* --- END: NEW APP GENERATOR UI --- */}

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
