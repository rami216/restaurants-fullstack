// frontend/src/components/builder/Properties.ts

export type PropType = "text" | "number" | "color" | "select" | "boolean";
export interface EditableProp {
  /** the property name on `properties` */
  key: string;
  /** human‑friendly label for the form field */
  label: string;
  /** which input to render */
  type: PropType;
  /** only for `type: "select"` */
  options?: string[];
}

export interface AnimationProps {
  type: "fade-in" | "slide-up" | "bounce" | "pulse";
  duration?: number; // seconds, e.g. 0.5
  delay?: number; // seconds, e.g. 0.1
  repeat?: number | "Infinity";
}

export interface Element {
  element_id: string;
  element_type: string;
  position: number;
  properties: any;
  // editableProps?: EditableProp[];
}

export interface Subsection {
  subsection_id: string;
  position: number;
  properties: {
    display?: "flex" | "grid";
    flexDirection?: "row" | "column";
    justifyContent?: "flex-start" | "center" | "flex-end" | "space-between";
    alignItems?: "flex-start" | "center" | "flex-end";
    gridTemplateColumns?: string;
    gridColumns?: number;
    gap?: string;
    /** ← this must be here: */
    animation?: AnimationProps;
  };
  elements: Element[];
}

export interface Section {
  section_id: string;
  section_type: string;
  position: number;
  properties: {
    backgroundColor?: string;
    backgroundImage?: string;
    padding?: string;
    display?: "flex";
    flexDirection?: "row" | "column";
    justifyContent?: "flex-start" | "center" | "flex-end" | "space-between";
    alignItems?: "flex-start" | "center" | "flex-end";
    gap?: string;
  };
  subsections: Subsection[];
}

export interface Page {
  page_id: string;
  title: string;
  slug: string;
  sections: Section[];
}

export interface WebsiteData {
  website_id: string;
  navbar: Navbar | null;
  pages: Page[];
  subdomain: string; // THIS LINE IS ADDED
}

export type Selection = {
  type: "section" | "subsection" | "element" | "navbar" | "navbar_item" | null;
  id: string | null;
};

export interface Location {
  location_id: string;
  location_name: string;
}

export interface MenuItem {
  item_id: string;
  item_name: string;
  description?: string;
  base_price: number;
  image_url?: string;
}
export interface Category {
  id: number;
  name: string;
  image_url?: string;
}
export interface FormField {
  id: string;
  label: string;
  placeholder: string;
}
export interface AccordionItem {
  id: string;
  question: string;
  answer: string;
}
export interface NavbarItem {
  item_id: string;
  text: string;
  link_url: string;
  position: number;
}

export interface Navbar {
  navbar_id: string;
  properties: any;
  items: NavbarItem[];
}

export interface Location {
  location_id: string;
  location_name: string;
}

export interface PublicWebsiteData {
  website_id: string;
  restaurant_id: string;
  navbar: Navbar | null;
  pages: Page[];
  subdomain: string;
  locations: Location[];
}
