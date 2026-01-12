"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Plus, Edit, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react";

// --- TypeScript Interfaces ---

interface SchemaField {
  id: string;
  label: string;
  type: string;
  related_schema_id?: string;
}

interface CustomSchema {
  schema_id: string;
  name: string;
  fields: SchemaField[];
}

interface DataRow {
  row_id: string;
  data: Record<string, any>;
}

// --- Main Page Component ---

export default function AiDatabasePage() {
  const [schemas, setSchemas] = useState<CustomSchema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<CustomSchema | null>(
    null
  );
  const [loadingSchemas, setLoadingSchemas] = useState(true);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const ROWS_PER_PAGE = 15;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DataRow | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const [websiteId, setWebsiteId] = useState<string | null>(null);

  // --- Data Fetching Hooks ---
  useEffect(() => {
    api
      .get("/builder/website")
      .then((res) => setWebsiteId(res.data?.website_id))
      .catch(() => setError("Failed to load website data."));
  }, []);

  useEffect(() => {
    if (!websiteId) return;
    setLoadingSchemas(true);
    api
      .get(`/custom-data/schemas/website/${websiteId}`)
      .then((res) => setSchemas(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError("Failed to load data schemas."))
      .finally(() => setLoadingSchemas(false));
  }, [websiteId]);

  const fetchRowsForSchema = async (schemaId: string, page: number) => {
    setLoadingRows(true);
    try {
      const skip = page * ROWS_PER_PAGE;
      const response = await api.get(
        `/custom-data/rows/${schemaId}?skip=${skip}&limit=${ROWS_PER_PAGE}`
      );
      if (response.data && Array.isArray(response.data.rows)) {
        setRows(response.data.rows);
        setTotalPages(Math.ceil(response.data.total / ROWS_PER_PAGE));
      }
    } catch (err) {
      setError(`Failed to load data for ${selectedSchema?.name}.`);
    } finally {
      setLoadingRows(false);
    }
  };

  useEffect(() => {
    if (selectedSchema) {
      fetchRowsForSchema(selectedSchema.schema_id, currentPage);
    }
  }, [selectedSchema, currentPage]);

  useEffect(() => {
    setCurrentPage(0);
  }, [selectedSchema]);

  // --- CRUD and Modal Handlers ---
  const handleOpenModal = (row: DataRow | null) => {
    setEditingRow(row);
    // When editing, we need to store the ID of the related object, not the whole object
    const initialFormData = row
      ? Object.entries(row.data).reduce((acc, [key, value]) => {
          if (typeof value === "object" && value !== null && value.row_id) {
            acc[key] = value.row_id;
          } else {
            acc[key] = value;
          }
          return acc;
        }, {} as Record<string, any>)
      : {};
    setFormData(initialFormData);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRow(null);
    setFormData({});
  };

  const handleFormChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSaveRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchema) return;
    try {
      if (editingRow) {
        await api.put(`/custom-data/rows/${editingRow.row_id}`, {
          data: formData,
        });
      } else {
        await api.post(`/custom-data/rows/${selectedSchema.schema_id}`, {
          data: formData,
        });
      }
      await fetchRowsForSchema(selectedSchema.schema_id, currentPage);
      handleCloseModal();
    } catch (err) {
      setError("Failed to save data.");
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    // ✅ THE FIX: Add a check for selectedSchema before using it.
    if (!selectedSchema) {
      setError("Cannot delete row: no schema selected.");
      return;
    }

    if (window.confirm("Are you sure?")) {
      try {
        await api.delete(`/custom-data/rows/${rowId}`);
        await fetchRowsForSchema(selectedSchema.schema_id, currentPage);
      } catch (err) {
        setError("Failed to delete data.");
      }
    }
  };

  const getDisplayValue = (cellData: any, field: SchemaField) => {
    if (typeof cellData === "object" && cellData !== null && cellData.data) {
      const data = cellData.data;

      // Convert unknown values to strings safely while filtering out nested objects
      const values = Object.values(data).filter(
        (v): v is string | number =>
          (typeof v === "string" || typeof v === "number") && v !== null
      );

      // DYNAMIC ROLE DETECTION: A child field usually has multiple descriptive strings (like start/end time)
      // or is explicitly not the first relation found in the schema.
      const isChild =
        field.id.toLowerCase().match(/time|slot|sub|model/i) ||
        values.length > 1;

      if (isChild) {
        // UNIVERSAL REDUNDANCY FILTER:
        // We look for any value that matches common "Parent" patterns or is just one of many.
        // For your specific case, we strip out any value that isn't a time-formatted string
        // if it's a "Time" column, or we just join everything that isn't the first field.
        return values
          .filter((v) => {
            const str = v.toString();
            // Hide common calendar names or generic parent labels if they appear in a child column
            return !str.match(
              /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i
            );
          })
          .join(" - ");
      }

      // For Parent fields, just show the primary descriptive value
      return values.length > 0 ? String(values[0]) : cellData.row_id;
    }

    return String(cellData || "");
  };

  // --- RENDER ---
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-100">
      <aside className="w-1/4 p-4 overflow-y-auto bg-white border-r">
        <h2 className="mb-4 text-lg font-semibold">Data Tables</h2>
        {loadingSchemas ? (
          <p>Loading...</p>
        ) : (
          <nav className="space-y-1">
            {schemas.map((schema) => (
              <button
                key={schema.schema_id}
                onClick={() => setSelectedSchema(schema)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedSchema?.schema_id === schema.schema_id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {schema.name}
              </button>
            ))}
          </nav>
        )}
      </aside>

      <main className="flex flex-col w-3/4 p-6">
        {selectedSchema ? (
          <>
            <div className="flex-grow overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">
                  {selectedSchema.name}
                </h1>
                <button
                  onClick={() => handleOpenModal(null)}
                  className="flex items-center px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  <Plus size={16} className="mr-2" /> Add New
                </button>
              </div>
              <div className="overflow-hidden bg-white rounded-lg shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {selectedSchema.fields.map((field) => (
                        <th
                          key={field.id}
                          className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase"
                        >
                          {field.label}
                        </th>
                      ))}
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loadingRows ? (
                      <tr>
                        <td
                          colSpan={selectedSchema.fields.length + 1}
                          className="p-4 text-center"
                        >
                          Loading...
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.row_id}>
                          {selectedSchema.fields.map((field) => (
                            <td
                              key={field.id}
                              className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap"
                            >
                              {/* ✅ MODIFIED: Use the helper function here */}
                              {getDisplayValue(row.data[field.id], field)}
                            </td>
                          ))}
                          <td className="px-6 py-4 space-x-2 text-sm font-medium text-right whitespace-nowrap">
                            <button
                              onClick={() => handleOpenModal(row)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              <Edit size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteRow(row.row_id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex items-center justify-end flex-shrink-0 pt-4 space-x-4">
              <span className="text-sm text-gray-600">
                Page {currentPage + 1} of {totalPages || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={currentPage === 0}
                className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= totalPages - 1}
                className="p-2 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>Select a data table to view its content.</p>
          </div>
        )}
      </main>

      {isModalOpen && selectedSchema && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingRow
                  ? `Edit ${selectedSchema.name}`
                  : `Add to ${selectedSchema.name}`}
              </h2>
              <button onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveRow} className="space-y-4">
              {selectedSchema.fields.map((field) => (
                <div key={field.id}>
                  <label
                    htmlFor={field.id}
                    className="block text-sm font-medium text-gray-700"
                  >
                    {field.label}
                  </label>
                  {field.type === "relation" ? (
                    <RelationDropdown
                      api={api}
                      schemas={schemas}
                      field={field}
                      value={formData[field.id] || ""}
                      onChange={(value) => handleFormChange(field.id, value)}
                    />
                  ) : (
                    <input
                      id={field.id}
                      type={field.type === "date" ? "date" : "text"}
                      value={formData[field.id] || ""}
                      onChange={(e) =>
                        handleFormChange(field.id, e.target.value)
                      }
                      className="block w-full px-3 py-2 mt-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      required
                    />
                  )}
                </div>
              ))}
              <div className="flex justify-end pt-4 space-x-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// --- ✅ NEW: A dedicated component for relation dropdowns ---
