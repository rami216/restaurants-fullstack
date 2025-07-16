// components/builder/Properties.ts

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
    // For layout of elements INSIDE this subsection
    display?: "flex";
    flexDirection?: "row" | "column";
    justifyContent?: "flex-start" | "center" | "flex-end" | "space-between";
    alignItems?: "flex-start" | "center" | "flex-end";
    gap?: string;
  };
  elements: Element[];
}

// --- THIS IS THE UPDATED INTERFACE ---
export interface Section {
  section_id: string;
  section_type: string;
  position: number;
  properties: {
    // For the section's own appearance
    backgroundColor?: string;
    backgroundImage?: string;
    padding?: string;

    // NEW: For laying out the subsections WITHIN this section
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
