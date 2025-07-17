// src/constants/tableConfigs.ts

export type TableFieldConfig = {
  key: string;
  label: string;
  dataType?: "string" | "number" | "boolean" | "uuid";
  renderAs?: {
    type: "dropdown" | "boolean" | "image";
    optionsSource?:
      | "categories"
      | "locations"
      | "menu_items"
      | "extras"
      | "option_groups"
      | "days_of_week";
  };
};

export type TableConfig = {
  primaryKey: string; // NEW: The name of the primary key column
  fields: TableFieldConfig[];
  createApi?: string;
  updateApi?: string;
  deleteApi?: string;
};
export const tableConfigs: Record<string, TableConfig> = {
  locations: {
    primaryKey: "location_id",
    fields: [
      { key: "location_name", label: "Location Name", dataType: "string" },
      { key: "address", label: "Address", dataType: "string" },
      { key: "phone_number", label: "Phone Number", dataType: "string" },
      { key: "location_owner_email", label: "Owner Email", dataType: "string" },
      { key: "maps_link", label: "Google Maps Link", dataType: "string" },
      // I've also added the boolean fields back in, as they are part of the update schema
      {
        key: "delivery_available",
        label: "Delivery Available",
        dataType: "boolean",
        renderAs: { type: "boolean" },
      },
      {
        key: "dine_in",
        label: "Dine-In Available",
        dataType: "boolean",
        renderAs: { type: "boolean" },
      },
    ],
    updateApi: "/locations/locations/${location_id}",
  },

  categories: {
    primaryKey: "id",
    fields: [
      { key: "name", label: "Category Name", dataType: "string" },
      {
        key: "image_url",
        label: "Image",
        dataType: "string",
        renderAs: { type: "image" },
      },
    ],
    createApi: "/restaurants/categories/",
    updateApi: "/restaurants/${restaurant_id}/categories/${id}",
    deleteApi: "/restaurants/${restaurant_id}/categories/${id}",
  },
  menu_items: {
    primaryKey: "item_id",
    fields: [
      { key: "item_name", label: "Name", dataType: "string" },
      { key: "description", label: "Description", dataType: "string" },
      { key: "base_price", label: "Price", dataType: "number" },
      {
        key: "image_url", // Add the image_url field
        label: "Image",
        dataType: "string",
        renderAs: { type: "image" }, // Tell the UI to render a file input
      },
      {
        key: "is_available",
        label: "Available",
        dataType: "boolean",
        renderAs: { type: "boolean" },
      },
      {
        key: "category_id",
        label: "Category",
        dataType: "number", // The ID is a number
        renderAs: { type: "dropdown", optionsSource: "categories" },
      },
    ],
    createApi: "/menu-items/",
    updateApi: "/menu-items/${item_id}",
    deleteApi: "/menu-items/${item_id}",
  },
  extras: {
    primaryKey: "extra_id",
    fields: [
      { key: "name", label: "Name", dataType: "string" },
      { key: "price", label: "Price", dataType: "number" },
      { key: "description", label: "Description", dataType: "string" },
      {
        key: "is_active",
        label: "Active",
        dataType: "boolean",
        renderAs: { type: "boolean" },
      },
    ],
    createApi: "/extras/",
    updateApi: "/extras/${extra_id}",
    deleteApi: "/extras/${extra_id}",
  },
  menu_item_extras: {
    primaryKey: "menu_item_extra_id",
    fields: [
      {
        key: "menu_item_id",
        label: "Menu Item",
        dataType: "uuid",
        renderAs: { type: "dropdown", optionsSource: "menu_items" },
      },
      {
        key: "extra_id",
        label: "Extra",
        dataType: "uuid",
        renderAs: { type: "dropdown", optionsSource: "extras" },
      },
    ],
    createApi: "/menu-item-extras/",
    deleteApi: "/menu-item-extras/${menu_item_extra_id}",
  },
  option_groups: {
    primaryKey: "group_id",
    fields: [
      { key: "group_name", label: "Group Name", dataType: "string" },
      { key: "min_choices", label: "Min Choices", dataType: "number" },
      { key: "max_choices", label: "Max Choices", dataType: "number" },
      {
        key: "is_required",
        label: "Required",
        dataType: "boolean",
        renderAs: { type: "boolean" },
      },
    ],
    createApi: "/option-groups/",
    updateApi: "/option-groups/${group_id}",
    deleteApi: "/option-groups/${group_id}",
  },
  option_choices: {
    primaryKey: "choice_id",
    fields: [
      {
        key: "group_id",
        label: "Option Group",
        dataType: "uuid",
        renderAs: { type: "dropdown", optionsSource: "option_groups" },
      },
      { key: "name", label: "Choice Name", dataType: "string" },
      { key: "price_adjustment", label: "Price Adj.", dataType: "number" },
      {
        key: "is_active",
        label: "Active",
        dataType: "boolean",
        renderAs: { type: "boolean" },
      },
    ],
    createApi: "/option-choices/",
    updateApi: "/option-choices/${choice_id}",
    deleteApi: "/option-choices/${choice_id}",
  },
  menu_item_options: {
    primaryKey: "menu_item_option_id",
    fields: [
      {
        key: "menu_item_id",
        label: "Menu Item",
        dataType: "uuid",
        renderAs: { type: "dropdown", optionsSource: "menu_items" },
      },
      {
        key: "group_id",
        label: "Option Group",
        dataType: "uuid",
        renderAs: { type: "dropdown", optionsSource: "option_groups" },
      },
    ],
    createApi: "/menu-item-options/",
    deleteApi: "/menu-item-options/${menu_item_option_id}",
  },
  schedules: {
    primaryKey: "schedule_id",
    fields: [
      {
        key: "day_of_week",
        label: "Day",
        dataType: "string",
        renderAs: { type: "dropdown", optionsSource: "days_of_week" },
      },
      { key: "open_time", label: "Opens At", dataType: "string" }, // HTML time input returns a string
      { key: "close_time", label: "Closes At", dataType: "string" },
      {
        key: "is_closed",
        label: "Closed",
        dataType: "boolean",
        renderAs: { type: "boolean" },
      },
      { key: "notes", label: "Notes", dataType: "string" },
    ],
    createApi: "/schedules/",
    updateApi: "/schedules/${schedule_id}",
    deleteApi: "/schedules/${schedule_id}",
  },
};