interface RelationDropdownProps {
  api: any;
  schemas: CustomSchema[];
  field: SchemaField;
  value: string;
  onChange: (value: string) => void;
}
const RelationDropdown: React.FC<RelationDropdownProps> = ({
  api,
  schemas,
  field,
  value,
  onChange,
}) => {
  const [options, setOptions] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!field.related_schema_id) return;

    const fetchOptions = async () => {
      setLoading(true);
      try {
        const response = await api.get(
          `/custom-data/rows/${field.related_schema_id}?limit=1000`
        );
        if (response.data && Array.isArray(response.data.rows)) {
          setOptions(response.data.rows);
        }
      } catch (error) {
        console.error(`Failed to fetch options for ${field.label}`, error);
      } finally {
        setLoading(false);
      }
    };

    fetchOptions();
  }, [field.related_schema_id, api]);

  const getOptionLabel = (option: DataRow) => {
    const values = Object.values(option.data).filter(
      (v): v is string | number =>
        (typeof v === "string" || typeof v === "number") && v !== null
    );

    // Identify if this relation should be a "Child" (detailed) or "Parent" (simple)
    const isChild = field.id.toLowerCase().match(/time|slot|sub|model/i);

    if (isChild) {
      // For children, show the full detail but strip the parent's name if found
      return values
        .filter(
          (v) =>
            !v
              .toString()
              .match(
                /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/i
              )
        )
        .join(" - ");
    }

    // For parents, show only the primary name
    return values.length > 0 ? String(values[0]) : option.row_id;
  };

  return (
    <select
      id={field.id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="block w-full px-3 py-2 mt-1 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
      required
    >
      <option value="">
        {loading ? "Loading..." : `Select ${field.label}`}
      </option>
      {(() => {
        // --- UNIVERSAL UNIQUE FILTER ---
        const seenLabels = new Set<string>();
        return options
          .filter((option) => {
            const label = getOptionLabel(option);
            if (seenLabels.has(label)) return false;
            seenLabels.add(label);
            return true;
          })
          .map((option) => (
            <option key={option.row_id} value={option.row_id}>
              {getOptionLabel(option)}
            </option>
          ));
      })()}
    </select>
  );
};
