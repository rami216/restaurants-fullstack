// frontend/src/components/builder/Properties.ts

import { UUID } from "crypto";

// New, strongly-typed interface for element properties
export interface ElementProperties {
  // Standard Element Props
  content?: string;
  src?: string;
  alt?: string;
  text?: string;
  items?: any[];
  options?: any[];
  label?: string;
  image_url?: string;
  item_name?: string;
  description?: string;
  base_price?: number;
  name?: string;

  // Nested Style Objects
  style?: React.CSSProperties; // Use React's built-in type for flexibility
  nameStyle?: React.CSSProperties;
  visibility?: VisibilityRule;
  // Allows any other string-keyed property
  [key: string]: any;
}

export interface EditableProp {
  key: string;
  label: string;
  type: "text" | "number" | "color" | "textarea"; // Added textarea
}

export interface AiElementPayload {
  id: string;
  aiTemplate: string;
  properties: Record<string, any>;
  editableProps: any[]; // Reverted to 'any[]'
  script?: string;
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
  properties: any; // Reverted to 'any' for maximum flexibility
  aiPayload?: AiElementPayload;
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
    style?: React.CSSProperties; // <-- ADD THIS
    visibility?: VisibilityRule;
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
    style?: React.CSSProperties; // <-- OPTIONAL BUT RECOMMENDED
    visibility?: VisibilityRule;
  };
  subsections: Subsection[];
}

export interface Page {
  page_id: string;
  title: string;
  slug: string;
  sections: Section[];
  properties?: {
    visibility?: VisibilityRule; // <-- only this; no page styles
    [key: string]: any;
  };
}

export interface WebsiteData {
  website_id: string;
  subdomain: string;
  navbar: Navbar | null;
  pages: Page[];

  total_spend_usd?: number; // may be undefined/null from API
  monthly_spend_usd?: number; // "
  ai_spend_limit_usd?: number | null; // "

  // custom domain preview helpers
  primary_custom_domain?: string | null;
  primary_custom_domain_status?: string | null; // <-- New
  primary_custom_domain_id?: UUID | null;
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

export interface Extra {
  extra_id: string;
  name: string;
  price: number;
  description?: string;
}
export interface PublicOptionChoice {
  choice_id: string;
  name: string;
  price_adjustment: number;
}

export interface PublicOptionGroup {
  group_id: string;
  group_name: string;
  min_choices?: number;
  max_choices?: number;
  is_required: boolean;
  choices: PublicOptionChoice[];
}

export type VisibilityRule = {
  /** If true, only logged-in site members can see it */
  requiresAuth?: boolean;
  /** If true, only logged-out visitors can see it */
  requiresAnonymous?: boolean;
  /** Optional role restriction (applies only when logged in) */
  roles?: string[];

  /** Only show if the user HAS purchased this product */
  required_product_id?: string;

  /** ✅ NEW: Hide the element if the user HAS purchased this product */
  forbidden_product_id?: string;
};
