// rami216/restaurants-fullstack/restaurants-fullstack-ai-good/frontend/src/app/(app)/ai-database/page.tsx

"use client";

import React, { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Plus, Edit, Trash2, X } from "lucide-react";

// --- TypeScript Interfaces for our Data ---

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
  // State for managing schemas (left column)
  const [schemas, setSchemas] = useState<CustomSchema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<CustomSchema | null>(
    null
  );
  const [loadingSchemas, setLoadingSchemas] = useState(true);

  // State for managing rows (right column)
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);

  // State for the Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<DataRow | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  const [error, setError] = useState<string | null>(null);
  const [websiteId, setWebsiteId] = useState<string | null>(null);

  // 1. Fetch the main website data to get the website_id on initial load
  useEffect(() => {
    const fetchWebsite = async () => {
      try {
        const response = await api.get("/builder/website");
        if (response.data?.website_id) {
          setWebsiteId(response.data.website_id);
        } else {
          setError("Could not find a website associated with your account.");
        }
      } catch (err) {
        setError("Failed to load website data.");
        console.error(err);
      }
    };
    fetchWebsite();
  }, []);

  // 2. Fetch all schemas once we have the website_id
  useEffect(() => {
    if (!websiteId) return;

    const fetchSchemas = async () => {
      setLoadingSchemas(true);
      setError(null);
      try {
        const response = await api.get(
          `/custom-data/schemas/website/${websiteId}`
        );
        setSchemas(response.data);
      } catch (err) {
        setError("Failed to load data schemas.");
        console.error(err);
      } finally {
        setLoadingSchemas(false);
      }
    };
    fetchSchemas();
  }, [websiteId]);

  // 3. Fetch rows whenever a new schema is selected
  useEffect(() => {
    if (!selectedSchema) return;

    const fetchRows = async () => {
      setLoadingRows(true);
      setError(null);
      try {
        const response = await api.get(
          `/custom-data/rows/${selectedSchema.schema_id}`
        );
        setRows(response.data);
      } catch (err) {
        setError(`Failed to load data for ${selectedSchema.name}.`);
        console.error(err);
      } finally {
        setLoadingRows(false);
      }
    };
    fetchRows();
  }, [selectedSchema]);

  // --- Handlers for CRUD Operations ---

  const handleOpenModal = (row: DataRow | null) => {
    setEditingRow(row);
    setFormData(row ? row.data : {});
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
        // Update existing row
        await api.put(`/custom-data/rows/${editingRow.row_id}`, {
          data: formData,
        });
      } else {
        // Create new row
        await api.post(`/custom-data/rows/${selectedSchema.schema_id}`, {
          data: formData,
        });
      }

      // Refresh the data and close modal
      const response = await api.get(
        `/custom-data/rows/${selectedSchema.schema_id}`
      );
      setRows(response.data);
      handleCloseModal();
    } catch (err) {
      setError("Failed to save data.");
      console.error(err);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await api.delete(`/custom-data/rows/${rowId}`);
        // Refresh data by filtering out the deleted row
        setRows((prev) => prev.filter((row) => row.row_id !== rowId));
      } catch (err) {
        setError("Failed to delete data.");
        console.error(err);
      }
    }
  };

  if (error) {
    return <div className="text-center text-red-500 p-8">{error}</div>;
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-100">
      {/* Left Column: List of Schemas */}
      <aside className="w-1/4 bg-white border-r p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4">Data Tables</h2>
        {loadingSchemas ? (
          <p>Loading tables...</p>
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

      {/* Right Column: Data Viewer and Editor */}
      <main className="w-3/4 p-6 overflow-y-auto">
        {selectedSchema ? (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">
                {selectedSchema.name}
              </h1>
              <button
                onClick={() => handleOpenModal(null)}
                className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors"
              >
                <Plus size={16} className="mr-2" />
                Add New
              </button>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {selectedSchema.fields.map((field) => (
                      <th
                        key={field.id}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
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
                        className="text-center p-4"
                      >
                        Loading data...
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.row_id}>
                        {selectedSchema.fields.map((field) => (
                          <td
                            key={field.id}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-700"
                          >
                            {String(row.data[field.id] || "")}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
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
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>
              Select a data table from the left to view and manage its content.
            </p>
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {isModalOpen && selectedSchema && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
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
                  <input
                    id={field.id}
                    type={field.type === "date" ? "date" : "text"}
                    value={formData[field.id] || ""}
                    onChange={(e) => handleFormChange(field.id, e.target.value)}
                    className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              ))}
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
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
