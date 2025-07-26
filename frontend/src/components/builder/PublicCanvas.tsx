// frontend/src/components/builder/PublicCanvas.tsx
"use client";
import { motion } from "framer-motion";
import { getMotionConfig } from "./animate";
import Mustache from "mustache";

import React, { useState, useEffect, useRef } from "react";
import {
  Page,
  PublicWebsiteData,
  NavbarItem,
  Section as SectionType,
  Subsection as SubsectionType,
  Element as ElementType,
  FormField,
  AccordionItem,
  Location,
  MenuItem,
} from "./Properties";
import api from "@/lib/axios";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
// --- Add this component inside PublicCanvas.tsx ---
const AiElementRunner: React.FC<{ element: ElementType }> = ({ element }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { aiPayload } = element;

  useEffect(() => {
    if (containerRef.current && aiPayload?.script) {
      try {
        const scriptFunction = new Function("container", aiPayload.script);
        scriptFunction(containerRef.current);
      } catch (error) {
        console.error("Error executing AI-generated script:", error);
      }
    }
  }, [aiPayload]); // Re-run if the payload changes

  if (!aiPayload) {
    return <div>AI Element Data Missing</div>;
  }

  const { aiTemplate, properties: aiProps } = aiPayload;
  const html = Mustache.render(aiTemplate, aiProps);

  return <div ref={containerRef} dangerouslySetInnerHTML={{ __html: html }} />;
};
const Accordion = ({
  items,
  style,
}: {
  items: AccordionItem[];
  style: any;
}) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div className="space-y-2" style={{ width: style.width || "100%" }}>
      {items.map((it, i) => (
        <div key={it.id} className="border rounded-md overflow-hidden">
          <button
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            className="w-full flex justify-between items-center p-3 font-semibold text-left"
            style={{ backgroundColor: style.questionBg || "#f3f4f6" }}
          >
            <span>{it.question}</span>
            <ChevronDown
              size={20}
              className="transition-transform"
              style={{
                color: style.iconColor || "#6b7280",
                transform: openIndex === i ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>
          {openIndex === i && (
            <div
              className="p-3 text-gray-700"
              style={{ backgroundColor: style.answerBg || "#fff" }}
            >
              {it.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export const CategoryMenuInCanvas = ({
  locations,
  categoryId,
}: {
  locations: Location[];
  categoryId: string;
}) => {
  const [locationId, setLocationId] = useState(locations[0]?.location_id || "");
  const [items, setItems] = useState<MenuItem[]>([]);

  useEffect(() => {
    if (!locationId) return;
    api
      .get<MenuItem[]>(
        `/locations/${locationId}/menu?category_id=${categoryId}`
      )
      .then((r) => setItems(r.data))
      .catch(() => setItems([]));
  }, [locationId, categoryId]);

  return (
    <div className="p-4">
      {/* location dropdown */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Choose location:</label>
        <select
          className="border rounded p-2"
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
        >
          {locations.map((loc) => (
            <option key={loc.location_id} value={loc.location_id}>
              {loc.location_name}
            </option>
          ))}
        </select>
      </div>

      {/* menu items grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div
            key={item.item_id}
            className="border rounded-lg bg-white shadow hover:shadow-lg transition overflow-hidden"
            style={{ maxWidth: 280 }}
          >
            <div className="w-full aspect-[4/3] overflow-hidden">
              <img
                src={`${api.defaults.baseURL}${item.image_url}`}
                alt={item.item_name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="p-3">
              <h4 className="font-semibold text-base mb-1">{item.item_name}</h4>
              <p className="text-sm text-gray-600 mb-2">{item.description}</p>
              <p className="font-medium">${item.base_price.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface PublicCanvasProps {
  initialPage?: Page;
  websiteData: PublicWebsiteData;
}

const PublicCanvas: React.FC<PublicCanvasProps> = ({
  initialPage,
  websiteData,
}) => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<Page | undefined>(initialPage);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // always render navbar
  const NavBar = () => (
    <nav style={websiteData.navbar!.properties}>
      <div className="flex items-center justify-between px-6 py-3 shadow-sm">
        <div className="font-bold text-xl">Your Logo</div>
        <div className="flex space-x-4">
          {websiteData.navbar!.items.map((ni: NavbarItem) => {
            const tgt = websiteData.pages.find((p) => p.slug === ni.link_url);
            if (!tgt) return null;
            return (
              <a
                key={ni.item_id}
                href={ni.link_url}
                onClick={(e) => {
                  e.preventDefault();
                  setActiveCategory(null);
                  router.push(`/${websiteData.subdomain}${tgt.slug}`);
                }}
                style={websiteData.navbar!.properties.itemStyle}
                className="text-sm font-medium hover:underline"
              >
                {ni.text}
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );

  // show category drill-down in place of the page content
  const MainContent = () => {
    if (activeCategory) {
      return (
        <>
          {/* category selector */}
          <div className="p-4">
            <button
              onClick={() => setActiveCategory(null)}
              className="text-blue-600 underline mb-4"
            >
              ← Back to "{currentPage?.title}"
            </button>
          </div>
          <CategoryMenuInCanvas
            locations={websiteData.locations}
            categoryId={activeCategory}
          />
        </>
      );
    }

    // Normal page sections
    return (
      <div className="space-y-0">
        {currentPage?.sections.map((sec: SectionType) => (
          <div key={sec.section_id} style={sec.properties}>
            <div
              className="flex flex-wrap"
              style={{
                display: "flex",
                flexDirection: sec.properties.flexDirection,
                justifyContent: sec.properties.justifyContent,
                alignItems: sec.properties.alignItems,
                gap: sec.properties.gap,
              }}
            >
              {sec.subsections.map((sub) => {
                // remove animation before spreading into style
                const { animation, ...styleProps } = sub.properties;

                // get your motion config from that optional animation
                const { initial, animate, transition } =
                  getMotionConfig(animation);

                return (
                  <motion.div
                    key={sub.subsection_id}
                    style={styleProps}
                    initial={initial}
                    animate={animate}
                    transition={transition}
                  >
                    {sub.elements.map((el) => (
                      <div key={el.element_id}>{renderElement(el)}</div>
                    ))}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };

  function renderElement(element: ElementType) {
    const props = element.properties || {};
    const style = props.style || {};
    const BACKEND = api.defaults.baseURL || "";

    // pull out any motion settings (falls back to no‑ops)
    const { initial, animate, transition } = getMotionConfig(props.animation);

    switch (element.element_type) {
      case "TEXT":
        return (
          <motion.div
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          >
            {props.content}
          </motion.div>
        );

      case "BUTTON": {
        const tgt = websiteData.pages.find(
          (p) => p.slug === props.action_value
        );
        return (
          <motion.button
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
            onClick={() => {
              if (tgt) {
                setActiveCategory(null);
                setCurrentPage(tgt);
                router.push(`/${websiteData.subdomain}${tgt.slug}`);
              }
            }}
          >
            {props.text}
          </motion.button>
        );
      }

      case "IMAGE":
        return (
          <motion.img
            src={props.src}
            alt={props.alt}
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          />
        );

      case "LIST":
        return (
          <motion.ul
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          >
            {(props.items || []).map((it: string, i: number) => (
              <li key={i}>{it}</li>
            ))}
          </motion.ul>
        );

      case "DROPDOWN":
        return (
          <motion.select
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          >
            {(props.options || []).map((o: any, i: number) => (
              <option key={i} value={o.action_value}>
                {o.text}
              </option>
            ))}
          </motion.select>
        );

      case "MENU_ITEM":
        return (
          <motion.div
            className="border rounded-lg p-4 bg-white shadow"
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
          >
            {props.image_url && (
              <img
                src={`${BACKEND}${props.image_url}`}
                alt={props.item_name}
                className="w-full object-cover rounded-md mb-4"
              />
            )}
            <h4 className="font-bold text-lg">{props.item_name}</h4>
            <p className="text-sm text-gray-600 my-2">{props.description}</p>
            <p className="font-semibold text-right">
              ${props.base_price.toFixed(2)}
            </p>
          </motion.div>
        );

      case "CATEGORY":
        return (
          <motion.div
            className="cursor-pointer rounded-lg overflow-hidden shadow hover:shadow-lg transition"
            style={style}
            initial={initial}
            animate={animate}
            transition={transition}
            onClick={() => setActiveCategory(props.id)}
          >
            {props.image_url && (
              <img
                src={`${BACKEND}${props.image_url}`}
                alt={props.name}
                className="w-full h-40 object-cover"
              />
            )}
            <div className="p-4 bg-white">
              <h4 className="font-bold text-lg">{props.name}</h4>
            </div>
          </motion.div>
        );

      case "ACCORDION":
        return <Accordion items={props.items || []} style={style} />;

      case "FORM":
        return (
          <motion.form
            style={style}
            className="space-y-4"
            initial={initial}
            animate={animate}
            transition={transition}
            onSubmit={(e) => e.preventDefault()}
          >
            <h3 className="font-bold">{props.title}</h3>
            {(props.fields || []).map((f: FormField) => (
              <div key={f.id}>
                <label>{f.label}</label>
                <input
                  placeholder={f.placeholder}
                  className="border p-2 w-full"
                />
              </div>
            ))}
            <button type="submit">{props.submitButton?.text}</button>
          </motion.form>
        );

      case "MAP":
        return <iframe src={props.src} style={style} />;
      case "AI": {
        // We also need to get the animation properties for the wrapper
        const { initial, animate, transition } = getMotionConfig(
          element.properties.animation
        );

        const isClickable =
          element.properties.linkEnabled && element.properties.action_value;
        const targetPage = isClickable
          ? websiteData.pages.find(
              (p) => p.slug === element.properties.action_value
            )
          : null;

        return (
          <motion.div
            initial={initial}
            animate={animate}
            transition={transition}
            onClick={() => {
              if (targetPage) {
                setActiveCategory(null);
                setCurrentPage(targetPage);
                router.push(`/${websiteData.subdomain}${targetPage.slug}`);
              }
            }}
            className={isClickable ? "cursor-pointer" : ""}
          >
            <AiElementRunner element={element} />
          </motion.div>
        );
      }
      default:
        return <div>Unknown element</div>;
    }
  }

  if (!currentPage) return <div className="p-8">Page not found</div>;

  return (
    <div className="bg-white min-h-screen m-0 p-0">
      <NavBar />
      <MainContent />
    </div>
  );
};

export default PublicCanvas;
