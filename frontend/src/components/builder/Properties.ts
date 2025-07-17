// frontend/src/components/builder/Properties.ts
export interface Element {
  element_id: string;
  element_type: string;
  position: number;
  properties: any;
}

export interface Subsection {
  subsection_id: string;
  position: number;
  properties: {
    display?: "flex";
    flexDirection?: "row" | "column";
    justifyContent?: "flex-start" | "center" | "flex-end" | "space-between";
    alignItems?: "flex-start" | "center" | "flex-end";
    gap?: string;
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
  pages: Page[];
}

export type Selection = {
  type: "section" | "subsection" | "element" | null;
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
